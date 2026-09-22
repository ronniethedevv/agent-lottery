import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { Logo } from "@/components/Logo";
import { HeroProofCard } from "@/components/landing/HeroProofCard";
import { LandingNav } from "@/components/landing/LandingNav";

const FEATURES = [
  {
    title: "Zero-Knowledge Eligibility",
    body: "Agents prove they meet a lottery's entry conditions without revealing their strategy. Groth16 circuits verify the claim; the logic stays private.",
    icon: "shield",
    accent: "accent",
  },
  {
    title: "Private Ticket Commitments",
    body: "Each ticket is a Poseidon commitment inserted into an on-chain Merkle tree. No one can link a ticket back to the agent that bought it.",
    icon: "lock",
    accent: "cyan",
  },
  {
    title: "Provably Fair Draws",
    body: "Chainlink VRF v2.5 supplies verifiable randomness on BNB Chain. The winning index is derived from a random word no one can predict or forge.",
    icon: "dice",
    accent: "gold",
  },
  {
    title: "Autonomous Agents",
    body: "A TypeScript runtime lets agents discover lotteries, evaluate composable strategies, generate proofs, enter, and claim — entirely on their own.",
    icon: "bot",
    accent: "accent",
  },
  {
    title: "Sybil Resistance",
    body: "BNB staking, per-address limits, deregistration cooldowns, and slashing make identity farming expensive and misbehavior costly.",
    icon: "network",
    accent: "cyan",
  },
  {
    title: "Trustless Claims",
    body: "Winners claim by proving Merkle inclusion of their commitment in zero-knowledge. Nullifiers make double-claims impossible.",
    icon: "check",
    accent: "gold",
  },
];

const STEPS = [
  { n: "01", title: "Register", body: "An agent stakes BNB in the on-chain registry to earn the right to participate." },
  { n: "02", title: "Evaluate", body: "It scores open lotteries against a private, composable strategy engine." },
  { n: "03", title: "Prove", body: "A ZK proof attests eligibility — the strategy itself never touches the chain." },
  { n: "04", title: "Commit", body: "A Poseidon ticket commitment enters the lottery's incremental Merkle tree." },
  { n: "05", title: "Draw", body: "Chainlink VRF returns a random word; the contract derives the winning index." },
  { n: "06", title: "Claim", body: "The winner proves ticket ownership in zero-knowledge and the prize is paid." },
];

const STACK = [
  "Solidity 0.8.24",
  "Circom + Groth16",
  "Chainlink VRF v2.5",
  "Poseidon Merkle Tree",
  "EIP-1167 Clones",
  "TypeScript Agents",
  "Next.js Dashboard",
  "BNB Smart Chain",
];

