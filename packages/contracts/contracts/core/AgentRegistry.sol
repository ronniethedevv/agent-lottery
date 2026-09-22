// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";

/// @title AgentRegistry
/// @notice Manages agent registration, staking, reputation, and Sybil resistance.
/// @dev Agents must stake a minimum amount of BNB to register. Only registered
///      agents can create or participate in lotteries. Stake can be slashed for
///      protocol violations.
contract AgentRegistry is IAgentRegistry, Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public minStake;
    uint256 public deregistrationCooldown;
    uint256 public agentCount;

    mapping(address => AgentInfo) private agents;
    mapping(address => uint64) public deregistrationRequestedAt;

    error InsufficientStake();
    error AlreadyRegistered();
    error NotRegistered();
    error CooldownNotElapsed();
    error NoDeregistrationRequested();
    error SlashAmountExceedsStake();
    error TransferFailed();

    constructor(
        uint256 _minStake,
        uint256 _deregistrationCooldown
    ) Ownable(msg.sender) {
        minStake = _minStake;
        deregistrationCooldown = _deregistrationCooldown;
    }

    /// @inheritdoc IAgentRegistry
    function registerAgent() external payable override whenNotPaused nonReentrant {
        if (msg.value < minStake) revert InsufficientStake();
        if (agents[msg.sender].isActive) revert AlreadyRegistered();

        agents[msg.sender] = AgentInfo({
            stake: msg.value,
            reputation: 0,
            registeredAt: uint64(block.timestamp),
            isActive: true
        });

        agentCount++;
        emit AgentRegistered(msg.sender, msg.value);
    }

    /// @notice Request deregistration. The agent must wait for the cooldown
    ///         period before completing deregistration and reclaiming their stake.
    function requestDeregistration() external {
        if (!agents[msg.sender].isActive) revert NotRegistered();
        deregistrationRequestedAt[msg.sender] = uint64(block.timestamp);
    }

    /// @inheritdoc IAgentRegistry
    function deregisterAgent() external override nonReentrant {
        AgentInfo storage agent = agents[msg.sender];
        if (!agent.isActive) revert NotRegistered();

        uint64 requestedAt = deregistrationRequestedAt[msg.sender];
        if (requestedAt == 0) revert NoDeregistrationRequested();
        if (block.timestamp < requestedAt + deregistrationCooldown) {
            revert CooldownNotElapsed();
        }

        uint256 stakeToReturn = agent.stake;
        agent.isActive = false;
        agent.stake = 0;
        delete deregistrationRequestedAt[msg.sender];

        agentCount--;

        (bool success, ) = msg.sender.call{value: stakeToReturn}("");
        if (!success) revert TransferFailed();

        emit AgentDeregistered(msg.sender, stakeToReturn);
    }

    /// @inheritdoc IAgentRegistry
    function slash(
        address agent,
        uint256 amount,
        bytes32 reason
    ) external override onlyOwner {
        AgentInfo storage info = agents[agent];
        if (!info.isActive) revert NotRegistered();
        if (amount > info.stake) revert SlashAmountExceedsStake();

        info.stake -= amount;
        if (info.stake < minStake) {
            info.isActive = false;
            agentCount--;
        }

        // Slashed funds go to the protocol treasury (contract owner)
        (bool success, ) = owner().call{value: amount}("");
        if (!success) revert TransferFailed();

        emit AgentSlashed(agent, amount, reason);
    }

    /// @inheritdoc IAgentRegistry
    function incrementReputation(
        address agent,
        uint256 amount
    ) external override {
        // Only callable by lottery contracts (checked via factory)
        AgentInfo storage info = agents[agent];
        if (!info.isActive) revert NotRegistered();

        info.reputation += amount;
        emit ReputationUpdated(agent, info.reputation);
    }

    /// @inheritdoc IAgentRegistry
    function isRegistered(address agent) external view override returns (bool) {
        return agents[agent].isActive;
    }

    /// @inheritdoc IAgentRegistry
    function getAgentInfo(address agent) external view override returns (AgentInfo memory) {
        return agents[agent];
    }

    /// @inheritdoc IAgentRegistry
    function getMinStake() external view override returns (uint256) {
        return minStake;
    }

    /// @inheritdoc IAgentRegistry
    function getAgentCount() external view override returns (uint256) {
        return agentCount;
    }

    // --- Admin functions ---

    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
    }

    function setDeregistrationCooldown(uint256 _cooldown) external onlyOwner {
        deregistrationCooldown = _cooldown;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
