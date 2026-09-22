import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const lotteryImpl = await deployments.get("Lottery");
  const registry = await deployments.get("AgentRegistry");
  const drawManager = await deployments.get("DrawManager");
  const prizePool = await deployments.get("PrizePool");
  const eligibilityVerifier = await deployments.get("EligibilityVerifier");
  const ticketVerifier = await deployments.get("TicketVerifier");
  const claimVerifier = await deployments.get("ClaimVerifier");
  const poseidon = await deployments.get("PoseidonT3");

  const factory = await deploy("LotteryFactory", {
    from: deployer,
    args: [
      lotteryImpl.address,
      registry.address,
      drawManager.address,
      prizePool.address,
      eligibilityVerifier.address,
      ticketVerifier.address,
      claimVerifier.address,
      poseidon.address,
    ],
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 0 : 3,
  });

  // Wire cross-references: DrawManager and PrizePool need the factory address
  const DrawManager = await hre.ethers.getContractAt("DrawManager", drawManager.address);
  const tx1 = await DrawManager.setFactory(factory.address);
  await tx1.wait();
  console.log("  DrawManager: factory set to", factory.address);

  const PrizePool = await hre.ethers.getContractAt("PrizePool", prizePool.address);
  const tx2 = await PrizePool.setFactory(factory.address);
  await tx2.wait();
  console.log("  PrizePool: factory set to", factory.address);
};

func.tags = ["LotteryFactory"];
func.dependencies = ["AgentRegistry", "Verifiers", "LotteryImpl", "DrawManager", "PrizePool", "Poseidon"];
export default func;
