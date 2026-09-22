// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice snarkjs-generated Groth16 verifiers expose a `verifyProof` whose last
///         argument is a FIXED-size public-signals array (its length = the number
///         of public inputs of that circuit). These typed interfaces match the
///         generated contracts so the Lottery can call them directly.

/// Eligibility and claim circuits: 5 public inputs.
interface IGroth16Verifier5 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata input
    ) external view returns (bool);
}

/// Ticket circuit: 2 public inputs.
interface IGroth16Verifier2 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external view returns (bool);
}

/// Claim circuit: 6 public inputs (root, nullifierHash, lotteryId, roundId,
/// recipient, leafIndex).
interface IGroth16Verifier6 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[6] calldata input
    ) external view returns (bool);
}
