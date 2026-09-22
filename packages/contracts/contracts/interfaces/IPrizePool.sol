// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPrizePool {
    event Deposited(address indexed lottery, uint256 roundId, uint256 amount);
    event PrizePaid(address indexed lottery, uint256 roundId, address recipient, uint256 amount);
    event FeesPaid(address indexed lottery, uint256 roundId, address creator, uint256 creatorFee, uint256 protocolFee);
    event UnclaimedRedistributed(address indexed lottery, uint256 fromRound, uint256 toRound, uint256 amount);

    function deposit(uint256 roundId) external payable;
    function markClaimable(uint256 roundId) external;
    function payPrize(uint256 roundId, address recipient) external;
    function redistributeUnclaimed(uint256 fromRound, uint256 toRound) external;
    function getBalance(address lottery, uint256 roundId) external view returns (uint256);
    function getPrizeAmount(address lottery, uint256 roundId) external view returns (uint256);
}
