import { ethers } from "ethers";
import { EventEmitter } from "events";

export interface ChainEvent {
  type: string;
  lotteryAddress?: string;
  roundId?: number;
  data: Record<string, unknown>;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Monitors contract events for agent decision-making.
 * Subscribes to lottery factory and individual lottery events.
 */
export class EventMonitor extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private factoryAddress: string;
  private subscriptions: Map<string, ethers.Contract> = new Map();
  private running = false;
  private pollInterval: number;

  private factoryInterface = new ethers.Interface([
    "event LotteryCreated(address indexed lottery, address indexed creator, uint256 entryFee, uint32 maxTickets, uint32 drawInterval)",
  ]);

  private lotteryInterface = new ethers.Interface([
    "event TicketPurchased(uint256 indexed roundId, bytes32 indexed commitment, uint32 leafIndex)",
    "event DrawRequested(uint256 indexed roundId, uint256 vrfRequestId)",
    "event WinnerSelected(uint256 indexed roundId, uint32 winnerIndex, uint256 prizeAmount)",
    "event PrizeClaimed(uint256 indexed roundId, bytes32 nullifierHash, address recipient, uint256 amount)",
    "event RoundAdvanced(uint256 indexed newRoundId)",
  ]);

  constructor(
    provider: ethers.JsonRpcProvider,
    factoryAddress: string,
    pollInterval: number = 5000
  ) {
    super();
    this.provider = provider;
    this.factoryAddress = factoryAddress;
    this.pollInterval = pollInterval;
  }

  async start(): Promise<void> {
    this.running = true;

    // Monitor factory for new lotteries
    const factoryContract = new ethers.Contract(
      this.factoryAddress,
      this.factoryInterface,
      this.provider
    );

    factoryContract.on("LotteryCreated", (lottery, creator, entryFee, maxTickets, drawInterval, event) => {
      this.emit("event", {
        type: "lottery:created",
        lotteryAddress: lottery,
        data: { creator, entryFee, maxTickets, drawInterval },
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      } satisfies ChainEvent);

      this.watchLottery(lottery);
    });

    this.subscriptions.set(this.factoryAddress, factoryContract);
  }

  watchLottery(address: string): void {
    if (this.subscriptions.has(address)) return;

    const contract = new ethers.Contract(address, this.lotteryInterface, this.provider);

    contract.on("TicketPurchased", (roundId, commitment, leafIndex, event) => {
      this.emit("event", {
        type: "ticket:purchased",
        lotteryAddress: address,
        roundId: Number(roundId),
        data: { commitment, leafIndex: Number(leafIndex) },
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      } satisfies ChainEvent);
    });

    contract.on("WinnerSelected", (roundId, winnerIndex, prizeAmount, event) => {
      this.emit("event", {
        type: "round:drawn",
        lotteryAddress: address,
        roundId: Number(roundId),
        data: { winnerIndex: Number(winnerIndex), prizeAmount },
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      } satisfies ChainEvent);
    });

    contract.on("PrizeClaimed", (roundId, nullifierHash, recipient, amount, event) => {
      this.emit("event", {
        type: "round:claimed",
        lotteryAddress: address,
        roundId: Number(roundId),
        data: { nullifierHash, recipient, amount },
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      } satisfies ChainEvent);
    });

    contract.on("RoundAdvanced", (newRoundId, event) => {
      this.emit("event", {
        type: "round:advanced",
        lotteryAddress: address,
        roundId: Number(newRoundId),
        data: {},
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      } satisfies ChainEvent);
    });

    this.subscriptions.set(address, contract);
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const contract of this.subscriptions.values()) {
      contract.removeAllListeners();
    }
    this.subscriptions.clear();
  }
}
