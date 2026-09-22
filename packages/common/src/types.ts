export enum LotteryStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
}

export enum RoundStatus {
  Open = 0,
  Drawing = 1,
  Claimable = 2,
  Settled = 3,
}

export interface LotteryConfig {
  entryFee: bigint;
  maxTickets: number;
  drawInterval: number;
  maxRounds: number;
  creatorFeeRate: number;
}

export interface RoundState {
  prizePool: bigint;
  ticketCount: number;
  merkleRoot: string;
  winnerIndex: number;
  claimed: boolean;
  status: RoundStatus;
  startedAt: number;
  drawnAt: number;
}

export interface AgentInfo {
  stake: bigint;
  reputation: number;
  registeredAt: number;
  isActive: boolean;
}

export interface LotteryInfo {
  address: string;
  creator: string;
  entryFee: bigint;
  maxTickets: number;
  drawInterval: number;
  maxRounds: number;
  creatorFeeRate: number;
  currentRound: number;
}

export interface TicketData {
  secret: bigint;
  nullifier: bigint;
  commitment: bigint;
  lotteryId: bigint;
  roundId: number;
  leafIndex: number;
}

export interface Groth16Proof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
}

export interface EligibilityPublicInputs {
  lotteryId: bigint;
  minEntryFee: bigint;
  jackpotSize: bigint;
  participantCount: bigint;
  agentCommitment: bigint;
}

export interface TicketPublicInputs {
  commitment: bigint;
  lotteryId: bigint;
}

export interface ClaimPublicInputs {
  root: bigint;
  nullifierHash: bigint;
  lotteryId: bigint;
  roundId: bigint;
  recipient: bigint;
  leafIndex: bigint;
}

export enum StrategyType {
  AlwaysEnter = 0,
  MinJackpot = 1,
  MaxParticipants = 2,
  ExpectedValue = 3,
  Composite = 4,
}

export interface StrategyConfig {
  type: StrategyType;
  threshold: bigint;
  threshold2: bigint;
}

export interface AgentConfig {
  name: string;
  strategy: StrategyConfig;
  maxBalancePercentage: number;
  tickIntervalMs: number;
  autoClaimEnabled: boolean;
}

export interface DeploymentAddresses {
  agentRegistry: string;
  lotteryFactory: string;
  drawManager: string;
  prizePool: string;
  eligibilityVerifier: string;
  ticketVerifier: string;
  claimVerifier: string;
  lotteryImplementation: string;
}

export interface WebSocketEvent {
  type: string;
  data: unknown;
  timestamp: number;
}
