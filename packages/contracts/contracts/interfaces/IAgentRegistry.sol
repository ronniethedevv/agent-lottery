// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentRegistry {
    struct AgentInfo {
        uint256 stake;
        uint256 reputation;
        uint64 registeredAt;
        bool isActive;
    }

    event AgentRegistered(address indexed agent, uint256 stake);
    event AgentDeregistered(address indexed agent, uint256 stakeReturned);
    event AgentSlashed(address indexed agent, uint256 amount, bytes32 reason);
    event ReputationUpdated(address indexed agent, uint256 newReputation);

    function registerAgent() external payable;
    function deregisterAgent() external;
    function slash(address agent, uint256 amount, bytes32 reason) external;
    function incrementReputation(address agent, uint256 amount) external;
    function isRegistered(address agent) external view returns (bool);
    function getAgentInfo(address agent) external view returns (AgentInfo memory);
    function getMinStake() external view returns (uint256);
    function getAgentCount() external view returns (uint256);
}
