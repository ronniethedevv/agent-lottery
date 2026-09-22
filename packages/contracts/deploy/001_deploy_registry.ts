import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";

const MIN_STAKE = parseEther("0.1");
const DEREGISTRATION_COOLDOWN = 86400; // 24 hours

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("AgentRegistry", {
    from: deployer,
    args: [MIN_STAKE, DEREGISTRATION_COOLDOWN],
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 0 : 3,
  });
};

func.tags = ["AgentRegistry"];
export default func;
