export { Agent } from "./core/Agent.js";
export { AgentManager, type ManagerConfig } from "./core/AgentManager.js";
export { StrategyEngine } from "./strategy/StrategyEngine.js";
export {
  AlwaysEnter,
  MinJackpot,
  MaxParticipants,
  ExpectedValue,
  CompositeStrategy,
  Cooldown,
  BankrollManagement,
} from "./strategy/conditions.js";
export type { Condition, LotteryState, AgentState } from "./strategy/conditions.js";
export { ProofGenerator } from "./zk/ProofGenerator.js";
export { MerkleTree } from "./zk/MerkleTree.js";
export { poseidonHash1, poseidonHash2 } from "./zk/poseidon.js";
export { ContractClient } from "./chain/contracts.js";
export { WalletManager } from "./chain/wallet.js";
export { EventMonitor } from "./chain/events.js";
export { LotteryDiscovery } from "./lottery/LotteryDiscovery.js";
export { TicketStore } from "./lottery/TicketStore.js";
