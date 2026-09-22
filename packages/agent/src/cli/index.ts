#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import * as yaml from "js-yaml";
import { config as loadEnv } from "dotenv";
import { AgentManager, type ManagerConfig } from "../core/AgentManager.js";
import type { AgentConfig, DeploymentAddresses } from "@agent-lottery/common";
import { StrategyType } from "@agent-lottery/common";
import { ethers } from "ethers";
import { ContractClient } from "../chain/contracts.js";
import { WalletManager } from "../chain/wallet.js";

loadEnv();

const program = new Command();

program
  .name("agent-lottery")
  .description("Autonomous AI agent lottery on BNB Chain")
  .version("1.0.0");

program
  .command("start")
  .description("Start the agent manager with configured agents")
  .option("-c, --config <path>", "Path to agent config file", "./agents.yaml")
  .option("-d, --data-dir <path>", "Data directory for ticket storage", "./data")
  .action(async (opts) => {
    const config = loadConfig(opts.config);

    const manager = new AgentManager({
      ...config,
      dataDir: resolve(opts.dataDir),
    });

    await manager.initialize();
    await manager.start();

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await manager.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await manager.stop();
      process.exit(0);
    });
  });

program
  .command("register")
  .description("Register an agent on-chain")
  .option("-i, --index <number>", "Agent wallet index", "0")
  .action(async (opts) => {
    const mnemonic = process.env.AGENT_MNEMONIC;
    if (!mnemonic) {
      console.error("AGENT_MNEMONIC not set");
      process.exit(1);
    }

    const rpcUrl = process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "http://127.0.0.1:8545";
    const walletManager = new WalletManager(mnemonic, rpcUrl);
    const wallet = walletManager.getWallet(parseInt(opts.index));

    const addresses = loadDeploymentAddresses();
    const client = new ContractClient(addresses, wallet);

    const isRegistered = await client.isRegistered(wallet.address);
    if (isRegistered) {
      console.log(`Agent ${wallet.address} is already registered`);
      return;
    }

    console.log(`Registering agent ${wallet.address}...`);
    const minStake = await client.registry.getMinStake();
    await client.registerAgent(minStake);
    console.log("Agent registered successfully");
  });

program
  .command("create-lottery")
  .description("Create a new lottery")
  .option("-i, --index <number>", "Agent wallet index", "0")
  .option("--entry-fee <bnb>", "Entry fee in BNB", "0.01")
  .option("--max-tickets <n>", "Maximum tickets per round", "100")
  .option("--draw-interval <seconds>", "Draw interval in seconds", "3600")
  .option("--max-rounds <n>", "Maximum rounds (0 = infinite)", "0")
  .option("--creator-fee <bps>", "Creator fee in basis points", "300")
  .action(async (opts) => {
    const mnemonic = process.env.AGENT_MNEMONIC;
    if (!mnemonic) {
      console.error("AGENT_MNEMONIC not set");
      process.exit(1);
    }

    const rpcUrl = process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "http://127.0.0.1:8545";
    const walletManager = new WalletManager(mnemonic, rpcUrl);
    const wallet = walletManager.getWallet(parseInt(opts.index));

    const addresses = loadDeploymentAddresses();
    const client = new ContractClient(addresses, wallet);

    const entryFee = ethers.parseEther(opts.entryFee);
    console.log(`Creating lottery with entry fee ${opts.entryFee} BNB...`);

    const lotteryAddress = await client.createLottery({
      entryFee,
      maxTickets: parseInt(opts.maxTickets),
      drawInterval: parseInt(opts.drawInterval),
      maxRounds: parseInt(opts.maxRounds),
      creatorFeeRate: parseInt(opts.creatorFee),
    });

    console.log(`Lottery created at: ${lotteryAddress}`);
  });

