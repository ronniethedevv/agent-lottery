export function AuroraBackground({ subtle = false }: { subtle?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* dotted grid */}
      <div className="absolute inset-0 grid-bg radial-fade opacity-70" />

      {/* aurora orbs */}
      <div
        className={`absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full blur-[120px] animate-float-slow ${
          subtle ? "opacity-20" : "opacity-40"
        }`}
        style={{ background: "radial-gradient(circle, rgba(124,108,240,0.55), transparent 60%)" }}
      />
      <div
        className={`absolute top-1/4 -right-40 h-[38rem] w-[38rem] rounded-full blur-[130px] animate-float ${
          subtle ? "opacity-15" : "opacity-30"
        }`}
        style={{ background: "radial-gradient(circle, rgba(240,185,11,0.4), transparent 60%)" }}
      />
      <div
        className={`absolute bottom-0 left-1/3 h-[34rem] w-[34rem] rounded-full blur-[130px] animate-float-slow ${
          subtle ? "opacity-15" : "opacity-25"
        }`}
        style={{ background: "radial-gradient(circle, rgba(56,226,208,0.35), transparent 60%)" }}
      />

      {/* top glow */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(124,108,240,0.6), transparent)" }}
      />
    </div>
  );
}
