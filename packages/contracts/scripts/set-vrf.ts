import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Owner-only fix: point the deployed DrawManager at the correct VRF 2.5
 * coordinator + key hash and set the subscription id. Reads the subscription id
 * from the environment (never hard-coded), and the coordinator/keyHash from the
 * authoritative Chainlink values below. Safe to re-run; reversible.
 */

// Authoritative Chainlink VRF 2.5 values (docs.chain.link/vrf/v2-5/supported-networks)
const VRF = {
  bscTestnet: {
    coordinator: "0xDA3b641D438362C440Ac5458c57e00a712b66700",
    keyHash: "0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26",
  },
} as const;

async function main() {
  const cfg = (VRF as Record<string, { coordinator: string; keyHash: string }>)[network.name];
  if (!cfg) {
    console.error(`No VRF values configured for network "${network.name}".`);
    process.exit(1);
  }

  const subIdRaw =
    process.env.VRF_SUBSCRIPTION_ID_TESTNET || process.env.VRF_SUBSCRIPTION_ID;
  if (!subIdRaw) {
    console.error("Set VRF_SUBSCRIPTION_ID_TESTNET in .env first.");
    process.exit(1);
  }
  const subId = BigInt(subIdRaw);
  if (subId === 0n) {
    console.error("Subscription id is 0 — put your real subscription id in .env.");
    process.exit(1);
  }

  const a = JSON.parse(readFileSync(resolve(__dirname, "..", "deployments.json"), "utf-8"));
  const draw = await ethers.getContractAt("DrawManager", a.drawManager);

  console.log(`Updating DrawManager ${a.drawManager} on ${network.name}`);
  console.log(`  coordinator: ${cfg.coordinator}`);
  console.log(`  keyHash:     ${cfg.keyHash}`);
  console.log(`  subId:       ${subId}`);
  console.log(`  confirmations: 3, callbackGasLimit: 500000\n`);

  const tx = await draw.setVRFConfig(cfg.coordinator, cfg.keyHash, subId, 3, 500000);
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();

  const [coordAfter, subAfter] = await Promise.all([
    draw.vrfCoordinator(),
    draw.subscriptionId(),
  ]);
  const ok =
    coordAfter.toLowerCase() === cfg.coordinator.toLowerCase() && subAfter === subId;
  console.log(`\n${ok ? "✓" : "✗"} DrawManager now → coordinator ${coordAfter}, subId ${subAfter}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
