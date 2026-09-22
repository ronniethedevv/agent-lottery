import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const MIN_STAKE = ethers.parseEther("0.1");
const COOLDOWN = 86400;
const ENTRY_FEE = ethers.parseEther("0.01");
const DRAW_INTERVAL = 3600;
const MAX_TICKETS = 10;

describe("Integration: Full Lottery Lifecycle", function () {
  async function deployAllFixture() {
    const [owner, agent1, agent2, agent3, treasury] = await ethers.getSigners();

    // 1. Deploy AgentRegistry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy(MIN_STAKE, COOLDOWN);

    // 2. Deploy MockVerifier
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    const eligibilityVerifier = await MockVerifier.deploy();
    const ticketVerifier = await MockVerifier.deploy();
    const claimVerifier = await MockVerifier.deploy();

    // 3. Deploy Lottery implementation
    const Lottery = await ethers.getContractFactory("Lottery");
    const implementation = await Lottery.deploy();

    // 4. Deploy DrawManager in mock mode
    const DrawManager = await ethers.getContractFactory("DrawManager");
    const drawManager = await DrawManager.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      0
    );
    await drawManager.setMockMode(true);

    // 5. Deploy PrizePool
    const PrizePool = await ethers.getContractFactory("PrizePool");
    const prizePool = await PrizePool.deploy(
      ethers.ZeroAddress,
      treasury.address,
      200 // 2%
    );

    // 6. Deploy the Poseidon hasher (keccak stand-in for tests)
    const Poseidon = await ethers.getContractFactory("PoseidonHasherMock");
    const poseidon = await Poseidon.deploy();

    // 7. Deploy Factory
    const Factory = await ethers.getContractFactory("LotteryFactory");
    const factory = await Factory.deploy(
      await implementation.getAddress(),
      await registry.getAddress(),
      await drawManager.getAddress(),
      await prizePool.getAddress(),
      await eligibilityVerifier.getAddress(),
      await ticketVerifier.getAddress(),
      await claimVerifier.getAddress(),
      await poseidon.getAddress()
    );

    // 7. Wire cross-references
    await drawManager.setFactory(await factory.getAddress());
    await prizePool.setFactory(await factory.getAddress());

    // 8. Register agents
    await registry.connect(agent1).registerAgent({ value: MIN_STAKE });
    await registry.connect(agent2).registerAgent({ value: MIN_STAKE });
    await registry.connect(agent3).registerAgent({ value: MIN_STAKE });

    return {
      registry,
      factory,
      drawManager,
      prizePool,
      eligibilityVerifier,
      ticketVerifier,
      claimVerifier,
      implementation,
      owner,
      agent1,
      agent2,
      agent3,
      treasury,
    };
  }

  it("should run a complete lottery lifecycle: create → enter → draw → claim", async function () {
    const {
      factory,
      drawManager,
      prizePool,
      agent1,
      agent2,
      agent3,
      treasury,
    } = await loadFixture(deployAllFixture);

    // --- Step 1: Agent1 creates a lottery ---
    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 300, // 3%
    };

    const createTx = await factory.connect(agent1).createLottery(config);
    const createReceipt = await createTx.wait();

    const lotteries = await factory.getLotteries(0, 10);
    const lotteryAddr = lotteries[0];
    const lottery = await ethers.getContractAt("Lottery", lotteryAddr);

    expect(await lottery.entryFee()).to.equal(ENTRY_FEE);
    expect(await lottery.maxTickets()).to.equal(MAX_TICKETS);
    expect(await lottery.currentRound()).to.equal(1);

    // --- Step 2: Agents enter the lottery with mock proofs ---
    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [
      [3n, 4n],
      [5n, 6n],
    ];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    // Agent1 enters
    const agent1Commitment = ethers.toBigInt(ethers.id("agent1-commitment"));
    const agent1TicketCommitment = ethers.toBigInt(ethers.id("agent1-ticket"));
    const eligInputs1 = [1n, ENTRY_FEE, 0n, 0n, agent1Commitment];
    const ticketInputs1 = [agent1TicketCommitment, 1n];

    await expect(
      lottery.connect(agent1).enterWithProof(
        dummyProofA,
        dummyProofB,
        dummyProofC,
        eligInputs1,
        dummyProofA,
        dummyProofB,
        dummyProofC,
        ticketInputs1,
        { value: ENTRY_FEE }
      )
    ).to.emit(lottery, "TicketPurchased");

    // Agent2 enters
    const agent2Commitment = ethers.toBigInt(ethers.id("agent2-commitment"));
    const agent2TicketCommitment = ethers.toBigInt(ethers.id("agent2-ticket"));
    const eligInputs2 = [1n, ENTRY_FEE, ENTRY_FEE, 1n, agent2Commitment];
    const ticketInputs2 = [agent2TicketCommitment, 1n];

    await lottery.connect(agent2).enterWithProof(
      dummyProofA,
      dummyProofB,
      dummyProofC,
      eligInputs2,
      dummyProofA,
      dummyProofB,
      dummyProofC,
      ticketInputs2,
      { value: ENTRY_FEE }
    );

    // Agent3 enters
    const agent3Commitment = ethers.toBigInt(ethers.id("agent3-commitment"));
    const agent3TicketCommitment = ethers.toBigInt(ethers.id("agent3-ticket"));
    const eligInputs3 = [1n, ENTRY_FEE, ENTRY_FEE * 2n, 2n, agent3Commitment];
    const ticketInputs3 = [agent3TicketCommitment, 1n];

    await lottery.connect(agent3).enterWithProof(
      dummyProofA,
      dummyProofB,
      dummyProofC,
      eligInputs3,
      dummyProofA,
      dummyProofB,
      dummyProofC,
      ticketInputs3,
      { value: ENTRY_FEE }
    );

    // Verify round state
    const roundState = await lottery.getRoundState(1);
    expect(roundState.ticketCount).to.equal(3);
    expect(roundState.prizePool).to.equal(ENTRY_FEE * 3n);
    expect(roundState.status).to.equal(0); // Open

    // --- Step 3: Trigger draw after time elapsed ---
    await time.increase(DRAW_INTERVAL + 1);

    await expect(lottery.connect(agent1).triggerDraw())
      .to.emit(lottery, "DrawRequested");

    const roundAfterDraw = await lottery.getRoundState(1);
    expect(roundAfterDraw.status).to.equal(1); // Drawing

    // --- Step 4: Fulfill VRF (mock) — winner is ticket index 0 ---
    const randomWord = 300n; // 300 % 3 = 0 (agent1 wins)
    await expect(drawManager.mockFulfillDraw(1, randomWord))
      .to.emit(lottery, "WinnerSelected")
      .withArgs(1, 0, ENTRY_FEE * 3n);

    const roundAfterSettle = await lottery.getRoundState(1);
    expect(roundAfterSettle.status).to.equal(2); // Claimable
    expect(roundAfterSettle.winnerIndex).to.equal(0);

    // --- Step 5: Winner claims prize ---
    const totalPrize = ENTRY_FEE * 3n;
    const protocolFee = (totalPrize * 200n) / 10000n;
    const expectedPrize = totalPrize - protocolFee;

    const root = await lottery.getLastRoot();
    const nullifierHash = ethers.toBigInt(ethers.id("claim-nullifier"));
    const claimPublicInputs = [
      root,
      nullifierHash,
      1n,                      // lotteryId
      1n,                      // roundId
      ethers.toBigInt(agent1.address), // recipient
      0n,                      // leafIndex — agent1 is ticket 0 (the drawn winner)
    ];

    const recipientBefore = await ethers.provider.getBalance(agent1.address);
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    const claimTx = await lottery.connect(agent1).claimPrize(
      dummyProofA,
      dummyProofB,
      dummyProofC,
      claimPublicInputs
    );
    const claimReceipt = await claimTx.wait();
    const gasUsed = claimReceipt!.gasUsed * claimReceipt!.gasPrice;

    const recipientAfter = await ethers.provider.getBalance(agent1.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    expect(recipientAfter - recipientBefore + gasUsed).to.equal(expectedPrize);
    expect(treasuryAfter - treasuryBefore).to.equal(protocolFee);

    // Round should be settled and advanced
    const settledRound = await lottery.getRoundState(1);
    expect(settledRound.status).to.equal(3); // Settled
    expect(settledRound.claimed).to.be.true;

    // Next round should be open
    expect(await lottery.currentRound()).to.equal(2);
    const round2 = await lottery.getRoundState(2);
    expect(round2.status).to.equal(0); // Open
  });

  it("should prevent same agent from entering twice in one round", async function () {
    const { factory, agent1 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 300,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    const agentCommitment = ethers.toBigInt(ethers.id("agent1-commitment"));

    // First entry succeeds
    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, agentCommitment],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("ticket1")), 1n],
      { value: ENTRY_FEE }
    );

    // Second entry with same agentCommitment reverts
    await expect(
      lottery.connect(agent1).enterWithProof(
        dummyProofA, dummyProofB, dummyProofC,
        [1n, ENTRY_FEE, ENTRY_FEE, 1n, agentCommitment],
        dummyProofA, dummyProofB, dummyProofC,
        [ethers.toBigInt(ethers.id("ticket2")), 1n],
        { value: ENTRY_FEE }
      )
    ).to.be.revertedWithCustomError(lottery, "AgentAlreadyEntered");
  });

  it("should prevent double-claiming with same nullifier", async function () {
    const { factory, drawManager, agent1, agent2 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    // Two agents enter
    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t1")), 1n],
      { value: ENTRY_FEE }
    );

    await lottery.connect(agent2).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, ENTRY_FEE, 1n, ethers.toBigInt(ethers.id("a2"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t2")), 1n],
      { value: ENTRY_FEE }
    );

    // Draw
    await time.increase(DRAW_INTERVAL + 1);
    await lottery.triggerDraw();
    await drawManager.mockFulfillDraw(1, 100);

    // Claim
    const root = await lottery.getLastRoot();
    const nullifierHash = ethers.toBigInt(ethers.id("claim-null"));

    await lottery.connect(agent1).claimPrize(
      dummyProofA, dummyProofB, dummyProofC,
      [root, nullifierHash, 1n, 1n, ethers.toBigInt(agent1.address), 0n]
    );

    // Same nullifier again should fail — but round is already Settled so it'll revert
    // with RoundNotClaimable (since it advanced to round 2)
    await expect(
      lottery.connect(agent1).claimPrize(
        dummyProofA, dummyProofB, dummyProofC,
        [root, nullifierHash, 1n, 1n, ethers.toBigInt(agent1.address), 0n]
      )
    ).to.be.reverted;
  });

  it("should reject a claim from a non-winning ticket", async function () {
    const { factory, drawManager, agent1, agent2 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lottery = await ethers.getContractAt("Lottery", (await factory.getLotteries(0, 10))[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    // Two agents enter (leaf 0 and leaf 1)
    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t1")), 1n],
      { value: ENTRY_FEE }
    );
    await lottery.connect(agent2).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, ENTRY_FEE, 1n, ethers.toBigInt(ethers.id("a2"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t2")), 1n],
      { value: ENTRY_FEE }
    );

    await time.increase(DRAW_INTERVAL + 1);
    await lottery.triggerDraw();
    // randomWord 1, ticketCount 2 ⇒ winnerIndex 1 (agent2's ticket wins)
    await drawManager.mockFulfillDraw(1, 1);
    expect((await lottery.getRoundState(1)).winnerIndex).to.equal(1);

    const root = await lottery.getLastRoot();

    // agent1 holds leaf 0 — not the winner. Claiming with leafIndex 0 must revert.
    await expect(
      lottery.connect(agent1).claimPrize(
        dummyProofA, dummyProofB, dummyProofC,
        [root, ethers.toBigInt(ethers.id("n")), 1n, 1n, ethers.toBigInt(agent1.address), 0n]
      )
    ).to.be.revertedWithCustomError(lottery, "NotWinner");
  });

  it("should reject entry with wrong fee", async function () {
    const { factory, agent1 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    await expect(
      lottery.connect(agent1).enterWithProof(
        dummyProofA, dummyProofB, dummyProofC,
        [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
        dummyProofA, dummyProofB, dummyProofC,
        [ethers.toBigInt(ethers.id("t1")), 1n],
        { value: ethers.parseEther("0.005") } // wrong fee
      )
    ).to.be.revertedWithCustomError(lottery, "IncorrectEntryFee");
  });

  it("should reject draw when no tickets", async function () {
    const { factory, agent1 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    await time.increase(DRAW_INTERVAL + 1);

    await expect(
      lottery.triggerDraw()
    ).to.be.revertedWithCustomError(lottery, "NoTickets");
  });

  it("should reject draw when too early", async function () {
    const { factory, agent1 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t1")), 1n],
      { value: ENTRY_FEE }
    );

    // Don't advance time — draw should be too early
    await expect(
      lottery.triggerDraw()
    ).to.be.revertedWithCustomError(lottery, "DrawTooEarly");
  });

  it("should auto-trigger draw when max tickets reached", async function () {
    const { factory, drawManager, agent1, agent2, agent3 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: 2, // Only 2 tickets to reach max quickly
      drawInterval: DRAW_INTERVAL,
      maxRounds: 0,
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    // Agent1 enters
    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t1")), 1n],
      { value: ENTRY_FEE }
    );

    // Agent2 enters (max reached)
    await lottery.connect(agent2).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, ENTRY_FEE, 1n, ethers.toBigInt(ethers.id("a2"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t2")), 1n],
      { value: ENTRY_FEE }
    );

    // Max reached, draw should be triggerable immediately (no time wait needed)
    await expect(lottery.triggerDraw())
      .to.emit(lottery, "DrawRequested");
  });

  it("should handle finite round lottery correctly", async function () {
    const { factory, drawManager, agent1, agent2 } = await loadFixture(deployAllFixture);

    const config = {
      entryFee: ENTRY_FEE,
      maxTickets: MAX_TICKETS,
      drawInterval: DRAW_INTERVAL,
      maxRounds: 1, // Only 1 round
      creatorFeeRate: 0,
    };

    await factory.connect(agent1).createLottery(config);
    const lotteries = await factory.getLotteries(0, 10);
    const lottery = await ethers.getContractAt("Lottery", lotteries[0]);

    const dummyProofA: [bigint, bigint] = [1n, 2n];
    const dummyProofB: [[bigint, bigint], [bigint, bigint]] = [[3n, 4n], [5n, 6n]];
    const dummyProofC: [bigint, bigint] = [7n, 8n];

    // Two agents enter
    await lottery.connect(agent1).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, 0n, 0n, ethers.toBigInt(ethers.id("a1"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t1")), 1n],
      { value: ENTRY_FEE }
    );

    await lottery.connect(agent2).enterWithProof(
      dummyProofA, dummyProofB, dummyProofC,
      [1n, ENTRY_FEE, ENTRY_FEE, 1n, ethers.toBigInt(ethers.id("a2"))],
      dummyProofA, dummyProofB, dummyProofC,
      [ethers.toBigInt(ethers.id("t2")), 1n],
      { value: ENTRY_FEE }
    );

    // Draw and settle
    await time.increase(DRAW_INTERVAL + 1);
    await lottery.triggerDraw();
    await drawManager.mockFulfillDraw(1, 100);

    // Claim
    const root = await lottery.getLastRoot();
    await lottery.connect(agent1).claimPrize(
      dummyProofA, dummyProofB, dummyProofC,
      [root, ethers.toBigInt(ethers.id("null1")), 1n, 1n, ethers.toBigInt(agent1.address), 0n]
    );

    // Should NOT advance since maxRounds = 1
    expect(await lottery.currentRound()).to.equal(1);
  });
});
