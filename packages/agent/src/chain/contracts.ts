import { ethers, type Signer } from "ethers";
import type { DeploymentAddresses, LotteryConfig, RoundState } from "@agent-lottery/common";

const AGENT_REGISTRY_ABI = [
  "function registerAgent() external payable",
  "function deregisterAgent() external",
  "function requestDeregistration() external",
  "function isRegistered(address agent) external view returns (bool)",
  "function getAgentInfo(address agent) external view returns (tuple(uint256 stake, uint256 reputation, uint64 registeredAt, bool isActive))",
  "function getMinStake() external view returns (uint256)",
  "function getAgentCount() external view returns (uint256)",
  "event AgentRegistered(address indexed agent, uint256 stake)",
  "event AgentDeregistered(address indexed agent, uint256 stakeReturned)",
];

const LOTTERY_FACTORY_ABI = [
  "function createLottery(tuple(uint256 entryFee, uint32 maxTickets, uint32 drawInterval, uint32 maxRounds, uint16 creatorFeeRate) config) external returns (address)",
  "function getLotteries(uint256 offset, uint256 limit) external view returns (address[])",
  "function getLotteryCount() external view returns (uint256)",
  "function isLottery(address addr) external view returns (bool)",
  "event LotteryCreated(address indexed lottery, address indexed creator, uint256 entryFee, uint32 maxTickets, uint32 drawInterval)",
];

const LOTTERY_ABI = [
  "function enterWithProof(uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC, uint256[] eligibilityPublicInputs, uint256[2] ticketProofA, uint256[2][2] ticketProofB, uint256[2] ticketProofC, uint256[] ticketPublicInputs) external payable",
  "function triggerDraw() external",
  "function claimPrize(uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC, uint256[] publicInputs) external",
  "function getCurrentRound() external view returns (uint256)",
  "function getRoundState(uint256 roundId) external view returns (tuple(uint256 prizePool, uint32 ticketCount, bytes32 merkleRoot, uint32 winnerIndex, bool claimed, uint8 status, uint64 startedAt, uint64 drawnAt))",
  "function getEntryFee() external view returns (uint256)",
  "function getMaxTickets() external view returns (uint32)",
  "function getDrawInterval() external view returns (uint32)",
  "function getCreator() external view returns (address)",
  "function isRoundDrawable() external view returns (bool)",
  "event TicketPurchased(uint256 indexed roundId, bytes32 indexed commitment, uint32 leafIndex)",
  "event DrawRequested(uint256 indexed roundId, uint256 vrfRequestId)",
  "event WinnerSelected(uint256 indexed roundId, uint32 winnerIndex, uint256 prizeAmount)",
  "event PrizeClaimed(uint256 indexed roundId, bytes32 nullifierHash, address recipient, uint256 amount)",
  "event RoundAdvanced(uint256 indexed newRoundId)",
];

export class ContractClient {
  private addresses: DeploymentAddresses;
  private signer: Signer;
  private provider: ethers.Provider;

  private _registry: ethers.Contract | null = null;
  private _factory: ethers.Contract | null = null;
  private _lotteryCache: Map<string, ethers.Contract> = new Map();

  constructor(addresses: DeploymentAddresses, signer: Signer) {
    this.addresses = addresses;
    this.signer = signer;
    this.provider = signer.provider!;
  }

  get registry(): ethers.Contract {
    if (!this._registry) {
      this._registry = new ethers.Contract(this.addresses.agentRegistry, AGENT_REGISTRY_ABI, this.signer);
    }
    return this._registry;
  }

  get factory(): ethers.Contract {
    if (!this._factory) {
      this._factory = new ethers.Contract(this.addresses.lotteryFactory, LOTTERY_FACTORY_ABI, this.signer);
    }
    return this._factory;
  }

  lottery(address: string): ethers.Contract {
    let cached = this._lotteryCache.get(address);
    if (!cached) {
      cached = new ethers.Contract(address, LOTTERY_ABI, this.signer);
      this._lotteryCache.set(address, cached);
    }
    return cached;
  }

  // --- Agent Registry ---

  async registerAgent(stakeAmount: bigint): Promise<ethers.TransactionReceipt> {
    const tx = await this.registry.registerAgent({ value: stakeAmount });
    return tx.wait();
  }

  async isRegistered(address: string): Promise<boolean> {
    return this.registry.isRegistered(address);
  }

  async getAgentInfo(address: string) {
    return this.registry.getAgentInfo(address);
  }

  // --- Lottery Factory ---

  async createLottery(config: LotteryConfig): Promise<string> {
    const tx = await this.factory.createLottery({
      entryFee: config.entryFee,
      maxTickets: config.maxTickets,
      drawInterval: config.drawInterval,
      maxRounds: config.maxRounds,
      creatorFeeRate: config.creatorFeeRate,
    });
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return this.factory.interface.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((e: ethers.LogDescription | null) => e?.name === "LotteryCreated");

    return event?.args?.lottery;
  }

  async getLotteries(offset: number = 0, limit: number = 100): Promise<string[]> {
    return this.factory.getLotteries(offset, limit);
  }

  async getLotteryCount(): Promise<number> {
    const count = await this.factory.getLotteryCount();
    return Number(count);
  }

  // --- Lottery ---

  async getCurrentRound(lotteryAddress: string): Promise<number> {
    const round = await this.lottery(lotteryAddress).getCurrentRound();
    return Number(round);
  }

  async getRoundState(lotteryAddress: string, roundId: number): Promise<RoundState> {
    const state = await this.lottery(lotteryAddress).getRoundState(roundId);
    return {
      prizePool: state.prizePool,
      ticketCount: Number(state.ticketCount),
      merkleRoot: state.merkleRoot,
      winnerIndex: Number(state.winnerIndex),
      claimed: state.claimed,
      status: Number(state.status),
      startedAt: Number(state.startedAt),
      drawnAt: Number(state.drawnAt),
    };
  }

  async getEntryFee(lotteryAddress: string): Promise<bigint> {
    return this.lottery(lotteryAddress).getEntryFee();
  }

  async isRoundDrawable(lotteryAddress: string): Promise<boolean> {
    return this.lottery(lotteryAddress).isRoundDrawable();
  }

  async enterWithProof(
    lotteryAddress: string,
    eligibilityProof: { a: string[]; b: string[][]; c: string[] },
    eligibilityInputs: string[],
    ticketProof: { a: string[]; b: string[][]; c: string[] },
    ticketInputs: string[],
    entryFee: bigint
  ): Promise<ethers.TransactionReceipt> {
    const tx = await this.lottery(lotteryAddress).enterWithProof(
      eligibilityProof.a,
      eligibilityProof.b,
      eligibilityProof.c,
      eligibilityInputs,
      ticketProof.a,
      ticketProof.b,
      ticketProof.c,
      ticketInputs,
      { value: entryFee }
    );
    return tx.wait();
  }

  async triggerDraw(lotteryAddress: string): Promise<ethers.TransactionReceipt> {
    const tx = await this.lottery(lotteryAddress).triggerDraw();
    return tx.wait();
  }

  async claimPrize(
    lotteryAddress: string,
    proof: { a: string[]; b: string[][]; c: string[] },
    publicInputs: string[]
  ): Promise<ethers.TransactionReceipt> {
    const tx = await this.lottery(lotteryAddress).claimPrize(
      proof.a,
      proof.b,
      proof.c,
      publicInputs
    );
    return tx.wait();
  }
}
