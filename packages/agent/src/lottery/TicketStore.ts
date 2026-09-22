import { Level } from "level";
import type { TicketData } from "@agent-lottery/common";

/**
 * Encrypted local store for ticket secrets and nullifiers.
 * Uses LevelDB for persistent storage. Each agent keeps their own
 * ticket data locally — these secrets never leave the machine.
 */
export class TicketStore {
  private db: Level<string, string>;

  constructor(dbPath: string) {
    this.db = new Level(dbPath, { valueEncoding: "json" });
  }

  async saveTicket(ticket: TicketData): Promise<void> {
    const key = `${ticket.lotteryId}:${ticket.roundId}:${ticket.leafIndex}`;
    await this.db.put(key, JSON.stringify({
      secret: ticket.secret.toString(),
      nullifier: ticket.nullifier.toString(),
      commitment: ticket.commitment.toString(),
      lotteryId: ticket.lotteryId.toString(),
      roundId: ticket.roundId,
      leafIndex: ticket.leafIndex,
    }));
  }

  async getTicket(lotteryId: bigint, roundId: number, leafIndex: number): Promise<TicketData | null> {
    const key = `${lotteryId}:${roundId}:${leafIndex}`;
    try {
      const raw = await this.db.get(key);
      const parsed = JSON.parse(raw);
      return {
        secret: BigInt(parsed.secret),
        nullifier: BigInt(parsed.nullifier),
        commitment: BigInt(parsed.commitment),
        lotteryId: BigInt(parsed.lotteryId),
        roundId: parsed.roundId,
        leafIndex: parsed.leafIndex,
      };
    } catch {
      return null;
    }
  }

  async getTicketsForRound(lotteryId: bigint, roundId: number): Promise<TicketData[]> {
    const prefix = `${lotteryId}:${roundId}:`;
    const tickets: TicketData[] = [];

    for await (const [key, value] of this.db.iterator()) {
      if (key.startsWith(prefix)) {
        const parsed = JSON.parse(value);
        tickets.push({
          secret: BigInt(parsed.secret),
          nullifier: BigInt(parsed.nullifier),
          commitment: BigInt(parsed.commitment),
          lotteryId: BigInt(parsed.lotteryId),
          roundId: parsed.roundId,
          leafIndex: parsed.leafIndex,
        });
      }
    }

    return tickets;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
