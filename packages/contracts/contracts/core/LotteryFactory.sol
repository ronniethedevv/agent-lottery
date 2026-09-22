// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ILotteryFactory} from "../interfaces/ILotteryFactory.sol";
import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";

/// @title LotteryFactory
/// @notice Creates and manages lottery instances via EIP-1167 minimal proxy clones.
/// @dev Only registered agents can create lotteries. Each lottery is a clone of a
///      fixed implementation contract. The factory tracks all deployed lotteries
///      and enforces global configuration bounds.
contract LotteryFactory is ILotteryFactory, Ownable2Step, Pausable {
    using Clones for address;

    address public implementation;
    IAgentRegistry public agentRegistry;
    address public drawManager;
    address public prizePool;

    // ZK verifier addresses
    address public eligibilityVerifier;
    address public ticketVerifier;
    address public claimVerifier;

    // Poseidon(2) hasher shared by every lottery's Merkle tree
    address public poseidonHasher;

    // Protocol config
    uint16 public protocolFeeRate; // basis points

    // Lottery bounds
    uint256 public minEntryFee;
    uint256 public maxEntryFee;
    uint32 public minDrawInterval;
    uint32 public maxDrawInterval;

    // Lottery tracking
    address[] public lotteries;
    mapping(address => bool) public lotteryExists;

    error NotRegisteredAgent();
    error EntryFeeOutOfBounds();
    error DrawIntervalOutOfBounds();
    error MaxTicketsTooLow();
    error CreatorFeeRateTooHigh();
    error ImplementationNotSet();

    constructor(
        address _implementation,
        address _agentRegistry,
        address _drawManager,
        address _prizePool,
        address _eligibilityVerifier,
        address _ticketVerifier,
        address _claimVerifier,
        address _poseidonHasher
    ) Ownable(msg.sender) {
        implementation = _implementation;
        agentRegistry = IAgentRegistry(_agentRegistry);
        drawManager = _drawManager;
        prizePool = _prizePool;
        eligibilityVerifier = _eligibilityVerifier;
        ticketVerifier = _ticketVerifier;
        claimVerifier = _claimVerifier;
        poseidonHasher = _poseidonHasher;

        protocolFeeRate = 200; // 2%
        minEntryFee = 0.001 ether;
        maxEntryFee = 100 ether;
        minDrawInterval = 60;       // 1 minute
        maxDrawInterval = 7 days;
    }

    /// @inheritdoc ILotteryFactory
    function createLottery(
        LotteryConfig calldata config
    ) external override whenNotPaused returns (address) {
        if (implementation == address(0)) revert ImplementationNotSet();
        if (!agentRegistry.isRegistered(msg.sender)) revert NotRegisteredAgent();
        if (config.entryFee < minEntryFee || config.entryFee > maxEntryFee) {
            revert EntryFeeOutOfBounds();
        }
        if (config.drawInterval < minDrawInterval || config.drawInterval > maxDrawInterval) {
            revert DrawIntervalOutOfBounds();
        }
        if (config.maxTickets < 2) revert MaxTicketsTooLow();
        if (config.creatorFeeRate > 1000) revert CreatorFeeRateTooHigh(); // max 10%

        // Deploy clone with deterministic address
        bytes32 salt = keccak256(
            abi.encodePacked(msg.sender, lotteries.length, block.timestamp)
        );
        address lottery = implementation.cloneDeterministic(salt);

        // Initialize the lottery
        (bool success, ) = lottery.call(
            abi.encodeWithSignature(
                "initialize(uint256,uint32,uint32,uint32,uint16,address,address,address,address,address,address,address,address,address)",
                config.entryFee,
                config.maxTickets,
                config.drawInterval,
                config.maxRounds,
                config.creatorFeeRate,
                msg.sender,
                address(agentRegistry),
                drawManager,
                prizePool,
                address(this),
                eligibilityVerifier,
                ticketVerifier,
                claimVerifier,
                poseidonHasher
            )
        );
        require(success, "Lottery initialization failed");

        lotteries.push(lottery);
        lotteryExists[lottery] = true;

        emit LotteryCreated(
            lottery,
            msg.sender,
            config.entryFee,
            config.maxTickets,
            config.drawInterval
        );

        return lottery;
    }

    /// @inheritdoc ILotteryFactory
    function getLotteries(
        uint256 offset,
        uint256 limit
    ) external view override returns (address[] memory) {
        uint256 total = lotteries.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = lotteries[offset + i];
        }
        return result;
    }

    /// @inheritdoc ILotteryFactory
    function getLotteryCount() external view override returns (uint256) {
        return lotteries.length;
    }

    /// @inheritdoc ILotteryFactory
    function isLottery(address addr) external view override returns (bool) {
        return lotteryExists[addr];
    }

    /// @inheritdoc ILotteryFactory
    function getProtocolFeeRate() external view override returns (uint16) {
        return protocolFeeRate;
    }

    // --- Admin ---

    function setImplementation(address _implementation) external onlyOwner {
        implementation = _implementation;
        emit ImplementationUpdated(_implementation);
    }

    function setProtocolFeeRate(uint16 _rate) external onlyOwner {
        protocolFeeRate = _rate;
        emit ProtocolFeeRateUpdated(_rate);
    }

    function setEntryFeeBounds(uint256 _min, uint256 _max) external onlyOwner {
        minEntryFee = _min;
        maxEntryFee = _max;
    }

    function setDrawIntervalBounds(uint32 _min, uint32 _max) external onlyOwner {
        minDrawInterval = _min;
        maxDrawInterval = _max;
    }

    function setVerifiers(
        address _eligibility,
        address _ticket,
        address _claim
    ) external onlyOwner {
        eligibilityVerifier = _eligibility;
        ticketVerifier = _ticket;
        claimVerifier = _claim;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
