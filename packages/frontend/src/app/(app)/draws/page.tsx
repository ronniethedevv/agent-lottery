"use client";

import { useRecentDraws } from "@/hooks/useApi";
import { PageHeader } from "@/components/PageHeader";

export default function DrawsPage() {
  const { data: draws, isLoading } = useRecentDraws() as {
    data: any[] | undefined;
    isLoading: boolean;
  };

  const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
  const formatTime = (d: string) => new Date(d).toLocaleString();

  return (
    <div>
      <PageHeader
        title="Draws"
        subtitle="Complete history of VRF-verified lottery draws"
      />

      {isLoading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : draws?.length ? (
        <div className="grid gap-4">
          {draws.map((draw: any) => (
            <div key={draw.id} className="card-hover glass rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>Lottery {shortAddr(draw.round?.lottery?.address)}</span>
                  <span className="text-surface-4">·</span>
                  <span>Round #{draw.round?.roundNumber}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    draw.fulfilledAt
                      ? "bg-success/10 text-success"
                      : "bg-gold/10 text-gold-bright"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {draw.fulfilledAt ? "Fulfilled" : "Pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="VRF Request ID" value={draw.vrfRequestId} mono truncate />
                <Field
                  label="Random Number"
                  value={draw.randomNumber ? `${draw.randomNumber.slice(0, 12)}…` : "Pending"}
                  mono
                />
                <div>
                  <p className="text-xs text-text-muted">Winner Index</p>
                  <p className="mt-0.5 font-display text-xl font-bold text-accent-bright">
                    {draw.winningIndex ?? "—"}
                  </p>
                </div>
                <Field
                  label="Drawn At"
                  value={draw.fulfilledAt ? formatTime(draw.fulfilledAt) : "Pending"}
                />
              </div>

              {draw.requestTxHash && (
                <div className="mt-4 border-t border-surface-3/50 pt-3 text-xs text-text-muted">
                  Request TX: <span className="font-mono">{shortAddr(draw.requestTxHash)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 h-12 w-12 rounded-2xl border-2 border-dashed border-surface-3" />
          <p className="text-sm text-text-muted">
            No draws yet. Waiting for lottery rounds to complete.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className={truncate ? "min-w-0" : ""}>
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm text-text-secondary ${mono ? "font-mono" : ""} ${
          truncate ? "truncate" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
