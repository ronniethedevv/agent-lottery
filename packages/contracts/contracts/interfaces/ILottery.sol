// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILottery {
    enum RoundStatus {
        Open,
        Drawing,
        Claimable,
        Settled
    }

    struct RoundState {
        uint256 prizePool;
        uint32 ticketCount;
        bytes32 merkleRoot;
        uint32 winnerIndex;
        bool claimed;
        RoundStatus status;
        uint64 startedAt;
        uint64 drawnAt;
    }

    event TicketPurchased(
        uint256 indexed roundId,
        bytes32 indexed commitment,
        uint32 leafIndex
    );

    event DrawRequested(uint256 indexed roundId, uint256 vrfRequestId);

    event WinnerSelected(
        uint256 indexed roundId,
        uint32 winnerIndex,
        uint256 prizeAmount
    );

    event PrizeClaimed(
        uint256 indexed roundId,
        bytes32 nullifierHash,
        address recipient,
        uint256 amount
    );

    event RoundAdvanced(uint256 indexed newRoundId);

    function enterWithProof(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[] calldata eligibilityPublicInputs,
        uint256[2] calldata ticketProofA,
        uint256[2][2] calldata ticketProofB,
        uint256[2] calldata ticketProofC,
        uint256[] calldata ticketPublicInputs
    ) external payable;

    function triggerDraw() external;

    function claimPrize(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[] calldata publicInputs
    ) external;

    function settleDraw(uint256 roundId, uint32 winnerIndex) external;

    function getCurrentRound() external view returns (uint256);
    function getRoundState(uint256 roundId) external view returns (RoundState memory);
    function getEntryFee() external view returns (uint256);
    function getMaxTickets() external view returns (uint32);
}
