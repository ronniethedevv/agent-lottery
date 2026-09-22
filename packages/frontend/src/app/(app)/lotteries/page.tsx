"use client";

import { useLotteries } from "@/hooks/useApi";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";

interface LotteryData {
  address: string;
  creator: string;
  entryFee: string;
  maxTickets: number;
  drawInterval: number;
  status: string;
  createdAt: string;
  rounds: Array<{
    roundNumber: number;
    ticketCount: number;
    prizePool: string;
    status: string;
  }>;
}

export default function LotteriesPage() {
  const { data, isLoading } = useLotteries() as {
    data: { lotteries: LotteryData[]; total: number } | undefined;
    isLoading: boolean;
  };

  const formatBNB = (wei: string) => (Number(BigInt(wei || "0")) / 1e18).toFixed(4);
  const formatInterval = (s: number) =>
    s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  return (
    <div>
      <PageHeader title="Lotteries" subtitle="All active lottery instances on-chain" />

      {isLoading ? (
        <LoadingGrid />
      ) : data?.lotteries?.length ? (
        <div className="grid gap-4">
          {data.lotteries.map((lottery) => {
            const round = lottery.rounds?.[0];
            const filled = round ? (round.ticketCount / lottery.maxTickets) * 100 : 0;
            return (
              <Link
                key={lottery.address}
                href={`/lotteries/${lottery.address}`}
                className="card-hover glass block rounded-2xl p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-sm text-text-primary">
                    {shortAddr(lottery.address)}
                  </span>
                  <StatusPill status={round?.status ?? "OPEN"} />
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Metric label="Entry Fee" value={`${formatBNB(lottery.entryFee)} BNB`} />
                  <Metric label="Prize Pool" value={`${formatBNB(round?.prizePool ?? "0")} BNB`} gold />
                  <Metric
                    label="Tickets"
                    value={`${round?.ticketCount ?? 0} / ${lottery.maxTickets}`}
                  />
                  <Metric label="Draw Every" value={formatInterval(lottery.drawInterval)} />
                </div>

                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-accent-gradient transition-all"
                      style={{ width: `${Math.min(filled, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2.5 text-xs text-text-muted">
                    Created by {shortAddr(lottery.creator)} · Round {round?.roundNumber ?? 1}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No lotteries yet. Agents will create them once running." />
      )}
    </div>
  );
}

function Metric({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${gold ? "text-gold-bright" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass h-36 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
      <div className="mb-4 h-12 w-12 rounded-2xl border-2 border-dashed border-surface-3" />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
