import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { writeFileSync } from "fs";
import { join } from "path";

/**
 * Consolidate the per-contract hardhat-deploy artifacts into a single
 * deployments.json that the agent SDK and off-chain services consume.
 *
 * hardhat-deploy writes deployments/<network>/<Contract>.json; the agent
 * runtime expects one flat { name: address } file at the contracts package
 * root. This script bridges the two and also prints an env block for the
 * backend indexer and frontend.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;

  const get = async (name: string) => (await deployments.get(name)).address;

  const addresses = {
    agentRegistry: await get("AgentRegistry"),
    lotteryFactory: await get("LotteryFactory"),
    drawManager: await get("DrawManager"),
    prizePool: await get("PrizePool"),
    eligibilityVerifier: await get("EligibilityVerifier"),
    ticketVerifier: await get("TicketVerifier"),
    claimVerifier: await get("ClaimVerifier"),
    lotteryImplementation: await get("Lottery"),
  };

  const outPath = join(__dirname, "..", "deployments.json");
  writeFileSync(outPath, JSON.stringify(addresses, null, 2) + "\n");

  const blockNumber = await hre.ethers.provider.getBlockNumber();

  console.log("\n=== Deployment addresses ===");
  console.log(`  Written to: ${outPath}`);
  console.table(addresses);
  console.log("\n=== Env block for the backend indexer (copy into .env) ===");
  console.log(`LOTTERY_FACTORY_ADDRESS=${addresses.lotteryFactory}`);
  console.log(`AGENT_REGISTRY_ADDRESS=${addresses.agentRegistry}`);
  console.log(`INDEX_START_BLOCK=${blockNumber}`);
  console.log("");
};

func.tags = ["ExportAddresses"];
func.runAtTheEnd = true;
export default func;
