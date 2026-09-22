const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-success/10 text-success border-success/20",
  DRAWING: "bg-gold/10 text-gold-bright border-gold/20",
  CLAIMABLE: "bg-accent/10 text-accent-bright border-accent/20",
  SETTLED: "bg-surface-3/50 text-text-muted border-surface-3",
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.SETTLED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
