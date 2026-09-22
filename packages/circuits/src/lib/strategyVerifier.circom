pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Evaluates an agent's private strategy against public lottery state.
// Returns 1 if the strategy conditions are satisfied, 0 otherwise.
//
// Strategy types:
//   0 = AlwaysEnter (no condition)
//   1 = MinJackpot (jackpotSize >= threshold)
//   2 = MaxParticipants (participantCount <= threshold)
//   3 = ExpectedValue (jackpotSize >= threshold * participantCount) — simplified EV
//   4 = Composite (jackpotSize >= threshold AND participantCount <= threshold2)
template StrategyVerifier() {
    signal input strategyType;
    signal input strategyThreshold;
    signal input strategyThreshold2; // used only for composite (type 4)
    signal input jackpotSize;
    signal input participantCount;

    signal output satisfied;

    // Type 0: always satisfied
    signal isType0;
    component eqType0 = IsEqual();
    eqType0.in[0] <== strategyType;
    eqType0.in[1] <== 0;
    isType0 <== eqType0.out;

    // Type 1: jackpotSize >= threshold
    signal isType1;
    component eqType1 = IsEqual();
    eqType1.in[0] <== strategyType;
    eqType1.in[1] <== 1;
    isType1 <== eqType1.out;

    component gte1 = GreaterEqThan(252);
    gte1.in[0] <== jackpotSize;
    gte1.in[1] <== strategyThreshold;
    signal cond1;
    cond1 <== gte1.out;

    // Type 2: participantCount <= threshold (i.e., threshold >= participantCount)
    signal isType2;
    component eqType2 = IsEqual();
    eqType2.in[0] <== strategyType;
    eqType2.in[1] <== 2;
    isType2 <== eqType2.out;

    component gte2 = GreaterEqThan(252);
    gte2.in[0] <== strategyThreshold;
    gte2.in[1] <== participantCount;
    signal cond2;
    cond2 <== gte2.out;

    // Type 3: jackpotSize >= threshold * participantCount (simplified EV check)
    signal isType3;
    component eqType3 = IsEqual();
    eqType3.in[0] <== strategyType;
    eqType3.in[1] <== 3;
    isType3 <== eqType3.out;

    signal evProduct;
    evProduct <== strategyThreshold * participantCount;
    component gte3 = GreaterEqThan(252);
    gte3.in[0] <== jackpotSize;
    gte3.in[1] <== evProduct;
    signal cond3;
    cond3 <== gte3.out;

    // Type 4: composite — jackpotSize >= threshold AND participantCount <= threshold2
    signal isType4;
    component eqType4 = IsEqual();
    eqType4.in[0] <== strategyType;
    eqType4.in[1] <== 4;
    isType4 <== eqType4.out;

    component gte4a = GreaterEqThan(252);
    gte4a.in[0] <== jackpotSize;
    gte4a.in[1] <== strategyThreshold;
    component gte4b = GreaterEqThan(252);
    gte4b.in[0] <== strategyThreshold2;
    gte4b.in[1] <== participantCount;
    signal cond4;
    cond4 <== gte4a.out * gte4b.out;

    // Aggregate: satisfied = isType0 + isType1*cond1 + ... Exactly one type is
    // active (enforced below). Each product needs its own signal — R1CS permits
    // only one multiplication per constraint, so the products can't be summed
    // inline in a single `<==`.
    signal term1;
    signal term2;
    signal term3;
    signal term4;
    term1 <== isType1 * cond1;
    term2 <== isType2 * cond2;
    term3 <== isType3 * cond3;
    term4 <== isType4 * cond4;

    signal result;
    result <== isType0 + term1 + term2 + term3 + term4;

    // Enforce exactly one type is selected
    signal typeSum;
    typeSum <== isType0 + isType1 + isType2 + isType3 + isType4;
    typeSum === 1;

    satisfied <== result;
}
