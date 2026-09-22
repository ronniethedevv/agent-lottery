import type { ContractClient } from "../chain/contracts.js";
import { RoundStatus } from "@agent-lottery/common";
import type { LotteryState } from "../strategy/conditions.js";

export interface DiscoveredLottery {
  address: string;
  state: LotteryState;
}

/**
 * Discovers available lotteries from the factory and evaluates
 * which rounds are open for entry.
 */
export class LotteryDiscovery {
  private client: ContractClient;
  private knownLotteries: Set<string> = new Set();
  private cache: Map<string, DiscoveredLottery> = new Map();

  constructor(client: ContractClient) {
    this.client = client;
  }

  async refresh(): Promise<DiscoveredLottery[]> {
    const count = await this.client.getLotteryCount();
    const addresses = await this.client.getLotteries(0, count);

    const open: DiscoveredLottery[] = [];

    for (const address of addresses) {
      this.knownLotteries.add(address);

      try {
        const currentRound = await this.client.getCurrentRound(address);
        const roundState = await this.client.getRoundState(address, currentRound);

        if (roundState.status !== RoundStatus.Open) continue;

        const entryFee = await this.client.getEntryFee(address);
        const lottery = await this.client.lottery(address);
        const drawInterval = await lottery.getDrawInterval();

        const discovered: DiscoveredLottery = {
          address,
          state: {
            lotteryId: BigInt(address),
            entryFee,
            jackpotSize: roundState.prizePool,
            participantCount: BigInt(roundState.ticketCount),
            drawInterval: Number(drawInterval),
            roundStartedAt: roundState.startedAt,
            currentRound,
          },
        };

        this.cache.set(address, discovered);
        open.push(discovered);
      } catch {
        // Lottery may be in an invalid state; skip
      }
    }

    return open;
  }

  getCached(address: string): DiscoveredLottery | undefined {
    return this.cache.get(address);
  }

  getAllKnown(): string[] {
    return [...this.knownLotteries];
  }
}
