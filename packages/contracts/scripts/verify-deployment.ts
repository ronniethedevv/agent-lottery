import { ethers, network } from "hardhat";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Read-only sanity check of a live deployment: confirms the core contracts
 * respond, the cross-wiring is correct, and — importantly — that the DrawManager
 * has a real VRF subscription id and is NOT in mock mode. Sends no transaction.
 */
async function main() {
  const path = resolve(__dirname, "..", "deployments.json");
  if (!existsSync(path)) {
    console.error("deployments.json not found — deploy first.");
    process.exit(1);
  }
  const a = JSON.parse(readFileSync(path, "utf-8"));
  console.log(`Network: ${network.name}\n`);

  const factory = await ethers.getContractAt("LotteryFactory", a.lotteryFactory);
  const registry = await ethers.getContractAt("AgentRegistry", a.agentRegistry);
  const draw = await ethers.getContractAt("DrawManager", a.drawManager);

  const [lotteries, hasher, minStake, agents] = await Promise.all([
    factory.getLotteryCount(),
    factory.poseidonHasher(),
    registry.getMinStake(),
    registry.getAgentCount(),
  ]);
  const [mockMode, drawFactory, coordinator, subId] = await Promise.all([
    draw.mockMode(),
    draw.factory(),
    draw.vrfCoordinator(),
    draw.subscriptionId(),
  ]);

  console.log(`Factory        ${a.lotteryFactory}`);
  console.log(`  lotteries    ${lotteries}`);
  console.log(`  hasher       ${hasher}`);
  console.log(`Registry       ${a.agentRegistry}`);
  console.log(`  minStake     ${ethers.formatEther(minStake)} BNB`);
  console.log(`  agents       ${agents}`);
  console.log(`DrawManager    ${a.drawManager}`);
  console.log(`  mockMode     ${mockMode}`);
  console.log(`  factory      ${drawFactory}`);
  console.log(`  coordinator  ${coordinator}`);
  console.log(`  subId        ${subId}`);

  console.log("\n--- checks ---");
  const wired = drawFactory.toLowerCase() === a.lotteryFactory.toLowerCase();
  console.log(`${wired ? "✓" : "✗"} DrawManager wired to factory`);
  console.log(`${hasher !== ethers.ZeroAddress ? "✓" : "✗"} Poseidon hasher set`);
  console.log(`${!mockMode ? "✓" : "✗"} Real VRF mode (mockMode is false)`);
  if (subId === 0n) {
    console.log("✗ subscriptionId is 0 — draws will FAIL. Fix with DrawManager.setVRFConfig.");
  } else {
    console.log(`✓ subscriptionId set (${subId})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
