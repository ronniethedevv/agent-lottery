import Link from "next/link";
import type { Metadata } from "next";
import { AuroraBackground } from "@/components/AuroraBackground";
import { LandingNav } from "@/components/landing/LandingNav";
import { Reveal } from "@/components/Reveal";
import { CodeBlock } from "@/components/CodeBlock";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Run an Agent — Agent Lottery",
  description:
    "Deploy, configure, and run your own autonomous lottery agents on BNB Chain.",
};

const STEPS = [
  {
    n: "01",
    title: "Install & build the circuits",
    body: "Install dependencies and compile the Circom circuits. This also generates the on-chain Groth16 verifiers.",
    code: `pnpm install
pnpm --filter @agent-lottery/circuits build`,
  },
  {
    n: "02",
    title: "Deploy the contracts",
    body: "Set DEPLOYER_PRIVATE_KEY and your VRF subscription in .env, then deploy. This writes packages/contracts/deployments.json, which the agent reads automatically.",
    code: `cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY, VRF_SUBSCRIPTION_ID
pnpm --filter @agent-lottery/contracts deploy:testnet`,
  },
  {
    n: "03",
    title: "Configure your agents",
    body: "Copy the example config and describe each agent. Every agent uses a wallet derived from your mnemonic at index 0, 1, 2… — fund each with BNB for gas, the 0.1 BNB stake, and entry fees.",
    code: `cd packages/agent
cp agents.example.yaml agents.yaml   # then edit it`,
  },
  {
    n: "04",
    title: "Start the runtime",
    body: "Agents auto-register on-chain, then begin ticking: discover lotteries → evaluate strategy → prove → enter → claim wins. Ticket secrets are stored locally in ./data (back it up — it's required to claim).",
    code: `export AGENT_MNEMONIC="your twelve word mnemonic ..."
pnpm --filter @agent-lottery/agent start`,
  },
];

const STRATEGIES = [
  { type: "AlwaysEnter", fields: "—", when: "Always enters" },
  { type: "MinJackpot", fields: "minJackpot (BNB)", when: "jackpot ≥ minJackpot" },
  { type: "MaxParticipants", fields: "maxParticipants", when: "participants ≤ max" },
  { type: "ExpectedValue", fields: "threshold (BNB)", when: "jackpot ≥ threshold × participants" },
  { type: "Composite", fields: "minJackpot + maxParticipants", when: "both conditions hold" },
];

const YAML_EXAMPLE = `agents:
  - name: AlphaBot
    strategy:
      type: MinJackpot
      minJackpot: "0.5"        # enter once the pot hits 0.5 BNB
    maxBalancePercentage: 15   # never wager >15% of balance
    tickIntervalMs: 30000
    autoClaimEnabled: true`;

const SDK_EXAMPLE = `import { AgentManager } from "@agent-lottery/agent";
import { StrategyType } from "@agent-lottery/common";
import deployments from "../contracts/deployments.json";
import { parseEther } from "ethers";

const manager = new AgentManager({
  mnemonic: process.env.AGENT_MNEMONIC!,
  rpcUrl: process.env.BSC_RPC_URL!,
  circuitBasePath: "../circuits",
  dataDir: "./data",
  deploymentAddresses: deployments,
  agents: [{
    name: "MyBot",
    strategy: { type: StrategyType.MinJackpot, threshold: parseEther("0.5"), threshold2: 0n },
    maxBalancePercentage: 20,
    tickIntervalMs: 30_000,
    autoClaimEnabled: true,
  }],
});

await manager.initialize();
await manager.start();`;

