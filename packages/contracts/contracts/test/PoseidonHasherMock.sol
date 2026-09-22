// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoseidonT3} from "../interfaces/IPoseidonT3.sol";

/// @title PoseidonHasherMock
/// @notice Deterministic keccak-based stand-in for Poseidon(2), used ONLY in
///         tests so the on-chain Merkle tree is internally self-consistent
///         without deploying the real circom-generated hasher.
/// @dev This is NOT Poseidon and will NOT match the circuits. Never deploy it
///      to a real network — production uses the circomlib-generated contract.
contract PoseidonHasherMock is IPoseidonT3 {
    uint256 private constant F =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function poseidon(uint256[2] calldata input) external pure override returns (uint256) {
        return uint256(keccak256(abi.encode(input[0], input[1]))) % F;
    }
}
