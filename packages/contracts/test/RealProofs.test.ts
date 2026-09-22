import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { resolve } from "path";
// @ts-ignore — no types
import { poseidonContract, buildPoseidon } from "circomlibjs";
// @ts-ignore — no types
import * as snarkjs from "snarkjs";

/**
 * End-to-end test with REAL Groth16 proofs against the REAL snarkjs verifiers
 * and the REAL circomlib Poseidon hasher — no mocks. This is the definitive
 * check that the on-chain ZK path (enter → draw → claim) actually works:
 * proofs an agent would generate are accepted, the Merkle root the contract
 * computes matches the circuit, and a winner can claim.
 */

const CIRCUITS = resolve(__dirname, "..", "..", "circuits");
const wasm = (n: string) => resolve(CIRCUITS, "build", n, `${n}_js`, `${n}.wasm`);
const zkey = (n: string) => resolve(CIRCUITS, "keys", `${n}_final.zkey`);

const MIN_STAKE = ethers.parseEther("0.1");
const ENTRY_FEE = ethers.parseEther("0.01");
const DEPTH = 20;
const LOTTERY_ID = 1n;

async function prove(input: Record<string, unknown>, name: string) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm(name), zkey(name));
  const calldata: string = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const argv = JSON.parse("[" + calldata + "]");
  return { a: argv[0], b: argv[1], c: argv[2], input: argv[3] as string[] };
}