export default function RunAgentPage() {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <LandingNav />

      {/* Hero */}
      <section className="relative mx-auto max-w-4xl px-6 pt-36 pb-16 md:pt-44">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-xs font-medium text-accent-bright">
            For developers
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Run your own <span className="gradient-text">agents.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
            The lottery is agents-only. Point an agent at a deployment, give it a
            private strategy, and it will discover lotteries, prove eligibility in
            zero-knowledge, enter, and claim — autonomously. Two ways to run: a YAML
            config, or the TypeScript SDK.
          </p>
        </Reveal>
      </section>

      {/* Steps */}
      <section className="relative mx-auto max-w-4xl px-6 pb-12">
        <div className="space-y-5">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={(i % 2) * 80}>
              <div className="glass rounded-2xl p-7">
                <div className="flex items-start gap-5">
                  <span className="gradient-text font-display text-3xl font-bold tabular-nums">
                    {step.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-xl font-semibold text-text-primary">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 mb-4 text-sm leading-relaxed text-text-secondary">
                      {step.body}
                    </p>
                    <CodeBlock code={step.code} />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Config-driven */}
      <section className="relative mx-auto max-w-4xl px-6 py-12">
        <Reveal>
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Describe agents in <span className="gradient-text-gold">YAML</span>
          </h2>
          <p className="mt-2 mb-5 text-sm text-text-secondary">
            The no-code path. BNB amounts are decimal strings; counts are integers.
          </p>
          <CodeBlock code={YAML_EXAMPLE} lang="yaml" />
        </Reveal>

        <Reveal className="mt-8">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-surface-3/60 px-6 py-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-text-secondary">
                Strategy types
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3/60 text-left text-xs text-text-muted">
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Fields</th>
                  <th className="px-6 py-3 font-medium">Enters when</th>
                </tr>
              </thead>
              <tbody>
                {STRATEGIES.map((s) => (
                  <tr key={s.type} className="border-b border-surface-3/30 last:border-0">
                    <td className="px-6 py-3 font-mono text-accent-bright">{s.type}</td>
                    <td className="px-6 py-3 text-text-secondary">{s.fields}</td>
                    <td className="px-6 py-3 text-text-secondary">{s.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* SDK */}
      <section className="relative mx-auto max-w-4xl px-6 py-12">
        <Reveal>
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            …or drive it with the <span className="gradient-text">SDK</span>
          </h2>
          <p className="mt-2 mb-5 text-sm text-text-secondary">
            Import the runtime and compose strategies in code. Lower-level building
            blocks (<span className="font-mono text-text-muted">Agent</span>,{" "}
            <span className="font-mono text-text-muted">ContractClient</span>,{" "}
            <span className="font-mono text-text-muted">ProofGenerator</span>,{" "}
            <span className="font-mono text-text-muted">MerkleTree</span>) are exported too.
          </p>
          <CodeBlock code={SDK_EXAMPLE} lang="typescript" />
        </Reveal>

        <Reveal className="mt-8">
          <div className="glass rounded-2xl border-l-2 border-l-gold/50 p-6">
            <h3 className="font-display text-sm font-semibold text-gold-bright">
              One honest constraint
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              A strategy's <span className="font-mono text-text-muted">evaluate()</span>{" "}
              can be arbitrarily clever, but the proof the chain accepts must reduce to
              one of the five circuit-supported shapes. What stays private are the{" "}
              <em>parameters and which shape</em> an agent used — not arbitrary code. To
              prove genuinely novel private logic, add a new Circom circuit and verifier.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-16">
        <Reveal>
          <div className="glass-strong relative overflow-hidden rounded-3xl px-8 py-12 text-center">
            <div
              className="absolute inset-0 -z-10 opacity-60"
              style={{ background: "radial-gradient(ellipse at center, rgba(124,108,240,0.22), transparent 70%)" }}
            />
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Full setup guide
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-text-secondary">
              The complete deploy-to-claim walkthrough lives in{" "}
              <span className="font-mono text-text-primary">SETUP.md</span>, and the SDK
              reference in{" "}
              <span className="font-mono text-text-primary">packages/agent/README.md</span>.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="rounded-xl bg-accent-gradient px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-transform hover:scale-[1.03]"
              >
                Watch agents live
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-surface-3 bg-surface-1/50 px-7 py-3.5 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:text-text-primary"
              >
                Back to home
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-surface-3/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-display font-semibold">Agent Lottery</span>
          </div>
          <p className="text-xs text-text-muted">
            Autonomous · Zero-Knowledge · Provably Fair · BNB Smart Chain
          </p>
        </div>
      </footer>
    </div>
  );
}
