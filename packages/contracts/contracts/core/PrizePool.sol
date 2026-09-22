// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPrizePool} from "../interfaces/IPrizePool.sol";

/// @title PrizePool
/// @notice Manages prize funds for all lotteries with per-lottery-round accounting.
/// @dev Entry fees are deposited here. On settlement, prizes are distributed with
///      fee splits to the lottery creator and protocol. Unclaimed prizes can be
///      redistributed to subsequent rounds after a timeout.
contract PrizePool is IPrizePool, Ownable2Step, ReentrancyGuard, Pausable {
    struct RoundBalance {
        uint256 total;
        bool paid;
    }

    // lottery address => round id => balance
    mapping(address => mapping(uint256 => RoundBalance)) public balances;

    address public factory;
    address public protocolTreasury;
    uint16 public protocolFeeRate; // basis points

    uint256 public constant CLAIM_TIMEOUT = 48 hours;
    uint256 public constant EMERGENCY_DELAY = 72 hours;

    // lottery => round => timestamp when claimable period started
    mapping(address => mapping(uint256 => uint64)) public claimableAt;

    error OnlyFactory();
    error OnlyLottery();
    error AlreadyPaid();
    error NotClaimable();
    error InsufficientBalance();
    error TransferFailed();
    error ClaimNotTimedOut();

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(
        address _factory,
        address _protocolTreasury,
        uint16 _protocolFeeRate
    ) Ownable(msg.sender) {
        factory = _factory;
        protocolTreasury = _protocolTreasury;
        protocolFeeRate = _protocolFeeRate;
    }

    /// @inheritdoc IPrizePool
    function deposit(uint256 roundId) external payable override whenNotPaused {
        balances[msg.sender][roundId].total += msg.value;
        emit Deposited(msg.sender, roundId, msg.value);
    }

    /// @notice Mark a round as claimable (called by lottery after draw)
    function markClaimable(uint256 roundId) external {
        claimableAt[msg.sender][roundId] = uint64(block.timestamp);
    }

    /// @inheritdoc IPrizePool
    function payPrize(
        uint256 roundId,
        address recipient
    ) external override nonReentrant whenNotPaused {
        RoundBalance storage bal = balances[msg.sender][roundId];
        if (bal.paid) revert AlreadyPaid();
        if (bal.total == 0) revert InsufficientBalance();

        bal.paid = true;

        uint256 total = bal.total;
        uint256 protocolFee = (total * protocolFeeRate) / 10000;
        uint256 prize = total - protocolFee;

        // Pay prize to winner
        (bool success, ) = recipient.call{value: prize}("");
        if (!success) revert TransferFailed();

        // Pay protocol fee
        if (protocolFee > 0) {
            (bool feeSuccess, ) = protocolTreasury.call{value: protocolFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit PrizePaid(msg.sender, roundId, recipient, prize);
        emit FeesPaid(msg.sender, roundId, address(0), 0, protocolFee);
    }

    /// @inheritdoc IPrizePool
    function redistributeUnclaimed(
        uint256 fromRound,
        uint256 toRound
    ) external override nonReentrant {
        uint64 claimStart = claimableAt[msg.sender][fromRound];
        if (claimStart == 0) revert NotClaimable();
        if (block.timestamp < claimStart + CLAIM_TIMEOUT) revert ClaimNotTimedOut();

        RoundBalance storage fromBal = balances[msg.sender][fromRound];
        if (fromBal.paid || fromBal.total == 0) revert InsufficientBalance();

        uint256 amount = fromBal.total;
        fromBal.total = 0;
        fromBal.paid = true;

        balances[msg.sender][toRound].total += amount;

        emit UnclaimedRedistributed(msg.sender, fromRound, toRound, amount);
    }

    /// @inheritdoc IPrizePool
    function getBalance(
        address lottery,
        uint256 roundId
    ) external view override returns (uint256) {
        return balances[lottery][roundId].total;
    }

    /// @inheritdoc IPrizePool
    function getPrizeAmount(
        address lottery,
        uint256 roundId
    ) external view override returns (uint256) {
        uint256 total = balances[lottery][roundId].total;
        uint256 fee = (total * protocolFeeRate) / 10000;
        return total - fee;
    }

    // --- Admin ---

    function setFactory(address _factory) external onlyOwner {
        factory = _factory;
    }

    function setProtocolTreasury(address _treasury) external onlyOwner {
        protocolTreasury = _treasury;
    }

    function setProtocolFeeRate(uint16 _rate) external onlyOwner {
        protocolFeeRate = _rate;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
