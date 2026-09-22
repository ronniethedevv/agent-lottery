// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IDrawManager} from "../interfaces/IDrawManager.sol";
import {ILottery} from "../interfaces/ILottery.sol";
import {ILotteryFactory} from "../interfaces/ILotteryFactory.sol";
import {IVRFCoordinatorV2Plus} from "./IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "./VRFV2PlusClient.sol";

/// @title DrawManager
/// @notice Manages VRF randomness requests for lottery draws.
/// @dev Integrates with Chainlink VRF V2.5 on BSC. When a lottery triggers a draw,
///      this contract requests a random word. On fulfillment, it computes the winner
///      index and calls back to the lottery to settle the round.
///
///      For local testing, the contract supports a mock mode where the owner can
///      directly fulfill requests with a provided random value.
contract DrawManager is IDrawManager, Ownable2Step {
    struct DrawRequest {
        address lottery;
        uint256 roundId;
        uint32 ticketCount;
        bool fulfilled;
    }

    ILotteryFactory public factory;

    // VRF configuration
    address public vrfCoordinator;
    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint16 public requestConfirmations;
    uint32 public callbackGasLimit;

    // Request tracking
    uint256 public nextRequestId;
    mapping(uint256 => DrawRequest) public drawRequests;

    // Mock mode for testing
    bool public mockMode;

    error OnlyLottery();
    error OnlyVRFCoordinator();
    error RequestNotFound();
    error AlreadyFulfilled();
    error ZeroTickets();

    constructor(
        address _factory,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) Ownable(msg.sender) {
        factory = ILotteryFactory(_factory);
        vrfCoordinator = _vrfCoordinator;
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        requestConfirmations = 3;
        callbackGasLimit = 200000;
        nextRequestId = 1;
    }

    /// @inheritdoc IDrawManager
    function requestDraw(
        address lottery,
        uint256 roundId,
        uint32 ticketCount
    ) external override returns (uint256 requestId) {
        if (!factory.isLottery(msg.sender)) revert OnlyLottery();
        if (ticketCount == 0) revert ZeroTickets();

        if (mockMode) {
            // Local/testing: use an internal sequential id fulfilled via mockFulfillDraw.
            requestId = nextRequestId++;
        } else {
            // Production: the coordinator assigns the id; we key the request by it so
            // the fulfillment callback resolves to the right draw.
            requestId = IVRFCoordinatorV2Plus(vrfCoordinator).requestRandomWords(
                VRFV2PlusClient.RandomWordsRequest({
                    keyHash: keyHash,
                    subId: subscriptionId,
                    requestConfirmations: requestConfirmations,
                    callbackGasLimit: callbackGasLimit,
                    numWords: 1,
                    extraArgs: VRFV2PlusClient._argsToBytes(
                        VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                    )
                })
            );
        }

        drawRequests[requestId] = DrawRequest({
            lottery: lottery,
            roundId: roundId,
            ticketCount: ticketCount,
            fulfilled: false
        });

        emit DrawRequested(requestId, lottery, roundId, ticketCount);
        return requestId;
    }

    /// @notice VRF callback — called by the VRF Coordinator with the random result
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external {
        if (!mockMode && msg.sender != vrfCoordinator) revert OnlyVRFCoordinator();

        _fulfillDraw(requestId, randomWords[0]);
    }

    /// @notice Mock fulfillment for testing
    function mockFulfillDraw(
        uint256 requestId,
        uint256 randomWord
    ) external onlyOwner {
        require(mockMode, "Not in mock mode");
        _fulfillDraw(requestId, randomWord);
    }

    function _fulfillDraw(uint256 requestId, uint256 randomWord) internal {
        DrawRequest storage request = drawRequests[requestId];
        if (request.lottery == address(0)) revert RequestNotFound();
        if (request.fulfilled) revert AlreadyFulfilled();

        request.fulfilled = true;
        uint32 winnerIndex = uint32(randomWord % request.ticketCount);

        // Call back to the lottery contract
        ILottery(request.lottery).settleDraw(request.roundId, winnerIndex);

        emit DrawFulfilled(requestId, request.lottery, request.roundId, randomWord, winnerIndex);
    }

    // --- Admin ---

    function setMockMode(bool _mockMode) external onlyOwner {
        mockMode = _mockMode;
    }

    function setVRFConfig(
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint16 _confirmations,
        uint32 _gasLimit
    ) external onlyOwner {
        vrfCoordinator = _coordinator;
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        requestConfirmations = _confirmations;
        callbackGasLimit = _gasLimit;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = ILotteryFactory(_factory);
    }
}
