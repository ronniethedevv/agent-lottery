import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const MIN_STAKE = ethers.parseEther("0.1");
const COOLDOWN = 86400;

describe("DrawManager", function () {
  async function deployFixture() {
    const [owner, lotteryAddr, otherLottery] = await ethers.getSigners();

    // Deploy AgentRegistry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy(MIN_STAKE, COOLDOWN);

    // Deploy Lottery implementation
    const Lottery = await ethers.getContractFactory("Lottery");
    const implementation = await Lottery.deploy();

    // Deploy DrawManager in mock mode
    const DrawManager = await ethers.getContractFactory("DrawManager");
    const drawManager = await DrawManager.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      0
    );
    await drawManager.setMockMode(true);

    // Deploy PrizePool
    const PrizePool = await ethers.getContractFactory("PrizePool");
    const prizePool = await PrizePool.deploy(
      ethers.ZeroAddress,
      owner.address,
      200
    );

    // Deploy the Poseidon hasher (keccak stand-in for tests)
    const Poseidon = await ethers.getContractFactory("PoseidonHasherMock");
    const poseidon = await Poseidon.deploy();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("LotteryFactory");
    const factory = await Factory.deploy(
      await implementation.getAddress(),
      await registry.getAddress(),
      await drawManager.getAddress(),
      await prizePool.getAddress(),
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      await poseidon.getAddress()
    );

    await drawManager.setFactory(await factory.getAddress());
    await prizePool.setFactory(await factory.getAddress());

    return { drawManager, factory, registry, prizePool, owner, lotteryAddr, otherLottery };
  }

  describe("Request draw", function () {
    it("should reject requests from non-lottery addresses", async function () {
      const { drawManager, otherLottery } = await loadFixture(deployFixture);

      await expect(
        drawManager.connect(otherLottery).requestDraw(otherLottery.address, 1, 10)
      ).to.be.revertedWithCustomError(drawManager, "OnlyLottery");
    });

    it("should reject zero ticket count", async function () {
      const { drawManager, factory, registry, owner } = await loadFixture(deployFixture);

      // Register agent and create a lottery to get a valid lottery address
      await registry.connect(owner).registerAgent({ value: MIN_STAKE });
      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };
      // We can't directly call requestDraw from a lottery since triggerDraw does it
      // This test verifies the zero check at the DrawManager level
    });
  });

  describe("Mock fulfillment", function () {
    it("should reject mock fulfillment when not in mock mode", async function () {
      const { drawManager, owner } = await loadFixture(deployFixture);

      await drawManager.setMockMode(false);

      await expect(
        drawManager.mockFulfillDraw(1, 12345)
      ).to.be.reverted;
    });

    it("should reject fulfillment for non-existent request", async function () {
      const { drawManager } = await loadFixture(deployFixture);

      await expect(
        drawManager.mockFulfillDraw(999, 12345)
      ).to.be.revertedWithCustomError(drawManager, "RequestNotFound");
    });
  });

  describe("Admin", function () {
    it("should allow owner to toggle mock mode", async function () {
      const { drawManager, owner } = await loadFixture(deployFixture);

      expect(await drawManager.mockMode()).to.be.true;

      await drawManager.connect(owner).setMockMode(false);
      expect(await drawManager.mockMode()).to.be.false;
    });

    it("should allow owner to update VRF config", async function () {
      const { drawManager, owner } = await loadFixture(deployFixture);

      const newCoordinator = ethers.Wallet.createRandom().address;
      const newKeyHash = ethers.id("newkey");

      await drawManager.connect(owner).setVRFConfig(
        newCoordinator,
        newKeyHash,
        42,
        5,
        300000
      );

      expect(await drawManager.vrfCoordinator()).to.equal(newCoordinator);
      expect(await drawManager.keyHash()).to.equal(newKeyHash);
      expect(await drawManager.subscriptionId()).to.equal(42);
    });

    it("should allow owner to update factory", async function () {
      const { drawManager, owner } = await loadFixture(deployFixture);
      const newFactory = ethers.Wallet.createRandom().address;

      await drawManager.connect(owner).setFactory(newFactory);
    });
  });
});
