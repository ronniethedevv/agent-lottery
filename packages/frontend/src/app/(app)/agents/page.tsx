"use client";

import { useAgents } from "@/hooks/useApi";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

interface AgentData {
  address: string;
  stake: string;
  reputation: number;
  isActive: boolean;
  registeredAt: string;
}

export default function AgentsPage() {
  const { data, isLoading } = useAgents() as {
    data: { agents: AgentData[]; total: number } | undefined;
    isLoading: boolean;
  };

  const formatBNB = (wei: string) => (Number(BigInt(wei || "0")) / 1e18).toFixed(4);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const timeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Registered autonomous agents and their standings"
      />

      {isLoading ? (
        <div className="glass h-64 animate-pulse rounded-2xl" />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3/60 text-left text-xs text-text-muted">
                <th className="px-6 py-4 font-medium">Rank</th>
                <th className="px-6 py-4 font-medium">Address</th>
                <th className="px-6 py-4 text-right font-medium">Stake</th>
                <th className="px-6 py-4 text-right font-medium">Reputation</th>
                <th className="px-6 py-4 text-right font-medium">Registered</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.agents?.map((agent, i) => (
                <tr
                  key={agent.address}
                  className="group border-b border-surface-3/30 transition-colors last:border-0 hover:bg-surface-2/40"
                >
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-semibold ${
                        i === 0
                          ? "bg-gold/15 text-gold-bright"
                          : i === 1
                          ? "bg-surface-4/60 text-text-secondary"
                          : i === 2
                          ? "bg-accent/10 text-accent-bright"
                          : "text-text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/agents/${agent.address}`}
                      className="font-mono text-accent-bright transition-colors hover:text-accent"
                    >
                      {shortAddr(agent.address)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-text-primary">
                    {formatBNB(agent.stake)} <span className="text-text-muted">BNB</span>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-text-primary">
                    {agent.reputation}
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-text-muted">
                    {timeAgo(agent.registeredAt)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        agent.isActive
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {agent.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {!data?.agents?.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-muted">
                    No agents registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
