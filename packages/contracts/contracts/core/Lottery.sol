// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ILottery} from "../interfaces/ILottery.sol";
import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";
import {IDrawManager} from "../interfaces/IDrawManager.sol";
import {IPrizePool} from "../interfaces/IPrizePool.sol";
import {ILotteryFactory} from "../interfaces/ILotteryFactory.sol";
import {IGroth16Verifier5, IGroth16Verifier2, IGroth16Verifier6} from "../interfaces/IGroth16Verifier.sol";
import {MerkleTreeWithHistory} from "../libraries/MerkleTreeWithHistory.sol";

/// @title Lottery
/// @notice Individual lottery instance with ZK-private ticket commitments.
/// @dev Deployed as an EIP-1167 minimal proxy clone. Each lottery runs independent
///      rounds with its own Merkle tree. Agents enter by submitting ZK proofs of
///      eligibility and ticket commitments. VRF selects the winner. The winner
///      claims by proving ticket ownership via a Merkle inclusion proof.
///
///      State machine per round:
///        Open → Drawing → Claimable → Settled → (next round auto-opens)
contract Lottery is ILottery, MerkleTreeWithHistory, ReentrancyGuard {
    // Immutable config (set once via initialize, since this is a clone)
    uint256 public entryFee;
    uint32 public maxTickets;
    uint32 public drawInterval; // seconds between round start and draw eligibility
    uint32 public maxRounds;    // 0 = infinite
    uint16 public creatorFeeRate;
    address public creator;

    // External contracts
    IAgentRegistry public agentRegistry;
    IDrawManager public drawManager;
    IPrizePool public prizePool;
    ILotteryFactory public factory;

    // ZK verifier contracts
    address public eligibilityVerifier;
    address public ticketVerifier;
    address public claimVerifier;

    // Round state
    uint256 public currentRound;
    mapping(uint256 => RoundState) public rounds;

    // Nullifier tracking (prevents double-claims)
    mapping(bytes32 => bool) public nullifierUsed;

    // Per-round commitment tracking (prevents duplicate commitments)
    mapping(uint256 => mapping(bytes32 => bool)) public commitmentUsed;

    // Agent entry tracking (max 1 ticket per agent per round)
    mapping(uint256 => mapping(bytes32 => bool)) public agentEnteredRound;

    bool private initialized;

    error AlreadyInitialized();
    error NotRegisteredAgent();
    error RoundNotOpen();
    error RoundNotClaimable();
    error IncorrectEntryFee();
    error MaxTicketsReached();
    error DrawTooEarly();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error CommitmentAlreadyUsed();
    error AgentAlreadyEntered();
    error NotDrawManager();
    error LotteryEnded();
    error NoTickets();
    error NotWinner();

    /// @dev Lock the implementation so only clones (via the factory) can be initialized.
    constructor() {
        initialized = true;
    }

    /// @notice Initialize the lottery (called once by factory after cloning)
    function initialize(
        uint256 _entryFee,
        uint32 _maxTickets,
        uint32 _drawInterval,
        uint32 _maxRounds,
        uint16 _creatorFeeRate,
        address _creator,
        address _agentRegistry,
        address _drawManager,
        address _prizePool,
        address _factory,
        address _eligibilityVerifier,
        address _ticketVerifier,
        address _claimVerifier,
        address _hasher
    ) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        entryFee = _entryFee;
        maxTickets = _maxTickets;
        drawInterval = _drawInterval;
        maxRounds = _maxRounds;
        creatorFeeRate = _creatorFeeRate;
        creator = _creator;

        agentRegistry = IAgentRegistry(_agentRegistry);
        drawManager = IDrawManager(_drawManager);
        prizePool = IPrizePool(_prizePool);
        factory = ILotteryFactory(_factory);

        eligibilityVerifier = _eligibilityVerifier;
        ticketVerifier = _ticketVerifier;
        claimVerifier = _claimVerifier;

        // Set up the Poseidon-backed Merkle tree for this clone
        _setHasher(_hasher);
        _initializeTree();

        // Start round 1
        currentRound = 1;
        rounds[1].status = RoundStatus.Open;
        rounds[1].startedAt = uint64(block.timestamp);

        emit RoundAdvanced(1);
    }

    /// @inheritdoc ILottery
    function enterWithProof(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[] calldata eligibilityPublicInputs,
        uint256[2] calldata ticketProofA,
        uint256[2][2] calldata ticketProofB,
        uint256[2] calldata ticketProofC,
        uint256[] calldata ticketPublicInputs
    ) external payable override nonReentrant {
        if (!agentRegistry.isRegistered(msg.sender)) revert NotRegisteredAgent();
        if (msg.value != entryFee) revert IncorrectEntryFee();

        uint256 roundId = currentRound;
        RoundState storage round = rounds[roundId];

        if (round.status != RoundStatus.Open) revert RoundNotOpen();
        if (round.ticketCount >= maxTickets) revert MaxTicketsReached();

        // Verify eligibility proof
        // Public inputs: [lotteryId, minEntryFee, jackpotSize, participantCount, agentCommitment]
        if (!_verify5(eligibilityVerifier, proofA, proofB, proofC, eligibilityPublicInputs)) {
            revert InvalidProof();
        }

        // Check agent hasn't already entered this round (using agentCommitment)
        bytes32 agentCommitmentHash = bytes32(eligibilityPublicInputs[4]);
        if (agentEnteredRound[roundId][agentCommitmentHash]) revert AgentAlreadyEntered();
        agentEnteredRound[roundId][agentCommitmentHash] = true;

        // Verify ticket commitment proof
        // Public inputs: [commitment, lotteryId]
        if (!_verify2(ticketVerifier, ticketProofA, ticketProofB, ticketProofC, ticketPublicInputs)) {
            revert InvalidProof();
        }

        bytes32 commitment = bytes32(ticketPublicInputs[0]);
        if (commitmentUsed[roundId][commitment]) revert CommitmentAlreadyUsed();
        commitmentUsed[roundId][commitment] = true;

        // Insert commitment into Merkle tree
        uint32 leafIndex = _insert(uint256(commitment));

        // Deposit entry fee into prize pool
        prizePool.deposit{value: msg.value}(roundId);

        round.ticketCount++;
        round.prizePool += msg.value;
        round.merkleRoot = bytes32(getLastRoot());

        emit TicketPurchased(roundId, commitment, leafIndex);
    }

    /// @inheritdoc ILottery
    function triggerDraw() external override {
        uint256 roundId = currentRound;
        RoundState storage round = rounds[roundId];

        if (round.status != RoundStatus.Open) revert RoundNotOpen();
        if (round.ticketCount == 0) revert NoTickets();

        bool timeElapsed = block.timestamp >= round.startedAt + drawInterval;
        bool maxReached = round.ticketCount >= maxTickets;

        if (!timeElapsed && !maxReached) revert DrawTooEarly();

        round.status = RoundStatus.Drawing;
        round.merkleRoot = bytes32(getLastRoot());

        uint256 requestId = drawManager.requestDraw(
            address(this),
            roundId,
            round.ticketCount
        );

        emit DrawRequested(roundId, requestId);
    }

    /// @notice Callback from DrawManager after VRF fulfillment
    /// @param roundId The round being settled
    /// @param winnerIndex The winning ticket index
    function settleDraw(uint256 roundId, uint32 winnerIndex) external {
        if (msg.sender != address(drawManager)) revert NotDrawManager();

        RoundState storage round = rounds[roundId];
        round.status = RoundStatus.Claimable;
        round.winnerIndex = winnerIndex;
        round.drawnAt = uint64(block.timestamp);

        prizePool.markClaimable(roundId);

        emit WinnerSelected(roundId, winnerIndex, round.prizePool);
    }

    /// @inheritdoc ILottery
    function claimPrize(
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC,
        uint256[] calldata publicInputs
    ) external override nonReentrant {
        // Public inputs: [root, nullifierHash, lotteryId, roundId, recipient, leafIndex]
        uint256 roundId = publicInputs[3];
        RoundState storage round = rounds[roundId];

        if (round.status != RoundStatus.Claimable) revert RoundNotClaimable();

        // The proof binds the claimed ticket's position; only the VRF-drawn
        // winner can claim.
        if (publicInputs[5] != round.winnerIndex) revert NotWinner();

        bytes32 nullifierHash = bytes32(publicInputs[1]);
        if (nullifierUsed[nullifierHash]) revert NullifierAlreadyUsed();

        // Verify the Merkle root is known
        uint256 root = publicInputs[0];
        if (!isKnownRoot(root)) revert InvalidProof();

        // Verify claim proof
        if (!_verify6(claimVerifier, proofA, proofB, proofC, publicInputs)) {
            revert InvalidProof();
        }

        nullifierUsed[nullifierHash] = true;
        round.claimed = true;
        round.status = RoundStatus.Settled;

        address recipient = address(uint160(publicInputs[4]));
        prizePool.payPrize(roundId, recipient);

        emit PrizeClaimed(roundId, nullifierHash, recipient, round.prizePool);

        // Advance to next round if applicable
        _advanceRound();
    }

    function _advanceRound() internal {
        if (maxRounds > 0 && currentRound >= maxRounds) {
            return; // Lottery is finished
        }

        uint256 nextRoundId = currentRound + 1;
        currentRound = nextRoundId;

        rounds[nextRoundId].status = RoundStatus.Open;
        rounds[nextRoundId].startedAt = uint64(block.timestamp);

        // Reset Merkle tree for the new round
        _resetTree();

        emit RoundAdvanced(nextRoundId);
    }

    /// @dev Verify a proof against a 5-public-input verifier (eligibility, claim).
    ///      Converts the dynamic public inputs to the fixed-size array the
    ///      snarkjs-generated verifier expects. A malformed input reverting in
    ///      the verifier is treated as an invalid proof, not a failed tx.
    function _verify5(
        address verifier,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs
    ) internal view returns (bool) {
        if (publicInputs.length != 5) return false;
        uint256[5] memory fixedInputs;
        for (uint256 i = 0; i < 5; i++) fixedInputs[i] = publicInputs[i];

        try IGroth16Verifier5(verifier).verifyProof(a, b, c, fixedInputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    /// @dev Verify a proof against a 6-public-input verifier (claim).
    function _verify6(
        address verifier,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs
    ) internal view returns (bool) {
        if (publicInputs.length != 6) return false;
        uint256[6] memory fixedInputs;
        for (uint256 i = 0; i < 6; i++) fixedInputs[i] = publicInputs[i];

        try IGroth16Verifier6(verifier).verifyProof(a, b, c, fixedInputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    /// @dev Verify a proof against a 2-public-input verifier (ticket).
    function _verify2(
        address verifier,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[] calldata publicInputs
    ) internal view returns (bool) {
        if (publicInputs.length != 2) return false;
        uint256[2] memory fixedInputs = [publicInputs[0], publicInputs[1]];

        try IGroth16Verifier2(verifier).verifyProof(a, b, c, fixedInputs) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    // --- View functions ---

    /// @inheritdoc ILottery
    function getCurrentRound() external view override returns (uint256) {
        return currentRound;
    }

    /// @inheritdoc ILottery
    function getRoundState(uint256 roundId) external view override returns (RoundState memory) {
        return rounds[roundId];
    }

    /// @inheritdoc ILottery
    function getEntryFee() external view override returns (uint256) {
        return entryFee;
    }

    /// @inheritdoc ILottery
    function getMaxTickets() external view override returns (uint32) {
        return maxTickets;
    }

    function getDrawInterval() external view returns (uint32) {
        return drawInterval;
    }

    function getCreator() external view returns (address) {
        return creator;
    }

    function isRoundDrawable() external view returns (bool) {
        RoundState storage round = rounds[currentRound];
        if (round.status != RoundStatus.Open) return false;
        if (round.ticketCount == 0) return false;

        bool timeElapsed = block.timestamp >= round.startedAt + drawInterval;
        bool maxReached = round.ticketCount >= maxTickets;

        return timeElapsed || maxReached;
    }

    receive() external payable {}
}
