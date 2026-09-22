import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO_HASH = "0x" + "0".repeat(64);

// Verified Chainlink VRF 2.5 values (docs.chain.link/vrf/v2-5/supported-networks).
// Env vars override these; mainnet must be supplied via env until verified here.
const DEFAULTS: Record<string, { coordinator: string; keyHash: string }> = {
  bscTestnet: {
    coordinator: "0xDA3b641D438362C440Ac5458c57e00a712b66700",
    keyHash: "0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26",
  },
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName = hre.network.name;
  const isLocal = networkName === "hardhat" || networkName === "localhost";
  const isTestnet = networkName === "bscTestnet";

  const def = DEFAULTS[networkName] ?? { coordinator: ZERO_ADDR, keyHash: ZERO_HASH };
  const coordinator = process.env[isTestnet ? "VRF_COORDINATOR_TESTNET" : "VRF_COORDINATOR"] || def.coordinator;
  const keyHash = process.env[isTestnet ? "VRF_KEY_HASH_TESTNET" : "VRF_KEY_HASH"] || def.keyHash;
  const subscriptionId = BigInt(
    process.env[isTestnet ? "VRF_SUBSCRIPTION_ID_TESTNET" : "VRF_SUBSCRIPTION_ID"] || "0"
  );

  if (!isLocal && subscriptionId === 0n) {
    console.warn(
      `  ⚠ No VRF subscription id set for ${networkName} ` +
        `(set VRF_SUBSCRIPTION_ID${isTestnet ? "_TESTNET" : ""}). ` +
        `Deploying with subId 0 — draws will fail until you run scripts/set-vrf.ts.`
    );
  }

  const drawManager = await deploy("DrawManager", {
    from: deployer,
    args: [
      ZERO_ADDR, // factory set in step 006
      coordinator,
      keyHash,
      subscriptionId,
    ],
    log: true,
    waitConfirmations: isLocal ? 0 : 3,
  });

  if (isLocal) {
    const DrawManager = await hre.ethers.getContractAt("DrawManager", drawManager.address);
    await DrawManager.setMockMode(true);
    console.log("  DrawManager: mock mode enabled for local testing");
  }
};

func.tags = ["DrawManager"];
export default func;
