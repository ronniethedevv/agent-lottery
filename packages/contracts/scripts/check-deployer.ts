import { ethers, network } from "hardhat";

/**
 * Read-only preflight: confirms the deployer key is loaded and the wallet is
 * funded on the target network. Sends no transaction; prints only the public
 * address and balance (never the private key).
 */
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.error("✗ No signer — DEPLOYER_PRIVATE_KEY is not being loaded.");
    process.exit(1);
  }
  const [deployer] = signers;
  const balance = await ethers.provider.getBalance(deployer.address);
  const net = await ethers.provider.getNetwork();

  console.log(`Network:  ${network.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} BNB`);

  if (balance === 0n) {
    console.warn("⚠ Balance is 0 — fund this address with testnet BNB before deploying.");
  } else {
    console.log("✓ Key loaded and wallet funded — ready to deploy.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
