"use client";

import { useLottery, useLotteryRounds } from "@/hooks/useApi";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";

export default function LotteryDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { data: lottery, isLoading } = useLottery(address) as { data: any; isLoading: boolean };
  const { data: rounds } = useLotteryRounds(address) as { data: any[] | undefined };

  const formatBNB = (wei: string) => (Number(BigInt(wei || "0")) / 1e18).toFixed(4);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  if (isLoading) {
    return <div className="glass h-40 animate-pulse rounded-2xl" />;
  }
  if (!lottery) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-danger">
        Lottery not found
      </div>
    );
  }

  const currentRound = lottery.rounds?.[0];

  return (
    <div>
      <Link
        href="/lotteries"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to lotteries
      </Link>

      <div className="animate-fade-up mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">
          Lottery {shortAddr(address)}
        </h1>
        <p className="mt-1.5 break-all font-mono text-xs text-text-muted">{address}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entry Fee" value={`${formatBNB(lottery.entryFee)} BNB`} />
        <StatCard label="Current Prize Pool" value={`${formatBNB(currentRound?.prizePool ?? "0")} BNB`} gold />
        <StatCard label="Tickets This Round" value={`${currentRound?.ticketCount ?? 0} / ${lottery.maxTickets}`} />
        <StatCard label="Current Round" value={currentRound?.roundNumber ?? 1} accent />
      </div>

      <div className="mt-6 glass rounded-2xl p-6">
        <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Ticket Commitments · Current Round
        </h3>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {!currentRound?.tickets?.length && (
            <p className="py-6 text-center text-xs text-text-muted">No tickets yet</p>
          )}
          {currentRound?.tickets?.map((ticket: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-surface-2/50"
            >
              <span className="font-mono text-text-secondary">
                {ticket.commitmentHash?.slice(0, 22)}…
              </span>
              <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-text-muted">
                leaf #{ticket.leafIndex}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 glass overflow-hidden rounded-2xl">
        <h3 className="border-b border-surface-3/60 px-6 py-4 font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Round History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3/60 text-left text-xs text-text-muted">
                <th className="px-6 py-3 font-medium">Round</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Tickets</th>
                <th className="px-6 py-3 text-right font-medium">Prize Pool</th>
                <th className="px-6 py-3 text-right font-medium">Winner</th>
                <th className="px-6 py-3 text-right font-medium">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {rounds?.map((round: any) => (
                <tr
                  key={round.id}
                  className="border-b border-surface-3/30 transition-colors last:border-0 hover:bg-surface-2/40"
                >
                  <td className="px-6 py-3 font-mono text-text-primary">#{round.roundNumber}</td>
                  <td className="px-6 py-3"><StatusPill status={round.status} /></td>
                  <td className="px-6 py-3 text-right tabular-nums text-text-primary">
                    {round._count?.tickets ?? round.ticketCount}
                  </td>
                  <td className="px-6 py-3 text-right font-medium tabular-nums text-gold-bright">
                    {formatBNB(round.prizePool)} BNB
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-text-secondary">
                    {round.winnerIndex ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {round.claimed ? (
                      <span className="text-success">✓</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rounds?.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-text-muted">
                    No rounds recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
