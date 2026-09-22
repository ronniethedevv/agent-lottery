pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Creates a private ticket commitment.
//
// The agent generates a random (secret, nullifier) pair and proves
// that the public commitment is correctly derived from them.
//
// commitment = Poseidon(secret, nullifier)
//
// The secret is used to prove ownership later.
// The nullifier prevents double-claiming (its hash is revealed at claim time).
template Ticket() {
    // --- Private inputs ---
    signal input secret;
    signal input nullifier;

    // --- Public inputs ---
    signal input commitment;
    signal input lotteryId;

    // Verify commitment = Poseidon(secret, nullifier)
    component hasher = Poseidon(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== nullifier;
    commitment === hasher.out;

    // Bind to lottery to prevent cross-lottery replay
    signal lotteryIdSquare;
    lotteryIdSquare <== lotteryId * lotteryId;
}

component main { public [commitment, lotteryId] } = Ticket();