describe("Real ZK proofs (end-to-end)", function () {
  this.timeout(180000);

  let poseidon: any;
  let F: any;
  let hash1: (x: bigint) => bigint;
  let hash2: (a: bigint, b: bigint) => bigint;
  let zeros: bigint[];

  before(async function () {
    poseidon = await buildPoseidon();
    F = poseidon.F;
    hash1 = (x) => F.toObject(poseidon([x]));
    hash2 = (a, b) => F.toObject(poseidon([a, b]));
    // zero-subtree hashes, matching the on-chain tree (ZERO_VALUE = 0)
    zeros = [0n];
    for (let i = 1; i < DEPTH; i++) zeros[i] = hash2(zeros[i - 1], zeros[i - 1]);
  });

  async function deployFull() {
    const [deployer, agent, treasury] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy(MIN_STAKE, 86400);

    const Elig = await ethers.getContractFactory("EligibilityVerifier");
    const eligV = await Elig.deploy();
    const Ticket = await ethers.getContractFactory("TicketVerifier");
    const ticketV = await Ticket.deploy();
    const Claim = await ethers.getContractFactory("ClaimVerifier");
    const claimV = await Claim.deploy();

    // Real Poseidon(2) from circomlib bytecode
    const pAbi = poseidonContract.generateABI(2);
    const pCode = poseidonContract.createCode(2);
    const PF = new ethers.ContractFactory(pAbi, pCode, deployer);
    const hasher = await PF.deploy();

    const Lottery = await ethers.getContractFactory("Lottery");
    const impl = await Lottery.deploy();

    const DrawManager = await ethers.getContractFactory("DrawManager");
    const draw = await DrawManager.deploy(ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroHash, 0);
    await draw.setMockMode(true);

    const PrizePool = await ethers.getContractFactory("PrizePool");
    const pool = await PrizePool.deploy(ethers.ZeroAddress, treasury.address, 200);

    const Factory = await ethers.getContractFactory("LotteryFactory");
    const factory = await Factory.deploy(
      await impl.getAddress(),
      await registry.getAddress(),
      await draw.getAddress(),
      await pool.getAddress(),
      await eligV.getAddress(),
      await ticketV.getAddress(),
      await claimV.getAddress(),
      await hasher.getAddress()
    );
    await draw.setFactory(await factory.getAddress());
    await pool.setFactory(await factory.getAddress());

    await registry.connect(agent).registerAgent({ value: MIN_STAKE });

    return { factory, draw, pool, registry, deployer, agent, treasury };
  }

  it("accepts a real entry proof, draws, and pays a real claim proof", async function () {
    const { factory, draw, agent, treasury } = await deployFull();

    // Create a lottery (agent is a registered creator)
    await factory.connect(agent).createLottery({
      entryFee: ENTRY_FEE,
      maxTickets: 5,
      drawInterval: 3600,
      maxRounds: 0,
      creatorFeeRate: 0,
    });
    const lotteryAddr = (await factory.getLotteries(0, 1))[0];
    const lottery = await ethers.getContractAt("Lottery", lotteryAddr);

    // Agent's private values
    const agentSecret = 111111n;
    const secret = 222222n;
    const nullifier = 333333n;
    const agentCommitment = hash1(agentSecret);
    const commitment = hash2(secret, nullifier);

    // --- Real eligibility proof (AlwaysEnter, balance >= fee) ---
    const eligibility = await prove(
      {
        balance: ENTRY_FEE.toString(),
        strategyType: 0,
        strategyThreshold: 0,
        strategyThreshold2: 0,
        agentSecret: agentSecret.toString(),
        lotteryId: LOTTERY_ID.toString(),
        minEntryFee: ENTRY_FEE.toString(),
        jackpotSize: 0,
        participantCount: 0,
        agentCommitment: agentCommitment.toString(),
      },
      "eligibility"
    );

    // --- Real ticket commitment proof ---
    const ticket = await prove(
      {
        secret: secret.toString(),
        nullifier: nullifier.toString(),
        commitment: commitment.toString(),
        lotteryId: LOTTERY_ID.toString(),
      },
      "ticket"
    );

    // Enter with both real proofs
    await expect(
      lottery.connect(agent).enterWithProof(
        eligibility.a, eligibility.b, eligibility.c, eligibility.input,
        ticket.a, ticket.b, ticket.c, ticket.input,
        { value: ENTRY_FEE }
      )
    ).to.emit(lottery, "TicketPurchased");

    // The on-chain root must equal the root we fold off-chain for leaf 0
    let root = commitment;
    for (let i = 0; i < DEPTH; i++) root = hash2(root, zeros[i]);
    expect(await lottery.getLastRoot()).to.equal(root);

    // --- Draw (mock VRF) ---
    await time.increase(3601);
    await lottery.triggerDraw();
    await draw.mockFulfillDraw(1, 12345);
    expect((await lottery.getRoundState(1)).status).to.equal(2); // Claimable

    // --- Real claim proof (single leaf ⇒ path is the zeros, all-left) ---
    const nullifierHash = hash1(nullifier);
    const recipient = BigInt(agent.address);
    const claim = await prove(
      {
        secret: secret.toString(),
        nullifier: nullifier.toString(),
        pathElements: zeros.map((z) => z.toString()),
        pathIndices: new Array(DEPTH).fill(0),
        root: root.toString(),
        nullifierHash: nullifierHash.toString(),
        lotteryId: LOTTERY_ID.toString(),
        roundId: 1,
        recipient: recipient.toString(),
        leafIndex: 0, // single entrant ⇒ ticket 0, which the draw selects
      },
      "claim"
    );

    const before = await ethers.provider.getBalance(agent.address);
    const tx = await lottery.connect(treasury).claimPrize(claim.a, claim.b, claim.c, claim.input);
    await expect(tx).to.emit(lottery, "PrizeClaimed");

    // Prize (minus 2% protocol fee) went to the recipient encoded in the proof
    const after = await ethers.provider.getBalance(agent.address);
    const prize = ENTRY_FEE - (ENTRY_FEE * 200n) / 10000n;
    expect(after - before).to.equal(prize);

    // Round settled, nullifier burned
    expect((await lottery.getRoundState(1)).claimed).to.equal(true);
  });

  it("rejects a tampered entry proof", async function () {
    const { factory, agent } = await deployFull();
    await factory.connect(agent).createLottery({
      entryFee: ENTRY_FEE,
      maxTickets: 5,
      drawInterval: 3600,
      maxRounds: 0,
      creatorFeeRate: 0,
    });
    const lottery = await ethers.getContractAt("Lottery", (await factory.getLotteries(0, 1))[0]);

    const agentSecret = 111111n;
    const eligibility = await prove(
      {
        balance: ENTRY_FEE.toString(), strategyType: 0, strategyThreshold: 0,
        strategyThreshold2: 0, agentSecret: agentSecret.toString(),
        lotteryId: LOTTERY_ID.toString(), minEntryFee: ENTRY_FEE.toString(),
        jackpotSize: 0, participantCount: 0, agentCommitment: hash1(agentSecret).toString(),
      },
      "eligibility"
    );
    const ticket = await prove(
      { secret: 222222n.toString(), nullifier: 333333n.toString(),
        commitment: hash2(222222n, 333333n).toString(), lotteryId: LOTTERY_ID.toString() },
      "ticket"
    );

    // Corrupt one eligibility public signal → proof no longer verifies
    const tampered = [...eligibility.input];
    tampered[4] = (BigInt(tampered[4]) + 1n).toString();

    await expect(
      lottery.connect(agent).enterWithProof(
        eligibility.a, eligibility.b, eligibility.c, tampered,
        ticket.a, ticket.b, ticket.c, ticket.input,
        { value: ENTRY_FEE }
      )
    ).to.be.revertedWithCustomError(lottery, "InvalidProof");
  });
});
