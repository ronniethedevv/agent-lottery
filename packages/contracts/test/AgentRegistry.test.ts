import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const MIN_STAKE = ethers.parseEther("0.1");
const COOLDOWN = 86400; // 24 hours

describe("AgentRegistry", function () {
  async function deployFixture() {
    const [owner, agent1, agent2, agent3] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy(MIN_STAKE, COOLDOWN);
    return { registry, owner, agent1, agent2, agent3 };
  }

  describe("Registration", function () {
    it("should register an agent with sufficient stake", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);

      await expect(
        registry.connect(agent1).registerAgent({ value: MIN_STAKE })
      )
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, MIN_STAKE);

      expect(await registry.isRegistered(agent1.address)).to.be.true;
      expect(await registry.getAgentCount()).to.equal(1);
    });

    it("should reject registration with insufficient stake", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      const lowStake = ethers.parseEther("0.05");

      await expect(
        registry.connect(agent1).registerAgent({ value: lowStake })
      ).to.be.revertedWithCustomError(registry, "InsufficientStake");
    });

    it("should reject duplicate registration", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });

      await expect(
        registry.connect(agent1).registerAgent({ value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    });

    it("should allow extra stake above minimum", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);
      const extraStake = ethers.parseEther("1.0");

      await registry.connect(agent1).registerAgent({ value: extraStake });

      const info = await registry.getAgentInfo(agent1.address);
      expect(info.stake).to.equal(extraStake);
    });
  });

  describe("Deregistration", function () {
    it("should require deregistration request first", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });

      await expect(
        registry.connect(agent1).deregisterAgent()
      ).to.be.revertedWithCustomError(registry, "NoDeregistrationRequested");
    });

    it("should enforce cooldown period", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });
      await registry.connect(agent1).requestDeregistration();

      await expect(
        registry.connect(agent1).deregisterAgent()
      ).to.be.revertedWithCustomError(registry, "CooldownNotElapsed");
    });

    it("should return stake after cooldown", async function () {
      const { registry, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });
      await registry.connect(agent1).requestDeregistration();

      // Fast-forward past cooldown
      await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await ethers.provider.getBalance(agent1.address);

      await expect(registry.connect(agent1).deregisterAgent())
        .to.emit(registry, "AgentDeregistered")
        .withArgs(agent1.address, MIN_STAKE);

      expect(await registry.isRegistered(agent1.address)).to.be.false;
      expect(await registry.getAgentCount()).to.equal(0);
    });
  });

  describe("Slashing", function () {
    it("should allow owner to slash an agent", async function () {
      const { registry, owner, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });
      const slashAmount = ethers.parseEther("0.05");

      await expect(
        registry.connect(owner).slash(agent1.address, slashAmount, ethers.id("violation"))
      )
        .to.emit(registry, "AgentSlashed")
        .withArgs(agent1.address, slashAmount, ethers.id("violation"));

      const info = await registry.getAgentInfo(agent1.address);
      expect(info.stake).to.equal(MIN_STAKE - slashAmount);
    });

    it("should deactivate agent if stake falls below minimum", async function () {
      const { registry, owner, agent1 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });

      // Slash more than half the stake (below min)
      const slashAmount = ethers.parseEther("0.06");
      await registry.connect(owner).slash(agent1.address, slashAmount, ethers.id("major"));

      expect(await registry.isRegistered(agent1.address)).to.be.false;
    });

    it("should reject slash from non-owner", async function () {
      const { registry, agent1, agent2 } = await loadFixture(deployFixture);

      await registry.connect(agent1).registerAgent({ value: MIN_STAKE });

      await expect(
        registry.connect(agent2).slash(agent1.address, MIN_STAKE, ethers.id("test"))
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Admin", function () {
    it("should allow owner to update min stake", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      const newMin = ethers.parseEther("0.5");

      await registry.connect(owner).setMinStake(newMin);
      expect(await registry.getMinStake()).to.equal(newMin);
    });

    it("should allow owner to pause/unpause", async function () {
      const { registry, owner, agent1 } = await loadFixture(deployFixture);

      await registry.connect(owner).pause();

      await expect(
        registry.connect(agent1).registerAgent({ value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(owner).unpause();

      await expect(
        registry.connect(agent1).registerAgent({ value: MIN_STAKE })
      ).to.not.be.reverted;
    });
  });
});
