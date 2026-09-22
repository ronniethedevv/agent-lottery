import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const PROTOCOL_FEE_RATE = 200; // 2%

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const protocolTreasury = process.env.PROTOCOL_TREASURY || deployer;

  await deploy("PrizePool", {
    from: deployer,
    args: [
      "0x0000000000000000000000000000000000000000", // factory set in step 006
      protocolTreasury,
      PROTOCOL_FEE_RATE,
    ],
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 0 : 3,
  });
};

func.tags = ["PrizePool"];
export default func;
