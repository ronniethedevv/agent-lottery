// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoseidonT3} from "../interfaces/IPoseidonT3.sol";

/// @title MerkleTreeWithHistory
/// @notice Incremental Merkle tree with Poseidon hashing and root history.
/// @dev Based on the Tornado Cash / Semaphore incremental Merkle tree pattern.
///      Hashing is delegated to an external Poseidon(2) contract whose output
///      matches the Circom circuits, so proofs verify against on-chain roots.
///
///      Clone-safe: EIP-1167 clones do not run this constructor, so all tree
///      state is initialized in `_initializeTree()`, which the inheriting
///      contract calls from its `initialize()`.
abstract contract MerkleTreeWithHistory {
    uint32 public constant TREE_DEPTH = 20;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    uint256 public constant ZERO_VALUE = 0;

    IPoseidonT3 public hasher;

    uint32 public nextLeafIndex;
    uint256[ROOT_HISTORY_SIZE] public roots;
    uint32 public currentRootIndex;

    // filledSubtrees[i] holds the latest hash on the left edge at level i
    uint256[TREE_DEPTH] public filledSubtrees;
    // zeros[i] holds the zero-subtree hash at level i
    uint256[TREE_DEPTH] public zeros;
    // root of a fully-empty tree (used to reset each round cheaply)
    uint256 public initialRoot;

    error MerkleTreeFull();
    error HasherNotSet();

    function _setHasher(address _hasher) internal {
        hasher = IPoseidonT3(_hasher);
    }

    function _hashLeftRight(uint256 left, uint256 right) internal view returns (uint256) {
        return hasher.poseidon([left, right]);
    }

    /// @notice Precompute the zero hashes and the empty-tree root. Call once,
    ///         after the hasher is set, from the inheriting contract's init.
    function _initializeTree() internal {
        if (address(hasher) == address(0)) revert HasherNotSet();

        uint256 currentZero = ZERO_VALUE;
        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = currentZero;
            filledSubtrees[i] = currentZero;
            currentZero = _hashLeftRight(currentZero, currentZero);
        }

        initialRoot = currentZero;
        roots[0] = currentZero;
        currentRootIndex = 0;
        nextLeafIndex = 0;
    }

    /// @notice Reset the tree to empty for a new round. Cheap — reuses the
    ///         precomputed zeros, no hashing.
    function _resetTree() internal {
        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            filledSubtrees[i] = zeros[i];
        }
        nextLeafIndex = 0;
        currentRootIndex = 0;
        roots[0] = initialRoot;
    }

    /// @notice Insert a leaf into the tree
    /// @param leaf The leaf value to insert
    /// @return index The index of the inserted leaf
    function _insert(uint256 leaf) internal returns (uint32 index) {
        uint32 _nextLeafIndex = nextLeafIndex;
        if (_nextLeafIndex >= uint32(2) ** TREE_DEPTH) revert MerkleTreeFull();

        uint32 currentIndex = _nextLeafIndex;
        uint256 currentHash = leaf;
        uint256 left;
        uint256 right;

        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentHash;
                right = zeros[i];
                filledSubtrees[i] = currentHash;
            } else {
                left = filledSubtrees[i];
                right = currentHash;
            }

            currentHash = _hashLeftRight(left, right);
            currentIndex /= 2;
        }

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentHash;
        nextLeafIndex = _nextLeafIndex + 1;

        return _nextLeafIndex;
    }

    /// @notice Check if a root exists in the history
    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;

        uint32 i = currentRootIndex;
        do {
            if (roots[i] == root) return true;
            if (i == 0) {
                i = ROOT_HISTORY_SIZE - 1;
            } else {
                i--;
            }
        } while (i != currentRootIndex);

        return false;
    }

    /// @notice Get the current Merkle root
    function getLastRoot() public view returns (uint256) {
        return roots[currentRootIndex];
    }
}
