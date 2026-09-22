import { ethers } from "ethers";
import type { AgentConfig, TicketData } from "@agent-lottery/common";
import { StrategyEngine } from "../strategy/StrategyEngine.js";
import { ProofGenerator } from "../zk/ProofGenerator.js";
import { poseidonHash1, poseidonHash2 } from "../zk/poseidon.js";
import { MerkleTree } from "../zk/MerkleTree.js";
import { ContractClient } from "../chain/contracts.js";
import { LotteryDiscovery, type DiscoveredLottery } from "../lottery/LotteryDiscovery.js";
import { TicketStore } from "../lottery/TicketStore.js";
import type { AgentState, LotteryState } from "../strategy/conditions.js";
import pino from "pino";

const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export class Agent {
  readonly id: number;
  readonly name: string;
  readonly address: string;

  private wallet: ethers.Wallet;
  private config: AgentConfig;
  private strategy: StrategyEngine;
  private proofGen: ProofGenerator;
  private client: ContractClient;
  private discovery: LotteryDiscovery;
  private ticketStore: TicketStore;
  private agentSecret: bigint;
  private agentCommitment: bigint | null = null;
  private logger: pino.Logger;

  private running = false;
  private lastEntryRound: Map<string, number> = new Map();
  private totalWagered = 0n;
  private totalWon = 0n;

  // Per-lottery Merkle tree tracking (client-side mirror)
  private merkleTrees: Map<string, MerkleTree> = new Map();

  constructor(params: {
    id: number;
    wallet: ethers.Wallet;
    config: AgentConfig;
    proofGen: ProofGenerator;
    client: ContractClient;
    discovery: LotteryDiscovery;
    ticketStorePath: string;
    agentSecret: bigint;
  }) {
    this.id = params.id;
    this.name = params.config.name;
    this.wallet = params.wallet;
    this.address = params.wallet.address;
    this.config = params.config;
    this.strategy = StrategyEngine.fromConfig(params.config);
    this.proofGen = params.proofGen;
    this.client = params.client;
    this.discovery = params.discovery;
    this.ticketStore = new TicketStore(params.ticketStorePath);
    this.agentSecret = params.agentSecret;

    this.logger = pino({ name: `agent:${this.name}` });
  }

  async initialize(): Promise<void> {
    this.agentCommitment = await poseidonHash1(this.agentSecret);
    this.logger.info({ address: this.address }, "Agent initialized");
  }

  async tick(): Promise<void> {
    try {
      // 1. Discover open lotteries
      const lotteries = await this.discovery.refresh();

      if (lotteries.length === 0) {
        this.logger.debug("No open lotteries found");
        return;
      }

      // 2. Get current agent state
      const balance = await this.wallet.provider!.getBalance(this.address);
      const agentState: AgentState = {
        balance,
        reputation: 0,
        lastEntryRound: 0,
        totalWagered: this.totalWagered,
        totalWon: this.totalWon,
      };

      // 3. Evaluate each lottery
      for (const lottery of lotteries) {
        await this._evaluateAndEnter(lottery, agentState);
      }

      // 4. Check for draws to trigger
      for (const lottery of lotteries) {
        await this._checkAndTriggerDraw(lottery.address);
      }

      // 5. Check for prizes to claim
      await this._checkAndClaimPrizes();
    } catch (error) {
      this.logger.error({ error }, "Error during agent tick");
    }
  }

  private async _evaluateAndEnter(
    lottery: DiscoveredLottery,
    agentState: AgentState
  ): Promise<void> {
    const { address, state } = lottery;

    // Update agent state with lottery-specific last entry
    const lastEntry = this.lastEntryRound.get(address) ?? 0;
    agentState.lastEntryRound = lastEntry;

    // Evaluate strategy
    if (!this.strategy.evaluate(state, agentState)) {
      this.logger.debug({ lottery: address }, "Strategy says skip");
      return;
    }

    // Check balance
    if (agentState.balance < state.entryFee) {
      this.logger.warn({ lottery: address, balance: agentState.balance, fee: state.entryFee }, "Insufficient balance");
      return;
    }

    this.logger.info({ lottery: address, round: state.currentRound }, "Entering lottery");

    try {
      await this._enterLottery(lottery);
      this.lastEntryRound.set(address, state.currentRound);
      this.totalWagered += state.entryFee;
    } catch (error) {
      this.logger.error({ error, lottery: address }, "Failed to enter lottery");
    }
  }

  private async _enterLottery(lottery: DiscoveredLottery): Promise<void> {
    const { address, state } = lottery;

    // Generate ticket secrets
    const secret = this._generateRandom();
    const nullifier = this._generateRandom();
    const commitment = await poseidonHash2(secret, nullifier);

    // Generate eligibility proof
    const circuitInputs = this.strategy.getCircuitInputs();
    const balance = await this.wallet.provider!.getBalance(this.address);

    const eligibilityResult = await this.proofGen.generateEligibilityProof({
      balance,
      strategyType: circuitInputs.strategyType,
      strategyThreshold: circuitInputs.threshold,
      strategyThreshold2: circuitInputs.threshold2,
      agentSecret: this.agentSecret,
      lotteryId: state.lotteryId,
      minEntryFee: state.entryFee,
      jackpotSize: state.jackpotSize,
      participantCount: state.participantCount,
      agentCommitment: this.agentCommitment!,
    });

    // Generate ticket proof
    const ticketResult = await this.proofGen.generateTicketProof({
      secret,
      nullifier,
      commitment,
      lotteryId: state.lotteryId,
    });

    // Format proofs for contract
    const eligProof = ProofGenerator.formatProofForContract(eligibilityResult.proof);
    const tickProof = ProofGenerator.formatProofForContract(ticketResult.proof);

    // Submit transaction
    const receipt = await this.client.enterWithProof(
      address,
      eligProof,
      eligibilityResult.publicSignals,
      tickProof,
      ticketResult.publicSignals,
      state.entryFee
    );

    // Parse leaf index from event
    const iface = new ethers.Interface([
      "event TicketPurchased(uint256 indexed roundId, bytes32 indexed commitment, uint32 leafIndex)",
    ]);
    let leafIndex = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === "TicketPurchased") {
          leafIndex = Number(parsed.args.leafIndex);
          break;
        }
      } catch { /* not our event */ }
    }

    // Save ticket data locally
    const ticketData: TicketData = {
      secret,
      nullifier,
      commitment,
      lotteryId: state.lotteryId,
      roundId: state.currentRound,
      leafIndex,
    };
    await this.ticketStore.saveTicket(ticketData);

    // Update local Merkle tree
    let tree = this.merkleTrees.get(`${address}:${state.currentRound}`);
    if (!tree) {
      tree = await MerkleTree.create();
      this.merkleTrees.set(`${address}:${state.currentRound}`, tree);
    }
    await tree.insert(commitment);

    this.logger.info({
      lottery: address,
      round: state.currentRound,
      leafIndex,
      txHash: receipt.hash,
    }, "Successfully entered lottery");
  }

  private async _checkAndTriggerDraw(lotteryAddress: string): Promise<void> {
    try {
      const drawable = await this.client.isRoundDrawable(lotteryAddress);
      if (drawable) {
        this.logger.info({ lottery: lotteryAddress }, "Triggering draw");
        await this.client.triggerDraw(lotteryAddress);
      }
    } catch {
      // May fail if another agent triggers first — that's fine
    }
  }

  private async _checkAndClaimPrizes(): Promise<void> {
    if (!this.config.autoClaimEnabled) return;

    // Check all known lotteries for claimable rounds
    for (const lotteryAddress of this.discovery.getAllKnown()) {
      try {
        const currentRound = await this.client.getCurrentRound(lotteryAddress);

        // Check previous rounds that might be claimable
        for (let roundId = Math.max(1, currentRound - 5); roundId <= currentRound; roundId++) {
          const roundState = await this.client.getRoundState(lotteryAddress, roundId);
          if (roundState.status !== 2) continue; // Not Claimable
          if (roundState.claimed) continue;

          const lotteryId = BigInt(lotteryAddress);
          const tickets = await this.ticketStore.getTicketsForRound(lotteryId, roundId);

          for (const ticket of tickets) {
            if (ticket.leafIndex === roundState.winnerIndex) {
              this.logger.info({ lottery: lotteryAddress, round: roundId }, "WE WON! Claiming prize");
              await this._claimPrize(lotteryAddress, roundId, ticket);
            }
          }
        }
      } catch (error) {
        this.logger.error({ error, lottery: lotteryAddress }, "Error checking claims");
      }
    }
  }

  private async _claimPrize(
    lotteryAddress: string,
    roundId: number,
    ticket: TicketData
  ): Promise<void> {
    const treeKey = `${lotteryAddress}:${roundId}`;
    const tree = this.merkleTrees.get(treeKey);
    if (!tree) {
      this.logger.error({ lottery: lotteryAddress, round: roundId }, "No Merkle tree for this round");
      return;
    }

    const { pathElements, pathIndices, root } = await tree.getProof(ticket.leafIndex);
    const nullifierHash = await poseidonHash1(ticket.nullifier);
    const recipientBigInt = BigInt(this.address);

    const claimResult = await this.proofGen.generateClaimProof({
      secret: ticket.secret,
      nullifier: ticket.nullifier,
      pathElements,
      pathIndices,
      root,
      nullifierHash,
      lotteryId: BigInt(lotteryAddress),
      roundId: BigInt(roundId),
      recipient: recipientBigInt,
      leafIndex: ticket.leafIndex,
    });

    const proof = ProofGenerator.formatProofForContract(claimResult.proof);
    const receipt = await this.client.claimPrize(lotteryAddress, proof, claimResult.publicSignals);

    this.logger.info({
      lottery: lotteryAddress,
      round: roundId,
      txHash: receipt.hash,
    }, "Prize claimed successfully");
  }

  private _generateRandom(): bigint {
    const bytes = ethers.randomBytes(31);
    return BigInt("0x" + Buffer.from(bytes).toString("hex")) % BN254_ORDER;
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.ticketStore.close();
    this.logger.info("Agent stopped");
  }
}
