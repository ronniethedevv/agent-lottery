import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const MIN_STAKE = ethers.parseEther("0.1");
const COOLDOWN = 86400;

describe("LotteryFactory", function () {
  async function deployFixture() {
    const [owner, creator, agent2] = await ethers.getSigners();

    // Deploy registry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy(MIN_STAKE, COOLDOWN);

    // Deploy lottery implementation
    const Lottery = await ethers.getContractFactory("Lottery");
    const implementation = await Lottery.deploy();

    // Deploy DrawManager (mock mode)
    const DrawManager = await ethers.getContractFactory("DrawManager");
    // We'll set factory later
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
      200 // 2% protocol fee
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
      ethers.ZeroAddress, // eligibility verifier (mock)
      ethers.ZeroAddress, // ticket verifier (mock)
      ethers.ZeroAddress, // claim verifier (mock)
      await poseidon.getAddress()
    );

    // Wire up cross-references
    await drawManager.setFactory(await factory.getAddress());
    await prizePool.setFactory(await factory.getAddress());

    // Register creator as an agent
    await registry.connect(creator).registerAgent({ value: MIN_STAKE });

    return { factory, registry, drawManager, prizePool, implementation, owner, creator, agent2 };
  }

  describe("Lottery creation", function () {
    it("should create a lottery", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };

      const tx = await factory.connect(creator).createLottery(config);
      const receipt = await tx.wait();

      expect(await factory.getLotteryCount()).to.equal(1);

      const lotteries = await factory.getLotteries(0, 10);
      expect(lotteries.length).to.equal(1);
      expect(await factory.isLottery(lotteries[0])).to.be.true;
    });

    it("should reject creation from non-agent", async function () {
      const { factory, agent2 } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };

      await expect(
        factory.connect(agent2).createLottery(config)
      ).to.be.revertedWithCustomError(factory, "NotRegisteredAgent");
    });

    it("should reject entry fee out of bounds", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.0001"), // below min
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };

      await expect(
        factory.connect(creator).createLottery(config)
      ).to.be.revertedWithCustomError(factory, "EntryFeeOutOfBounds");
    });

    it("should reject too-low max tickets", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 1, // needs at least 2
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };

      await expect(
        factory.connect(creator).createLottery(config)
      ).to.be.revertedWithCustomError(factory, "MaxTicketsTooLow");
    });

    it("should reject excessive creator fee", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 1500, // 15%, max is 10%
      };

      await expect(
        factory.connect(creator).createLottery(config)
      ).to.be.revertedWithCustomError(factory, "CreatorFeeRateTooHigh");
    });

    it("should enumerate multiple lotteries", async function () {
      const { factory, creator } = await loadFixture(deployFixture);

      const config = {
        entryFee: ethers.parseEther("0.01"),
        maxTickets: 100,
        drawInterval: 3600,
        maxRounds: 0,
        creatorFeeRate: 300,
      };

      await factory.connect(creator).createLottery(config);
      await factory.connect(creator).createLottery({ ...config, entryFee: ethers.parseEther("0.05") });
      await factory.connect(creator).createLottery({ ...config, maxTickets: 50 });

      expect(await factory.getLotteryCount()).to.equal(3);

      const page1 = await factory.getLotteries(0, 2);
      expect(page1.length).to.equal(2);

      const page2 = await factory.getLotteries(2, 2);
      expect(page2.length).to.equal(1);
    });
  });

  describe("Admin", function () {
    it("should allow owner to update protocol fee rate", async function () {
      const { factory, owner } = await loadFixture(deployFixture);

      await factory.connect(owner).setProtocolFeeRate(500);
      expect(await factory.getProtocolFeeRate()).to.equal(500);
    });

    it("should allow owner to update implementation", async function () {
      const { factory, owner } = await loadFixture(deployFixture);

      const NewImpl = await ethers.getContractFactory("Lottery");
      const newImpl = await NewImpl.deploy();

      await expect(
        factory.connect(owner).setImplementation(await newImpl.getAddress())
      ).to.emit(factory, "ImplementationUpdated");
    });
  });
});