program
  .command("status")
  .description("Show agent and lottery status")
  .action(async () => {
    const mnemonic = process.env.AGENT_MNEMONIC;
    if (!mnemonic) {
      console.error("AGENT_MNEMONIC not set");
      process.exit(1);
    }

    const rpcUrl = process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "http://127.0.0.1:8545";
    const walletManager = new WalletManager(mnemonic, rpcUrl);
    const addresses = loadDeploymentAddresses();
    const wallet = walletManager.getWallet(0);
    const client = new ContractClient(addresses, wallet);

    const agentCount = parseInt(process.env.AGENT_COUNT || "5");
    console.log("\n=== Agents ===");
    for (let i = 0; i < agentCount; i++) {
      const addr = walletManager.getAddress(i);
      const balance = await walletManager.getBalance(i);
      const registered = await client.isRegistered(addr);
      console.log(`  Agent ${i}: ${addr}`);
      console.log(`    Balance: ${ethers.formatEther(balance)} BNB`);
      console.log(`    Registered: ${registered}`);
    }

    console.log("\n=== Lotteries ===");
    const lotteryCount = await client.getLotteryCount();
    console.log(`  Total: ${lotteryCount}`);

    if (lotteryCount > 0) {
      const lotteries = await client.getLotteries(0, Math.min(lotteryCount, 10));
      for (const addr of lotteries) {
        const round = await client.getCurrentRound(addr);
        const state = await client.getRoundState(addr, round);
        const fee = await client.getEntryFee(addr);
        console.log(`  ${addr}`);
        console.log(`    Round: ${round}, Tickets: ${state.ticketCount}, Prize: ${ethers.formatEther(state.prizePool)} BNB`);
        console.log(`    Entry fee: ${ethers.formatEther(fee)} BNB, Status: ${["Open", "Drawing", "Claimable", "Settled"][state.status]}`);
      }
    }
  });

function loadConfig(configPath: string): ManagerConfig {
  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    console.log(`Config file not found at ${resolvedPath}, using defaults`);
    return buildDefaultConfig();
  }

  const raw = readFileSync(resolvedPath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;

  return {
    mnemonic: (parsed.mnemonic as string) || process.env.AGENT_MNEMONIC || "",
    rpcUrl: (parsed.rpcUrl as string) || process.env.BSC_RPC_URL || "http://127.0.0.1:8545",
    circuitBasePath: (parsed.circuitBasePath as string) || resolve("../circuits"),
    dataDir: (parsed.dataDir as string) || "./data",
    deploymentAddresses: loadDeploymentAddresses(),
    agents: parsed.agents
      ? normalizeAgents(parsed.agents as RawAgent[])
      : buildDefaultAgents(),
  };
}

/** Raw shape as it comes out of YAML (numbers/strings, never bigint). */
interface RawAgent {
  name?: string;
  strategy?: {
    type?: string | number;
    threshold?: string | number;
    threshold2?: string | number;
    minJackpot?: string | number;
    maxParticipants?: string | number;
  };
  maxBalancePercentage?: number;
  tickIntervalMs?: number;
  autoClaimEnabled?: boolean;
}

/**
 * Convert human-friendly YAML agent entries into strict AgentConfig objects.
 * YAML cannot express bigint, so BNB amounts (given as decimal strings like
 * "0.5") are parsed to wei and counts are coerced to bigint.
 */
function normalizeAgents(rawAgents: RawAgent[]): AgentConfig[] {
  if (!Array.isArray(rawAgents) || rawAgents.length === 0) {
    throw new Error("Config 'agents' must be a non-empty list");
  }
  return rawAgents.map((raw, i) => ({
    name: raw.name ?? `Agent-${i}`,
    strategy: parseStrategy(raw.strategy ?? {}),
    maxBalancePercentage: raw.maxBalancePercentage ?? 100,
    tickIntervalMs: raw.tickIntervalMs ?? 30000,
    autoClaimEnabled: raw.autoClaimEnabled ?? true,
  }));
}

function parseStrategyType(value: string | number | undefined): StrategyType {
  if (typeof value === "number") return value as StrategyType;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    const map: Record<string, StrategyType> = {
      alwaysenter: StrategyType.AlwaysEnter,
      minjackpot: StrategyType.MinJackpot,
      maxparticipants: StrategyType.MaxParticipants,
      expectedvalue: StrategyType.ExpectedValue,
      composite: StrategyType.Composite,
    };
    if (key in map) return map[key];
    const asNum = Number(key);
    if (!Number.isNaN(asNum)) return asNum as StrategyType;
  }
  throw new Error(`Unknown strategy type: ${String(value)}`);
}

/** BNB decimal string ("0.5") or wei string -> wei bigint. */
function toWei(value: string | number | undefined): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  return ethers.parseEther(String(value));
}

/** Plain integer count -> bigint. */
function toCount(value: string | number | undefined): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  return BigInt(Math.trunc(Number(value)));
}

