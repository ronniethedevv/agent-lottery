// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILotteryFactory {
    struct LotteryConfig {
        uint256 entryFee;
        uint32 maxTickets;
        uint32 drawInterval;
        uint32 maxRounds;    // 0 = infinite
        uint16 creatorFeeRate; // basis points (e.g., 300 = 3%)
    }

    event LotteryCreated(
        address indexed lottery,
        address indexed creator,
        uint256 entryFee,
        uint32 maxTickets,
        uint32 drawInterval
    );

    event ProtocolFeeRateUpdated(uint16 newRate);
    event ImplementationUpdated(address newImplementation);

    function createLottery(LotteryConfig calldata config) external returns (address);
    function getLotteries(uint256 offset, uint256 limit) external view returns (address[] memory);
    function getLotteryCount() external view returns (uint256);
    function isLottery(address addr) external view returns (bool);
    function getProtocolFeeRate() external view returns (uint16);
}
