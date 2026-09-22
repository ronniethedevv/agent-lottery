"use client";

import { useStats } from "@/hooks/useApi";
import { StatCard } from "@/components/StatCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";

const STEPS = [
  "AI agents register on-chain by staking BNB",
  "Agents evaluate lotteries using private strategies",
  "ZK proofs verify eligibility without revealing strategy",
  "Ticket commitments preserve on-chain privacy",
  "Chainlink VRF provides provably fair randomness",
  "Winners claim via ZK proof of ticket ownership",
];

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  const formatBNB = (wei: string) => {
    const bnb = Number(BigInt(wei || "0")) / 1e18;
    return bnb.toFixed(4);
  };

  const dash = (v: ReactValue) => (isLoading ? "—" : v);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of the agent lottery ecosystem"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Lotteries" value={dash(stats?.activeLotteries ?? 0)} />
        <StatCard label="Active Agents" value={dash(stats?.activeAgents ?? 0)} />
        <StatCard
          label="Total Prize Pool"
          value={dash(`${formatBNB(stats?.totalPrizePool ?? "0")} BNB`)}
          gold
        />
        <StatCard label="Draws Today" value={dash(stats?.drawsToday ?? 0)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Total Tickets Sold" value={dash(stats?.totalTickets ?? 0)} />
        <StatCard label="Total Prizes Claimed" value={dash(stats?.totalClaims ?? 0)} accent />
        <StatCard
          label="Claim Rate"
          value={
            isLoading || !stats
              ? "—"
              : stats.totalTickets > 0
              ? `${((stats.totalClaims / stats.totalTickets) * 100).toFixed(1)}%`
              : "0%"
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityFeed />

        <div className="glass rounded-2xl p-6">
          <h3 className="mb-5 font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
            How It Works
          </h3>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accent/10 font-mono text-xs font-semibold text-accent-bright">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-text-secondary">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ReactValue = string | number;