function parseStrategy(raw: NonNullable<RawAgent["strategy"]>): {
  type: StrategyType;
  threshold: bigint;
  threshold2: bigint;
} {
  const type = parseStrategyType(raw.type);
  switch (type) {
    case StrategyType.AlwaysEnter:
      return { type, threshold: 0n, threshold2: 0n };
    case StrategyType.MinJackpot:
      // threshold = minimum jackpot in BNB
      return { type, threshold: toWei(raw.minJackpot ?? raw.threshold), threshold2: 0n };
    case StrategyType.ExpectedValue:
      // threshold = minimum EV multiplier in BNB (jackpot >= threshold * participants)
      return { type, threshold: toWei(raw.threshold), threshold2: 0n };
    case StrategyType.MaxParticipants:
      // threshold = maximum participant count
      return { type, threshold: toCount(raw.maxParticipants ?? raw.threshold), threshold2: 0n };
    case StrategyType.Composite:
      // minJackpot in BNB + maxParticipants count
      return {
        type,
        threshold: toWei(raw.minJackpot ?? raw.threshold),
        threshold2: toCount(raw.maxParticipants ?? raw.threshold2),
      };
    default:
      return { type: StrategyType.AlwaysEnter, threshold: 0n, threshold2: 0n };
  }
}

function buildDefaultConfig(): ManagerConfig {
  return {
    mnemonic: process.env.AGENT_MNEMONIC || "",
    rpcUrl: process.env.BSC_RPC_URL || process.env.BSC_TESTNET_RPC_URL || "http://127.0.0.1:8545",
    circuitBasePath: resolve("../circuits"),
    dataDir: "./data",
    deploymentAddresses: loadDeploymentAddresses(),
    agents: buildDefaultAgents(),
  };
}

function buildDefaultAgents(): AgentConfig[] {
  return [
    {
      name: "AlphaBot",
      strategy: { type: StrategyType.AlwaysEnter, threshold: 0n, threshold2: 0n },
      maxBalancePercentage: 10,
      tickIntervalMs: 30000,
      autoClaimEnabled: true,
    },
    {
      name: "BetaBot",
      strategy: { type: StrategyType.MinJackpot, threshold: ethers.parseEther("0.5"), threshold2: 0n },
      maxBalancePercentage: 15,
      tickIntervalMs: 30000,
      autoClaimEnabled: true,
    },
    {
      name: "GammaBot",
      strategy: { type: StrategyType.MaxParticipants, threshold: 50n, threshold2: 0n },
      maxBalancePercentage: 20,
      tickIntervalMs: 45000,
      autoClaimEnabled: true,
    },
    {
      name: "DeltaBot",
      strategy: { type: StrategyType.ExpectedValue, threshold: ethers.parseEther("0.02"), threshold2: 0n },
      maxBalancePercentage: 25,
      tickIntervalMs: 60000,
      autoClaimEnabled: true,
    },
    {
      name: "EpsilonBot",
      strategy: { type: StrategyType.Composite, threshold: ethers.parseEther("0.1"), threshold2: 20n },
      maxBalancePercentage: 30,
      tickIntervalMs: 30000,
      autoClaimEnabled: true,
    },
  ];
}

function loadDeploymentAddresses(): DeploymentAddresses {
  const deploymentsPath = resolve("../contracts/deployments.json");
  if (existsSync(deploymentsPath)) {
    return JSON.parse(readFileSync(deploymentsPath, "utf-8"));
  }

  // Return placeholder addresses for development
  return {
    agentRegistry: process.env.AGENT_REGISTRY_ADDRESS || ethers.ZeroAddress,
    lotteryFactory: process.env.LOTTERY_FACTORY_ADDRESS || ethers.ZeroAddress,
    drawManager: process.env.DRAW_MANAGER_ADDRESS || ethers.ZeroAddress,
    prizePool: process.env.PRIZE_POOL_ADDRESS || ethers.ZeroAddress,
    eligibilityVerifier: process.env.ELIGIBILITY_VERIFIER_ADDRESS || ethers.ZeroAddress,
    ticketVerifier: process.env.TICKET_VERIFIER_ADDRESS || ethers.ZeroAddress,
    claimVerifier: process.env.CLAIM_VERIFIER_ADDRESS || ethers.ZeroAddress,
    lotteryImplementation: process.env.LOTTERY_IMPLEMENTATION_ADDRESS || ethers.ZeroAddress,
  };
}

program.parse();
