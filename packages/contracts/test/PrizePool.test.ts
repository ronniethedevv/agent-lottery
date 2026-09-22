import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("PrizePool", function () {
  async function deployFixture() {
    const [owner, lottery, treasury, recipient, other] = await ethers.getSigners();

    const PrizePool = await ethers.getContractFactory("PrizePool");
    const prizePool = await PrizePool.deploy(
      owner.address,     // factory (owner acts as factory for tests)
      treasury.address,
      200                // 2% protocol fee
    );

    return { prizePool, owner, lottery, treasury, recipient, other };
  }

  describe("Deposits", function () {
    it("should accept deposits", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1.0");

      await expect(
        prizePool.connect(lottery).deposit(1, { value: amount })
      )
        .to.emit(prizePool, "Deposited")
        .withArgs(lottery.address, 1, amount);

      expect(await prizePool.getBalance(lottery.address, 1)).to.equal(amount);
    });

    it("should accumulate deposits for same round", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.5");

      await prizePool.connect(lottery).deposit(1, { value: amount });
      await prizePool.connect(lottery).deposit(1, { value: amount });

      expect(await prizePool.getBalance(lottery.address, 1)).to.equal(amount * 2n);
    });

    it("should separate balances by round", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);

      await prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") });
      await prizePool.connect(lottery).deposit(2, { value: ethers.parseEther("2") });

      expect(await prizePool.getBalance(lottery.address, 1)).to.equal(ethers.parseEther("1"));
      expect(await prizePool.getBalance(lottery.address, 2)).to.equal(ethers.parseEther("2"));
    });
  });

  describe("Prize payment", function () {
    it("should pay prize minus protocol fee", async function () {
      const { prizePool, lottery, recipient, treasury } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("1.0");

      await prizePool.connect(lottery).deposit(1, { value: deposit });
      await prizePool.connect(lottery).markClaimable(1);

      const recipientBefore = await ethers.provider.getBalance(recipient.address);

      await prizePool.connect(lottery).payPrize(1, recipient.address);

      const recipientAfter = await ethers.provider.getBalance(recipient.address);
      const expectedPrize = deposit - (deposit * 200n) / 10000n; // 98%
      expect(recipientAfter - recipientBefore).to.equal(expectedPrize);
    });

    it("should pay protocol fee to treasury", async function () {
      const { prizePool, lottery, recipient, treasury } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("1.0");

      await prizePool.connect(lottery).deposit(1, { value: deposit });
      await prizePool.connect(lottery).markClaimable(1);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await prizePool.connect(lottery).payPrize(1, recipient.address);

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const expectedFee = (deposit * 200n) / 10000n; // 2%
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });

    it("should reject double payment", async function () {
      const { prizePool, lottery, recipient } = await loadFixture(deployFixture);

      await prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") });
      await prizePool.connect(lottery).markClaimable(1);
      await prizePool.connect(lottery).payPrize(1, recipient.address);

      await expect(
        prizePool.connect(lottery).payPrize(1, recipient.address)
      ).to.be.revertedWithCustomError(prizePool, "AlreadyPaid");
    });

    it("should reject payment with zero balance", async function () {
      const { prizePool, lottery, recipient } = await loadFixture(deployFixture);

      await expect(
        prizePool.connect(lottery).payPrize(1, recipient.address)
      ).to.be.revertedWithCustomError(prizePool, "InsufficientBalance");
    });
  });

  describe("Prize amount calculation", function () {
    it("should return correct prize amount after fee", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("10");

      await prizePool.connect(lottery).deposit(1, { value: deposit });

      const prizeAmount = await prizePool.getPrizeAmount(lottery.address, 1);
      const expectedPrize = deposit - (deposit * 200n) / 10000n;
      expect(prizeAmount).to.equal(expectedPrize);
    });
  });

  describe("Unclaimed redistribution", function () {
    it("should redistribute unclaimed prizes after timeout", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("1");

      await prizePool.connect(lottery).deposit(1, { value: deposit });
      await prizePool.connect(lottery).markClaimable(1);

      // Fast-forward past claim timeout (48 hours)
      await time.increase(48 * 3600 + 1);

      await expect(
        prizePool.connect(lottery).redistributeUnclaimed(1, 2)
      )
        .to.emit(prizePool, "UnclaimedRedistributed")
        .withArgs(lottery.address, 1, 2, deposit);

      expect(await prizePool.getBalance(lottery.address, 1)).to.equal(0);
      expect(await prizePool.getBalance(lottery.address, 2)).to.equal(deposit);
    });

    it("should reject redistribution before timeout", async function () {
      const { prizePool, lottery } = await loadFixture(deployFixture);

      await prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") });
      await prizePool.connect(lottery).markClaimable(1);

      await expect(
        prizePool.connect(lottery).redistributeUnclaimed(1, 2)
      ).to.be.revertedWithCustomError(prizePool, "ClaimNotTimedOut");
    });

    it("should reject redistribution of already-paid round", async function () {
      const { prizePool, lottery, recipient } = await loadFixture(deployFixture);

      await prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") });
      await prizePool.connect(lottery).markClaimable(1);
      await prizePool.connect(lottery).payPrize(1, recipient.address);

      await time.increase(48 * 3600 + 1);

      await expect(
        prizePool.connect(lottery).redistributeUnclaimed(1, 2)
      ).to.be.revertedWithCustomError(prizePool, "InsufficientBalance");
    });
  });

  describe("Admin", function () {
    it("should allow owner to update treasury", async function () {
      const { prizePool, owner, other } = await loadFixture(deployFixture);

      await prizePool.connect(owner).setProtocolTreasury(other.address);
      expect(await prizePool.protocolTreasury()).to.equal(other.address);
    });

    it("should allow owner to update fee rate", async function () {
      const { prizePool, owner } = await loadFixture(deployFixture);

      await prizePool.connect(owner).setProtocolFeeRate(500);
      expect(await prizePool.protocolFeeRate()).to.equal(500);
    });

    it("should allow owner to pause/unpause", async function () {
      const { prizePool, owner, lottery } = await loadFixture(deployFixture);

      await prizePool.connect(owner).pause();

      await expect(
        prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(prizePool, "EnforcedPause");

      await prizePool.connect(owner).unpause();

      await expect(
        prizePool.connect(lottery).deposit(1, { value: ethers.parseEther("1") })
      ).to.not.be.reverted;
    });
  });
});