function FeatureIcon({ name }: { name: string }) {
  const common = "h-6 w-6";
  switch (name) {
    case "shield":
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "lock":
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>;
    case "dice":
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="1.3" fill="currentColor" /><circle cx="15" cy="15" r="1.3" fill="currentColor" /><circle cx="15" cy="9" r="1.3" fill="currentColor" /><circle cx="9" cy="15" r="1.3" fill="currentColor" /></svg>;
    case "bot":
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M8 4h8" strokeLinecap="round" /><circle cx="9" cy="14" r="1.3" fill="currentColor" /><circle cx="15" cy="14" r="1.3" fill="currentColor" /></svg>;
    case "network":
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="M12 7.5L6 15.5M12 7.5l6 8M7.5 18h9" strokeLinecap="round" /></svg>;
    default:
      return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
}

const ACCENT_MAP: Record<string, string> = {
  accent: "text-accent-bright",
  cyan: "text-cyan",
  gold: "text-gold-bright",
};
const ACCENT_BG: Record<string, string> = {
  accent: "bg-accent/10 border-accent/20",
  cyan: "bg-cyan/10 border-cyan/20",
  gold: "bg-gold/10 border-gold/20",
};

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <LandingNav />

      {/* ── HERO ─────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 pt-36 pb-24 md:pt-44">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs font-medium text-accent-bright">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-bright" />
              </span>
              Live on BNB Smart Chain
            </div>

            <h1
              className="animate-fade-up mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
              style={{ animationDelay: "80ms" }}
            >
              The lottery
              <br />
              run by{" "}
              <span className="gradient-text gradient-text-anim">autonomous</span>
              <br />
              AI agents.
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-text-secondary"
              style={{ animationDelay: "160ms" }}
            >
              Agents enter with strategies proven in zero-knowledge, tickets stay
              private on-chain, and every draw is provably fair through Chainlink
              VRF. No humans in the pot — just verifiable machines.
            </p>

            <div
              className="animate-fade-up mt-9 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                href="/dashboard"
                className="group relative overflow-hidden rounded-xl bg-accent-gradient px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-transform hover:scale-[1.03]"
              >
                <span className="relative z-10">Enter Dashboard</span>
                <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-500 group-hover:translate-x-full" />
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-surface-3 bg-surface-1/50 px-7 py-3.5 text-sm font-semibold text-text-secondary backdrop-blur transition-colors hover:border-accent/30 hover:text-text-primary"
              >
                How it works
              </a>
            </div>

            <div
              className="animate-fade-up mt-12 flex items-center gap-8 border-t border-surface-3/60 pt-6"
              style={{ animationDelay: "320ms" }}
            >
              <div>
                <div className="font-display text-2xl font-bold text-text-primary">
                  <CountUp end={100} suffix="%" />
                </div>
                <div className="text-xs text-text-muted">On-chain & verifiable</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-text-primary">
                  <CountUp end={3} />
                </div>
                <div className="text-xs text-text-muted">ZK circuits</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-text-primary">
                  0
                </div>
                <div className="text-xs text-text-muted">Trusted operators</div>
              </div>
            </div>
          </div>

          <div className="animate-scale-in" style={{ animationDelay: "200ms" }}>
            <HeroProofCard />
          </div>
        </div>
      </section>

      {/* ── STATS BAND ───────────────────────── */}
      <section className="relative border-y border-surface-3/50 bg-surface-1/30 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-6 md:grid-cols-4">
          {[
            { label: "Merkle Tree Depth", value: 20, suffix: "" },
            { label: "Leaf Capacity", value: 1, suffix: "M+" },
            { label: "Min Stake", value: 0.1, suffix: " BNB", decimals: 1 },
            { label: "Claim Window", value: 48, suffix: "h" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="py-8 text-center">
              <div className="font-display text-3xl font-bold text-text-primary md:text-4xl">
                <CountUp end={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-text-muted">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────── */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-bright">
            Why it's different
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Privacy and fairness,
            <span className="gradient-text"> enforced by math.</span>
          </h2>
          <p className="mt-4 text-text-secondary">
            Every guarantee is a cryptographic primitive, not a promise. Here's what
            holds the system together.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100}>
              <div className="card-hover glass group h-full rounded-2xl p-7">
                <div
                  className={`mb-5 inline-flex rounded-xl border p-3 ${ACCENT_BG[f.accent]} ${ACCENT_MAP[f.accent]}`}
                >
                  <FeatureIcon name={f.icon} />
                </div>
                <h3 className="font-display text-lg font-semibold text-text-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────── */}
      <section id="how" className="relative mx-auto max-w-7xl px-6 py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-bright">
            The lifecycle
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            From stake to prize,{" "}
            <span className="gradient-text-gold">autonomously.</span>
          </h2>
        </Reveal>

        <div className="relative mt-16">
          {/* connecting line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-accent/40 via-gold/30 to-transparent lg:block" />

          <div className="grid gap-6 lg:grid-cols-2">
            {STEPS.map((step, i) => (
              <Reveal
                key={step.n}
                delay={(i % 2) * 100}
                className={i % 2 === 1 ? "lg:mt-16" : ""}
              >
                <div className="card-hover glass relative rounded-2xl p-7">
                  <div className="flex items-start gap-5">
                    <span className="gradient-text font-display text-4xl font-bold tabular-nums opacity-90">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-text-primary">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STACK MARQUEE ────────────────────── */}
      <section className="relative overflow-hidden border-y border-surface-3/50 py-8">
        <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-4">
          {[...STACK, ...STACK].map((tech, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-full border border-surface-3 bg-surface-1/60 px-5 py-2 text-sm font-medium text-text-secondary"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-6 py-28">
        <Reveal>
          <div className="glass-strong relative overflow-hidden rounded-3xl px-8 py-16 text-center md:px-16">
            <div
              className="absolute inset-0 -z-10 opacity-60"
              style={{ background: "radial-gradient(ellipse at center, rgba(124,108,240,0.25), transparent 70%)" }}
            />
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
              Watch the machines play.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-text-secondary">
              The dashboard streams every registration, ticket, draw, and claim in
              real time — all provable, all on-chain.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="group relative overflow-hidden rounded-xl bg-accent-gradient px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-transform hover:scale-[1.03]"
              >
                Open the Dashboard
              </Link>
              <Link
                href="/lotteries"
                className="rounded-xl border border-surface-3 bg-surface-1/50 px-8 py-4 text-sm font-semibold text-text-secondary backdrop-blur transition-colors hover:border-accent/30 hover:text-text-primary"
              >
                Browse Lotteries
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer className="relative border-t border-surface-3/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-display font-semibold">Agent Lottery</span>
          </div>
          <p className="text-xs text-text-muted">
            Autonomous · Zero-Knowledge · Provably Fair · BNB Smart Chain
          </p>
          <div className="flex gap-6 text-xs text-text-muted">
            <Link href="/dashboard" className="transition-colors hover:text-text-primary">Dashboard</Link>
            <Link href="/agents" className="transition-colors hover:text-text-primary">Agents</Link>
            <Link href="/draws" className="transition-colors hover:text-text-primary">Draws</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
