# @agent-lottery/agent

The agent runtime, SDK, and CLI. Use it two ways:

1. **Config-driven** — describe agents in `agents.yaml` and run the CLI. No code.
2. **Programmatic** — import the SDK and drive agents yourself.

Both do the same thing under the hood: discover open lotteries, evaluate a private
strategy, generate the eligibility + ticket ZK proofs, enter, and claim wins.

---

## Option 1 — config-driven (CLI)

```bash
cp agents.example.yaml agents.yaml   # then edit it
export AGENT_MNEMONIC="your twelve word mnemonic ..."   # or set it in agents.yaml
pnpm --filter @agent-lottery/agent start
```

CLI commands (`agent-lottery <cmd>`):

| Command | Purpose |
|---|---|
| `start` | Run the manager: create, register, and tick all configured agents. `-c <path>` for a custom config, `-d <dir>` for the ticket store. |
| `register --index <n>` | Register the wallet at derivation index `n`. |
| `create-lottery [...]` | Create a lottery (see `--help` for `--entry-fee`, `--max-tickets`, `--draw-interval`, `--max-rounds`, `--creator-fee`). |
| `status` | Print agent balances/registration and current lotteries. |

Addresses are read from `../contracts/deployments.json` (written by the deploy
script), falling back to `*_ADDRESS` env vars.

---

## `agents.yaml` schema

```yaml
mnemonic: ""                 # or use AGENT_MNEMONIC env
rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/"
circuitBasePath: "../circuits"
dataDir: "./data"            # LevelDB store for ticket secrets (needed to claim)

agents:
  - name: AlphaBot
    strategy:
      type: AlwaysEnter      # AlwaysEnter | MinJackpot | MaxParticipants | ExpectedValue | Composite
    maxBalancePercentage: 10 # cap entry fee at 10% of wallet balance (bankroll mgmt)
    tickIntervalMs: 30000
    autoClaimEnabled: true
```

BNB amounts are decimal strings (`"0.5"`) and are parsed to wei automatically;
counts are plain integers.

### Strategy reference

| `type` | Fields | Enters when |
|---|---|---|
| `AlwaysEnter` | — | always |
| `MinJackpot` | `minJackpot` (BNB) | `jackpot >= minJackpot` |
| `MaxParticipants` | `maxParticipants` (count) | `participants <= maxParticipants` |
| `ExpectedValue` | `threshold` (BNB) | `jackpot >= threshold * participants` |
| `Composite` | `minJackpot` (BNB) + `maxParticipants` (count) | both of the above |

`maxBalancePercentage` wraps any strategy with bankroll management (skip if the entry
fee exceeds that % of balance). A round cooldown is available programmatically via the
`Cooldown` wrapper.

---

## Option 2 — programmatic (SDK)

```ts
import {
  AgentManager,
  StrategyEngine,
  MinJackpot,
  BankrollManagement,
} from "@agent-lottery/agent";
import { StrategyType } from "@agent-lottery/common";
import deployments from "../contracts/deployments.json";
import { parseEther } from "ethers";

const manager = new AgentManager({
  mnemonic: process.env.AGENT_MNEMONIC!,
  rpcUrl: process.env.BSC_RPC_URL!,
  circuitBasePath: "../circuits",
  dataDir: "./data",
  deploymentAddresses: deployments,
  agents: [
    {
      name: "MyBot",
      strategy: { type: StrategyType.MinJackpot, threshold: parseEther("0.5"), threshold2: 0n },
      maxBalancePercentage: 20,
      tickIntervalMs: 30_000,
      autoClaimEnabled: true,
    },
  ],
});

await manager.initialize();   // creates wallets, registers on-chain, starts event monitor
await manager.start();        // begins the tick loop
```

Lower-level building blocks are exported too: `Agent`, `ContractClient`,
`WalletManager`, `ProofGenerator`, `MerkleTree`, `LotteryDiscovery`, `TicketStore`,
and the strategy `Condition` classes (`AlwaysEnter`, `MinJackpot`, `MaxParticipants`,
`ExpectedValue`, `CompositeStrategy`, `Cooldown`, `BankrollManagement`).

### Composing strategies

```ts
// enter thin, high-value rounds — but never wager more than 15% of balance
const condition = new BankrollManagement(15, new MinJackpot(parseEther("1")));
const engine = new StrategyEngine(condition);
```

---

## Writing a custom strategy — and its one constraint

A `Condition` is straightforward to implement:

```ts
import type { Condition, LotteryState, AgentState } from "@agent-lottery/agent";
import { StrategyType } from "@agent-lottery/common";

class MyStrategy implements Condition {
  name = "MyStrategy";
  evaluate(lottery: LotteryState, agent: AgentState): boolean {
    // arbitrary off-chain logic deciding whether to enter
    return lottery.jackpotSize > lottery.entryFee * 20n;
  }
  toCircuitInputs() {
    // MUST map to a shape the eligibility circuit supports
    return { strategyType: StrategyType.MinJackpot, threshold: lottery.entryFee * 20n, threshold2: 0n };
  }
}
```

**The constraint:** `toCircuitInputs()` must return one of the five circuit-supported
shapes, because the on-chain verifier only accepts proofs for those. So your
`evaluate()` can be as clever as you like for *deciding*, but the **proof** the chain
checks must reduce to a supported shape (and its public inputs must match what you
actually enter with). To prove genuinely novel private logic, add a new circuit in
`packages/circuits`, regenerate its verifier, and wire it in. This is the honest
boundary of the privacy model — see the note in the [root README](../../README.md).

---

## Tests

```bash
pnpm --filter @agent-lottery/agent test
```
