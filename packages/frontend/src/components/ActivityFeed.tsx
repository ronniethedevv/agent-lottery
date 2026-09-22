"use client";

import { useWebSocket } from "@/hooks/useWebSocket";

const EVENT_LABELS: Record<string, { label: string; dot: string }> = {
  "lottery:created": { label: "New Lottery", dot: "bg-accent-bright" },
  "ticket:purchased": { label: "Ticket Bought", dot: "bg-success" },
  "round:drawn": { label: "Draw Complete", dot: "bg-gold-bright" },
  "round:claimed": { label: "Prize Claimed", dot: "bg-accent-bright" },
  "round:advanced": { label: "New Round", dot: "bg-cyan" },
  "agent:registered": { label: "Agent Joined", dot: "bg-success" },
  "agent:deregistered": { label: "Agent Left", dot: "bg-danger" },
  connected: { label: "Connected", dot: "bg-text-muted" },
};

export function ActivityFeed() {
  const { events } = useWebSocket();

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Live Activity
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-blink" />
          streaming
        </span>
      </div>
      <div className="max-h-96 space-y-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 h-10 w-10 rounded-full border-2 border-dashed border-surface-3" />
            <p className="text-xs text-text-muted">Waiting for events…</p>
          </div>
        )}
        {events.map((event, i) => {
          const meta = EVENT_LABELS[event.type] || {
            label: event.type,
            dot: "bg-text-muted",
          };
          const time = new Date(event.timestamp).toLocaleTimeString();

          return (
            <div
              key={`${event.timestamp}-${i}`}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-colors hover:bg-surface-2/50"
            >
              <span className="flex items-center gap-2.5 font-medium text-text-primary">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span className="font-mono text-text-muted">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
