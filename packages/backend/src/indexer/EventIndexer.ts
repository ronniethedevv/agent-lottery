import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import pino from "pino";

const FACTORY_ABI = [
  "event LotteryCreated(address indexed lottery, address indexed creator, uint256 entryFee, uint32 maxTickets, uint32 drawInterval)",
];

const LOTTERY_ABI = [
  "event TicketPurchased(uint256 indexed roundId, bytes32 indexed commitment, uint32 leafIndex)",
  "event DrawRequested(uint256 indexed roundId, uint256 vrfRequestId)",
  "event WinnerSelected(uint256 indexed roundId, uint32 winnerIndex, uint256 prizeAmount)",
  "event PrizeClaimed(uint256 indexed roundId, bytes32 nullifierHash, address recipient, uint256 amount)",
  "event RoundAdvanced(uint256 indexed newRoundId)",
];

const REGISTRY_ABI = [
  "event AgentRegistered(address indexed agent, uint256 stake)",
  "event AgentDeregistered(address indexed agent, uint256 stakeReturned)",
  "event AgentSlashed(address indexed agent, uint256 amount, bytes32 reason)",
];

export interface IndexerConfig {
  rpcUrl: string;
  factoryAddress: string;
  registryAddress: string;
  startBlock: number;
  confirmations: number;
  pollInterval: number;
}

export class EventIndexer {
  private provider: ethers.JsonRpcProvider;
  private prisma: PrismaClient;
  private config: IndexerConfig;
  private logger: pino.Logger;
  private running = false;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  private factoryInterface = new ethers.Interface(FACTORY_ABI);
  private lotteryInterface = new ethers.Interface(LOTTERY_ABI);
  private registryInterface = new ethers.Interface(REGISTRY_ABI);

  // Tracked lottery addresses
  private lotteries: Set<string> = new Set();

  onEvent?: (event: { type: string; data: unknown }) => void;

  constructor(prisma: PrismaClient, config: IndexerConfig) {
    this.prisma = prisma;
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.logger = pino({ name: "indexer" });
  }

