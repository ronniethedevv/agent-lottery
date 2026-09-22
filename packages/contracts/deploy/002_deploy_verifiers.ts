import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const waitConfirmations = hre.network.name === "hardhat" ? 0 : 3;

  await deploy("EligibilityVerifier", {
    from: deployer,
    log: true,
    waitConfirmations,
  });

  await deploy("TicketVerifier", {
    from: deployer,
    log: true,
    waitConfirmations,
  });

  await deploy("ClaimVerifier", {
    from: deployer,
    log: true,
    waitConfirmations,
  });
};

func.tags = ["Verifiers"];
export default func;
