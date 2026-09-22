pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "./lib/merkleProof.circom";

// Proves ownership of a ticket in the lottery's Merkle tree,
// enabling the winner to claim their prize.
//
// The agent proves:
//   1. They know (secret, nullifier) whose hash is a leaf in the tree.
//   2. The leaf exists at the winning position in the Merkle tree with the given root.
//   3. The nullifierHash is correctly derived (published to prevent double-claims).
//
// The recipient address is a public input so the contract sends the prize there.
template Claim(depth) {
    // --- Private inputs ---
    signal input secret;
    signal input nullifier;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // --- Public inputs ---
    signal input root;
    signal input nullifierHash;
    signal input lotteryId;
    signal input roundId;
    signal input recipient;
    signal input leafIndex; // must equal the VRF-drawn winning index (checked on-chain)

    // 1. Compute leaf = Poseidon(secret, nullifier)
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== secret;
    leafHasher.inputs[1] <== nullifier;
    signal leaf;
    leaf <== leafHasher.out;

    // 2. Verify Merkle inclusion
    component merkle = MerkleProof(depth);
    merkle.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }
    root === merkle.root;

    // 2b. Bind the leaf's position: leafIndex must equal the bits in pathIndices
    // (bit i of the index = pathIndices[i]). The contract then checks that this
    // equals the VRF-drawn winnerIndex, so only the actual winner can claim.
    signal idxAcc[depth + 1];
    idxAcc[0] <== 0;
    for (var i = 0; i < depth; i++) {
        idxAcc[i + 1] <== idxAcc[i] + pathIndices[i] * (2 ** i);
    }
    leafIndex === idxAcc[depth];

    // 3. Verify nullifier hash
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash === nullifierHasher.out;

    // Bind to lottery and round
    signal lotteryIdSquare;
    lotteryIdSquare <== lotteryId * lotteryId;
    signal roundIdSquare;
    roundIdSquare <== roundId * roundId;

    // Bind to recipient
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

component main { public [root, nullifierHash, lotteryId, roundId, recipient, leafIndex] } = Claim(20);
