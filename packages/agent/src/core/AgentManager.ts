import { Agent } from "./Agent.js";
import { WalletManager } from "../chain/wallet.js";
import { ContractClient } from "../chain/contracts.js";
import { ProofGenerator } from "../zk/ProofGenerator.js";
import { LotteryDiscovery } from "../lottery/LotteryDiscovery.js";
import { EventMonitor } from "../chain/events.js";
import type { AgentConfig, DeploymentAddresses } from "@agent-lottery/common";
import { PROTOCOL_CONSTANTS } from "@agent-lottery/common";
import pino from "pino";
import { join } from "path";

export interface ManagerConfig {
  mnemonic: string;
  rpcUrl: string;
  circuitBasePath: string;
  dataDir: string;
  deploymentAddresses: DeploymentAddresses;
  agents: AgentConfig[];
}

/**
 * Manages a pool of autonomous lottery agents.
 * Creates agents, coordinates their lifecycle, and runs the tick loop.
 */
export class AgentManager {
  private agents: Agent[] = [];
  private walletManager: WalletManager;
  private proofGen: ProofGenerator;
  private eventMonitor: EventMonitor;
  private config: ManagerConfig;
  private logger: pino.Logger;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: ManagerConfig) {
    this.config = config;
    this.walletManager = new WalletManager(config.mnemonic, config.rpcUrl);
    this.proofGen = new ProofGenerator(config.circuitBasePath);
    this.eventMonitor = new EventMonitor(
      this.walletManager.getProvider(),
      config.deploymentAddresses.lotteryFactory
    );
    this.logger = pino({ name: "agent-manager" });
  }

  async initialize(): Promise<void> {
    this.logger.info({ agentCount: this.config.agents.length }, "Initializing agent manager");

    for (let i = 0; i < this.config.agents.length; i++) {
      const agentConfig = this.config.agents[i];
      const wallet = this.walletManager.getWallet(i);
      const client = new ContractClient(this.config.deploymentAddresses, wallet);
      const discovery = new LotteryDiscovery(client);
      const agentSecret = this.walletManager.generateSecret(i, "agent-lottery-secret");

      const agent = new Agent({
        id: i,
        wallet,
        config: agentConfig,
        proofGen: this.proofGen,
        client,
        discovery,
        ticketStorePath: join(this.config.dataDir, `agent-${i}-tickets`),
        agentSecret,
      });

      await agent.initialize();
      this.agents.push(agent);

      this.logger.info({
        agentId: i,
        name: agentConfig.name,
        address: wallet.address,
      }, "Agent created");
    }

    // Register agents on-chain if not already registered
    await this._ensureRegistered();

    // Start event monitoring
    await this.eventMonitor.start();
  }

  private async _ensureRegistered(): Promise<void> {
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const wallet = this.walletManager.getWallet(i);
      const client = new ContractClient(this.config.deploymentAddresses, wallet);

      const isRegistered = await client.isRegistered(agent.address);
      if (!isRegistered) {
        this.logger.info({ agent: agent.name, address: agent.address }, "Registering agent on-chain");
        try {
          await client.registerAgent(BigInt(PROTOCOL_CONSTANTS.MIN_STAKE));
          this.logger.info({ agent: agent.name }, "Agent registered");
        } catch (error) {
          this.logger.error({ error, agent: agent.name }, "Failed to register agent");
        }
      } else {
        this.logger.info({ agent: agent.name }, "Agent already registered");
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.logger.info("Starting agent tick loop");

    const tickAll = async () => {
      if (!this.running) return;

      for (const agent of this.agents) {
        await agent.tick();
      }
    };

    // Initial tick
    await tickAll();

    // Set up interval
    const interval = this.config.agents[0]?.tickIntervalMs ?? 30000;
    this.tickHandle = setInterval(tickAll, interval);

    this.logger.info({ intervalMs: interval }, "Agent manager running");
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }

    await this.eventMonitor.stop();

    for (const agent of this.agents) {
      await agent.stop();
    }

    this.logger.info("Agent manager stopped");
  }

  getAgents(): Agent[] {
    return this.agents;
  }

  getAgent(id: number): Agent | undefined {
    return this.agents[id];
  }
}
