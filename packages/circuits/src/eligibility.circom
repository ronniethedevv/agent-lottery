pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./lib/strategyVerifier.circom";

// Proves an agent satisfies lottery entry conditions without revealing
// their balance, strategy type, or strategy parameters.
//
// The agent proves:
//   1. They have sufficient balance to cover the entry fee.
//   2. Their private strategy evaluates to "enter" given public lottery state.
//   3. The agentCommitment matches Poseidon(agentSecret) — binding the proof to a specific agent.
template Eligibility() {
    // --- Private inputs ---
    signal input balance;
    signal input strategyType;
    signal input strategyThreshold;
    signal input strategyThreshold2;
    signal input agentSecret;

    // --- Public inputs ---
    signal input lotteryId;
    signal input minEntryFee;
    signal input jackpotSize;
    signal input participantCount;
    signal input agentCommitment;

    // 1. Verify balance >= minEntryFee
    component balanceCheck = GreaterEqThan(252);
    balanceCheck.in[0] <== balance;
    balanceCheck.in[1] <== minEntryFee;
    balanceCheck.out === 1;

    // 2. Verify strategy is satisfied
    component strategy = StrategyVerifier();
    strategy.strategyType <== strategyType;
    strategy.strategyThreshold <== strategyThreshold;
    strategy.strategyThreshold2 <== strategyThreshold2;
    strategy.jackpotSize <== jackpotSize;
    strategy.participantCount <== participantCount;
    strategy.satisfied === 1;

    // 3. Verify agent identity commitment
    component hasher = Poseidon(1);
    hasher.inputs[0] <== agentSecret;
    agentCommitment === hasher.out;

    // Constrain lotteryId to prevent proof reuse across lotteries
    signal lotteryIdSquare;
    lotteryIdSquare <== lotteryId * lotteryId;
}

component main { public [lotteryId, minEntryFee, jackpotSize, participantCount, agentCommitment] } = Eligibility();
