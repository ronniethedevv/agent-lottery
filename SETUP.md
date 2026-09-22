# Setup — deploying and running Agent Lottery

This walks through standing up the whole system end to end: build circuits, deploy
contracts, fund and register agents, run the agent runtime, and bring up the
dashboard. Commands assume you're at the repo root unless noted.

> **Networks.** Examples target **BSC testnet**. Swap `deploy:testnet` for
> `deploy:mainnet` and the testnet RPC/VRF values for mainnet when you're ready.
> Do a full testnet run first.

---

## 0. Prerequisites

- Node ≥ 18, pnpm ≥ 8
- [`circom`](https://docs.circom.io/getting-started/installation/) ≥ 2.1 (only needed to build circuits)
- A funded BSC wallet (the deployer) and a Chainlink VRF subscription
- `pnpm install` at the repo root

Copy the env template and fill it in as you go:

```bash
cp .env.example .env
```

---

## 1. Build the ZK circuits

Compiles `eligibility`, `ticket`, and `claim`, runs the Groth16 setup, and copies the
generated Solidity verifiers into `packages/contracts/contracts/zk/`.

```bash
pnpm --filter @agent-lottery/circuits build
```

> Without this step the contracts compile against **stub verifiers** that accept any
> proof — fine for local UI work, **never for testnet/mainnet.** Always build real
> circuits before deploying anywhere real.

The proving/verifying keys and wasm land in `packages/circuits/keys` and
`packages/circuits/build` (gitignored). The agent runtime reads these at proof time.

---

## 2. Deploy the contracts

Set at least `DEPLOYER_PRIVATE_KEY` (and `PROTOCOL_TREASURY`, `VRF_SUBSCRIPTION_ID`)
in `.env`, then:

```bash
pnpm --filter @agent-lottery/contracts compile
pnpm --filter @agent-lottery/contracts deploy:testnet
```

This deploys the registry, verifiers, lottery implementation, DrawManager, PrizePool,
and factory (wiring their cross-references), then writes:

- `packages/contracts/deployments.json` — consumed automatically by the agent runtime
- an **env block** printed to the console — copy `LOTTERY_FACTORY_ADDRESS`,
  `AGENT_REGISTRY_ADDRESS`, and `INDEX_START_BLOCK` into your `.env` for the backend indexer

### After deploying

1. Add the **DrawManager** address as a consumer on your VRF subscription at
   [vrf.chain.link](https://vrf.chain.link) and fund it with LINK.
2. On mainnet/testnet the DrawManager runs in **real VRF mode**. (For local Hardhat
   runs it's put in mock mode automatically so draws can be fulfilled manually.)

---

## 3. Configure agents

```bash
cd packages/agent
cp agents.example.yaml agents.yaml
```

Edit `agents.yaml` — set the `mnemonic` (or leave blank and export `AGENT_MNEMONIC`),
the `rpcUrl`, and one entry per agent. Each agent uses a wallet derived from the
mnemonic at index 0, 1, 2… The full schema and strategy reference are in
[packages/agent/README.md](packages/agent/README.md).

**Fund every agent wallet.** Each needs BNB for gas + the **0.1 BNB** registration
stake + entry fees. List the derived addresses with:

```bash
pnpm --filter @agent-lottery/agent start   # logs each agent's address on init
# or, to just inspect balances/registration:
pnpm --filter @agent-lottery/agent exec agent-lottery status
```

---

## 4. Register agents

The runtime auto-registers any unregistered agent on startup. To register one
manually:

```bash
pnpm --filter @agent-lottery/agent exec agent-lottery register --index 0
```

---

## 5. Create a lottery (optional)

Only registered agents can create lotteries. Create one from agent wallet 0:

```bash
pnpm --filter @agent-lottery/agent exec agent-lottery create-lottery \
  --entry-fee 0.01 --max-tickets 100 --draw-interval 3600 --creator-fee 300
```

---

## 6. Run the agent runtime

```bash
pnpm --filter @agent-lottery/agent start
```

Each tick, every agent: discovers open lotteries → evaluates its private strategy →
generates eligibility + ticket proofs → enters → and (if `autoClaimEnabled`) claims
any wins. Ticket secrets/nullifiers are stored in `packages/agent/data/` — **back this
up; without it an agent cannot claim.**

---

## 7. Run the backend + dashboard

With `LOTTERY_FACTORY_ADDRESS`, `AGENT_REGISTRY_ADDRESS`, `INDEX_START_BLOCK`, and
`DATABASE_URL` set in `.env`:

```bash
# database schema
pnpm --filter @agent-lottery/backend exec prisma migrate deploy

# API + indexer + WebSocket (all on PORT, default 3001)
pnpm --filter @agent-lottery/backend dev

# dashboard
pnpm --filter @agent-lottery/frontend dev   # http://localhost:3000
```

Or run Postgres + backend + frontend together with Docker:

```bash
docker compose up --build
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Agent logs `ZeroAddress` for contracts | `deployments.json` missing — re-run the deploy, or set the `*_ADDRESS` env vars. |
| `insufficient funds` on register | The derived agent wallet has no BNB. Fund it (gas + 0.1 BNB stake). |
| Proof generation fails / missing wasm | Circuits not built — run step 1. |
| Draw never settles on testnet | DrawManager isn't a funded VRF consumer — see step 2. |
| Dashboard shows "Disconnected" / all zeros | Backend not running, or indexer has no factory address configured. |
| Entries revert with `InvalidProof` on testnet | Contracts deployed against stub verifiers — rebuild circuits (step 1) and redeploy. |
