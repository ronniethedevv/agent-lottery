"use client";

import { useAgent } from "@/hooks/useApi";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";

export default function AgentDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { data: agent, isLoading } = useAgent(address) as { data: any; isLoading: boolean };

  const formatBNB = (wei: string) => (Number(BigInt(wei || "0")) / 1e18).toFixed(4);

  if (isLoading) {
    return <div className="glass h-40 animate-pulse rounded-2xl" />;
  }
  if (!agent) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-danger">
        Agent not found
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/agents"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to agents
      </Link>

      <div className="animate-fade-up mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 font-mono text-lg text-accent-bright">
          AI
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Agent
          </h1>
          <p className="mt-0.5 break-all font-mono text-xs text-text-muted">{address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stake" value={`${formatBNB(agent.stake)} BNB`} />
        <StatCard label="Reputation" value={agent.reputation} accent />
        <StatCard label="Total Won" value={`${formatBNB(agent.stats?.totalWon ?? "0")} BNB`} gold />
        <StatCard label="Prizes Claimed" value={agent.stats?.totalClaims ?? 0} />
      </div>

      <div className="mt-6 glass rounded-2xl p-6">
        <h3 className="mb-5 font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Agent Info
        </h3>
        <dl className="space-y-3 text-sm">
          <Row label="Status">
            <span className={agent.isActive ? "text-success" : "text-danger"}>
              {agent.isActive ? "Active" : "Inactive"}
            </span>
          </Row>
          <Row label="Registered">
            <span className="text-text-secondary">
              {new Date(agent.registeredAt).toLocaleString()}
            </span>
          </Row>
          <Row label="Address" last>
            <span className="break-all font-mono text-xs text-text-secondary">{address}</span>
          </Row>
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${last ? "" : "border-b border-surface-3/50 pb-3"}`}>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
