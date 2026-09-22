// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDrawManager {
    event DrawRequested(
        uint256 indexed requestId,
        address indexed lottery,
        uint256 roundId,
        uint32 ticketCount
    );

    event DrawFulfilled(
        uint256 indexed requestId,
        address indexed lottery,
        uint256 roundId,
        uint256 randomWord,
        uint32 winnerIndex
    );

    function requestDraw(
        address lottery,
        uint256 roundId,
        uint32 ticketCount
    ) external returns (uint256 requestId);
}
