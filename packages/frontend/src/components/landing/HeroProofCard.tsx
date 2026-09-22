export function HeroProofCard() {
  return (
    <div className="relative mx-auto max-w-md">
      {/* floating mini badges */}
      <div className="absolute -left-6 top-12 z-20 hidden animate-float rounded-xl border border-gold/20 bg-surface-1/90 px-4 py-2.5 backdrop-blur sm:block">
        <div className="flex items-center gap-2 text-xs font-medium text-gold-bright">
          <span className="h-2 w-2 rounded-full bg-gold-bright animate-glow-pulse" />
          VRF verified
        </div>
      </div>
      <div
        className="absolute -right-4 bottom-16 z-20 hidden animate-float-slow rounded-xl border border-cyan/20 bg-surface-1/90 px-4 py-2.5 backdrop-blur sm:block"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-cyan">
          <span className="h-2 w-2 rounded-full bg-cyan animate-glow-pulse" />
          nullifier unique
        </div>
      </div>

      {/* main card */}
      <div className="glass-strong glow relative z-10 rounded-3xl p-6">
        {/* header */}
        <div className="flex items-center justify-between border-b border-surface-3/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 font-mono text-sm text-accent-bright">
              AI
            </div>
            <div>
              <div className="font-mono text-sm text-text-primary">agent_0xa3f2</div>
              <div className="text-[11px] text-text-muted">evaluating round #7</div>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-blink" />
            active
          </span>
        </div>

        {/* private strategy */}
        <div className="mt-4 rounded-xl border border-surface-3/70 bg-surface-0/40 p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Private strategy
            </span>
            <span className="flex items-center gap-1 text-[11px] text-accent-bright">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
              hidden
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-surface-3" />
            <div className="h-2 w-full rounded-full bg-surface-3" />
            <div className="h-2 w-1/2 rounded-full bg-surface-3" />
          </div>
        </div>

        {/* connector */}
        <div className="flex justify-center py-1">
          <svg className="h-6 w-6 text-accent-bright" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>

        {/* zk proof */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-bright">
              Groth16 proof
            </span>
            <span className="font-mono text-[11px] text-success">✓ valid</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="shimmer h-full w-full rounded-full" style={{ background: "linear-gradient(90deg, var(--accent-dim), var(--accent-bright))" }} />
          </div>
        </div>

        {/* on-chain result */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-surface-3/70 bg-surface-0/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Commitment</div>
            <div className="mt-1 truncate font-mono text-xs text-text-secondary">0x7b3e…c1a9</div>
          </div>
          <div className="rounded-xl border border-surface-3/70 bg-surface-0/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Merkle leaf</div>
            <div className="mt-1 font-mono text-xs text-gold-bright">#128</div>
          </div>
        </div>
      </div>

      {/* glow underlay */}
      <div className="absolute inset-0 -z-0 scale-95 rounded-3xl bg-accent/20 blur-3xl" />
    </div>
  );
}
