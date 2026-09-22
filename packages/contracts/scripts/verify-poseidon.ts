import { ethers } from "hardhat";
// @ts-ignore — circomlibjs ships no types
import { poseidonContract, buildPoseidon } from "circomlibjs";

/**
 * Proves the on-chain hasher (circomlib-generated Poseidon contract, deployed
 * exactly as the deploy pipeline deploys it) produces identical output to the
 * circomlibjs Poseidon the agent SDK uses. If these match, on-chain Merkle
 * roots agree with the roots proofs are generated against — the core of fix #1.
 */
async function main() {
  const [signer] = await ethers.getSigners();

  // Deploy the on-chain Poseidon(2) from circomlib bytecode (same as 000_deploy_poseidon)
  const abi = poseidonContract.generateABI(2);
  const bytecode = poseidonContract.createCode(2);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const onchain = await factory.deploy();
  await onchain.waitForDeployment();

  // Off-chain Poseidon (what packages/agent uses via circomlibjs)
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const cases: [bigint, bigint][] = [
    [0n, 0n],
    [1n, 2n],
    [123456789n, 987654321n],
    [
      21888242871839275222246405745257275088548364400416034343698204186575808495616n, // F - 1
      42n,
    ],
  ];

  let allMatch = true;
  for (const [a, b] of cases) {
    const off = F.toObject(poseidon([a, b])) as bigint;
    const on = (await onchain.getFunction("poseidon(uint256[2])")([a, b])) as bigint;
    const match = off === on;
    allMatch &&= match;
    console.log(`poseidon(${a}, ${b})`);
    console.log(`  off-chain (circomlibjs): ${off}`);
    console.log(`  on-chain  (contract):    ${on}`);
    console.log(`  match: ${match ? "✓" : "✗ MISMATCH"}\n`);
  }

  if (!allMatch) {
    throw new Error("Poseidon mismatch — on-chain hashing does NOT match the circuits!");
  }
  console.log("All cases match — on-chain Poseidon == circuit/agent Poseidon.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
