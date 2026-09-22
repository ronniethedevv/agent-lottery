// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPoseidonT3
/// @notice Interface for a Poseidon(2) hasher over BN254.
/// @dev Implemented by the contract generated from circomlib's
///      `poseidonContract.createCode(2)` — its output matches the Poseidon
///      used inside the Circom circuits exactly, so on-chain Merkle roots agree
///      with proofs. Deployed once and shared by all lotteries.
interface IPoseidonT3 {
    function poseidon(uint256[2] calldata input) external view returns (uint256);
}