  async start(): Promise<void> {
    this.running = true;

    // Get last indexed block
    const state = await this.prisma.indexerState.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton", lastBlockNumber: this.config.startBlock },
    });

    let fromBlock = Math.max(state.lastBlockNumber + 1, this.config.startBlock);

    // Load existing lotteries
    const existing = await this.prisma.lottery.findMany({ select: { address: true } });
    for (const l of existing) {
      this.lotteries.add(l.address.toLowerCase());
    }

    this.logger.info({ fromBlock, knownLotteries: this.lotteries.size }, "Indexer starting");

    const poll = async () => {
      if (!this.running) return;

      try {
        const currentBlock = await this.provider.getBlockNumber();
        const safeBlock = currentBlock - this.config.confirmations;

        if (fromBlock > safeBlock) return;

        const toBlock = Math.min(fromBlock + 1000, safeBlock);

        await this._processBlocks(fromBlock, toBlock);

        fromBlock = toBlock + 1;

        await this.prisma.indexerState.update({
          where: { id: "singleton" },
          data: { lastBlockNumber: toBlock },
        });
      } catch (error) {
        this.logger.error({ error }, "Indexer poll error");
      }
    };

    await poll();
    this.pollHandle = setInterval(poll, this.config.pollInterval);
  }

  private async _processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    // Fetch factory events
    await this._processFactoryEvents(fromBlock, toBlock);
    await this._processRegistryEvents(fromBlock, toBlock);

    // Fetch lottery events for all tracked lotteries
    for (const lotteryAddr of this.lotteries) {
      await this._processLotteryEvents(lotteryAddr, fromBlock, toBlock);
    }
  }

  private async _processFactoryEvents(from: number, to: number): Promise<void> {
    const logs = await this.provider.getLogs({
      address: this.config.factoryAddress,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      try {
        const parsed = this.factoryInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed) continue;

        if (parsed.name === "LotteryCreated") {
          const lotteryAddr = parsed.args.lottery.toLowerCase();
          this.lotteries.add(lotteryAddr);

          await this.prisma.lottery.upsert({
            where: { address: lotteryAddr },
            update: {},
            create: {
              address: lotteryAddr,
              creator: parsed.args.creator,
              entryFee: parsed.args.entryFee.toString(),
              maxTickets: Number(parsed.args.maxTickets),
              drawInterval: Number(parsed.args.drawInterval),
              blockNumber: log.blockNumber,
            },
          });

          // Create initial round
          await this.prisma.round.upsert({
            where: { lotteryId_roundNumber: { lotteryId: lotteryAddr, roundNumber: 1 } },
            update: {},
            create: {
              lotteryId: lotteryAddr,
              roundNumber: 1,
              blockNumber: log.blockNumber,
            },
          });

          this._emit("lottery:created", { address: lotteryAddr });
          this.logger.info({ lottery: lotteryAddr }, "New lottery indexed");
        }
      } catch { /* skip unparseable */ }
    }
  }

  private async _processRegistryEvents(from: number, to: number): Promise<void> {
    const logs = await this.provider.getLogs({
      address: this.config.registryAddress,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      try {
        const parsed = this.registryInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed) continue;

        if (parsed.name === "AgentRegistered") {
          await this.prisma.agent.upsert({
            where: { address: parsed.args.agent },
            update: { isActive: true, stake: parsed.args.stake.toString() },
            create: {
              address: parsed.args.agent,
              stake: parsed.args.stake.toString(),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            },
          });
          this._emit("agent:registered", { address: parsed.args.agent });
        }

        if (parsed.name === "AgentDeregistered") {
          await this.prisma.agent.update({
            where: { address: parsed.args.agent },
            data: { isActive: false, stake: "0" },
          });
          this._emit("agent:deregistered", { address: parsed.args.agent });
        }
      } catch { /* skip */ }
    }
  }

  private async _processLotteryEvents(lotteryAddr: string, from: number, to: number): Promise<void> {
    const logs = await this.provider.getLogs({
      address: lotteryAddr,
      fromBlock: from,
      toBlock: to,
    });

    for (const log of logs) {
      try {
        const parsed = this.lotteryInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (!parsed) continue;

        const lottery = await this.prisma.lottery.findUnique({ where: { address: lotteryAddr } });
        if (!lottery) continue;

        if (parsed.name === "TicketPurchased") {
          const roundNumber = Number(parsed.args.roundId);
          const round = await this._ensureRound(lottery.id, roundNumber, log.blockNumber);

          await this.prisma.ticket.create({
            data: {
              roundId: round.id,
              commitmentHash: parsed.args.commitment,
              leafIndex: Number(parsed.args.leafIndex),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            },
          });

          await this.prisma.round.update({
            where: { id: round.id },
            data: { ticketCount: { increment: 1 } },
          });

          this._emit("ticket:purchased", { lottery: lotteryAddr, round: roundNumber });
        }

        if (parsed.name === "WinnerSelected") {
          const roundNumber = Number(parsed.args.roundId);
          const round = await this._ensureRound(lottery.id, roundNumber, log.blockNumber);

          await this.prisma.round.update({
            where: { id: round.id },
            data: {
              winnerIndex: Number(parsed.args.winnerIndex),
              prizePool: parsed.args.prizeAmount.toString(),
              status: "CLAIMABLE",
              drawnAt: new Date(),
            },
          });

          this._emit("round:drawn", {
            lottery: lotteryAddr,
            round: roundNumber,
            winnerIndex: Number(parsed.args.winnerIndex),
          });
        }

        if (parsed.name === "PrizeClaimed") {
          const roundNumber = Number(parsed.args.roundId);
          const round = await this._ensureRound(lottery.id, roundNumber, log.blockNumber);

          await this.prisma.claim.create({
            data: {
              roundId: round.id,
              nullifierHash: parsed.args.nullifierHash,
              recipient: parsed.args.recipient,
              amount: parsed.args.amount.toString(),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            },
          });

          await this.prisma.round.update({
            where: { id: round.id },
            data: { claimed: true, status: "SETTLED", claimedAt: new Date() },
          });

          this._emit("round:claimed", {
            lottery: lotteryAddr,
            round: roundNumber,
            recipient: parsed.args.recipient,
          });
        }

        if (parsed.name === "RoundAdvanced") {
          const newRound = Number(parsed.args.newRoundId);
          await this._ensureRound(lottery.id, newRound, log.blockNumber);
          this._emit("round:advanced", { lottery: lotteryAddr, round: newRound });
        }
      } catch { /* skip */ }
    }
  }

  private async _ensureRound(lotteryId: string, roundNumber: number, blockNumber: number) {
    return this.prisma.round.upsert({
      where: { lotteryId_roundNumber: { lotteryId, roundNumber } },
      update: {},
      create: { lotteryId, roundNumber, blockNumber },
    });
  }

  private _emit(type: string, data: unknown): void {
    this.onEvent?.({ type, data });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.logger.info("Indexer stopped");
  }
}
