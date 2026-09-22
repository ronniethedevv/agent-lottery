import { StrategyType } from "@agent-lottery/common";

export interface LotteryState {
  lotteryId: bigint;
  entryFee: bigint;
  jackpotSize: bigint;
  participantCount: bigint;
  drawInterval: number;
  roundStartedAt: number;
  currentRound: number;
}

export interface AgentState {
  balance: bigint;
  reputation: number;
  lastEntryRound: number;
  totalWagered: bigint;
  totalWon: bigint;
}

export interface Condition {
  name: string;
  evaluate(lottery: LotteryState, agent: AgentState): boolean;
  toCircuitInputs(): { strategyType: number; threshold: bigint; threshold2: bigint };
}

export class AlwaysEnter implements Condition {
  name = "AlwaysEnter";

  evaluate(_lottery: LotteryState, _agent: AgentState): boolean {
    return true;
  }

  toCircuitInputs() {
    return { strategyType: StrategyType.AlwaysEnter, threshold: 0n, threshold2: 0n };
  }
}

export class MinJackpot implements Condition {
  name: string;
  private threshold: bigint;

  constructor(thresholdWei: bigint) {
    this.threshold = thresholdWei;
    this.name = `MinJackpot(${thresholdWei})`;
  }

  evaluate(lottery: LotteryState, _agent: AgentState): boolean {
    return lottery.jackpotSize >= this.threshold;
  }

  toCircuitInputs() {
    return { strategyType: StrategyType.MinJackpot, threshold: this.threshold, threshold2: 0n };
  }
}

export class MaxParticipants implements Condition {
  name: string;
  private maxCount: bigint;

  constructor(maxCount: number) {
    this.maxCount = BigInt(maxCount);
    this.name = `MaxParticipants(${maxCount})`;
  }

  evaluate(lottery: LotteryState, _agent: AgentState): boolean {
    return lottery.participantCount <= this.maxCount;
  }

  toCircuitInputs() {
    return { strategyType: StrategyType.MaxParticipants, threshold: this.maxCount, threshold2: 0n };
  }
}

export class ExpectedValue implements Condition {
  name: string;
  private minEvMultiplier: bigint;

  constructor(minEvMultiplier: bigint) {
    this.minEvMultiplier = minEvMultiplier;
    this.name = `ExpectedValue(${minEvMultiplier})`;
  }

  evaluate(lottery: LotteryState, _agent: AgentState): boolean {
    if (lottery.participantCount === 0n) return true;
    return lottery.jackpotSize >= this.minEvMultiplier * lottery.participantCount;
  }

  toCircuitInputs() {
    return { strategyType: StrategyType.ExpectedValue, threshold: this.minEvMultiplier, threshold2: 0n };
  }
}

export class CompositeStrategy implements Condition {
  name: string;
  private minJackpot: bigint;
  private maxParticipants: bigint;

  constructor(minJackpot: bigint, maxParticipants: number) {
    this.minJackpot = minJackpot;
    this.maxParticipants = BigInt(maxParticipants);
    this.name = `Composite(minJackpot=${minJackpot}, maxPart=${maxParticipants})`;
  }

  evaluate(lottery: LotteryState, _agent: AgentState): boolean {
    return (
      lottery.jackpotSize >= this.minJackpot &&
      lottery.participantCount <= this.maxParticipants
    );
  }

  toCircuitInputs() {
    return {
      strategyType: StrategyType.Composite,
      threshold: this.minJackpot,
      threshold2: this.maxParticipants,
    };
  }
}

export class Cooldown implements Condition {
  name: string;
  private rounds: number;
  private inner: Condition;

  constructor(rounds: number, inner: Condition) {
    this.rounds = rounds;
    this.inner = inner;
    this.name = `Cooldown(${rounds}, ${inner.name})`;
  }

  evaluate(lottery: LotteryState, agent: AgentState): boolean {
    if (lottery.currentRound - agent.lastEntryRound < this.rounds) {
      return false;
    }
    return this.inner.evaluate(lottery, agent);
  }

  toCircuitInputs() {
    return this.inner.toCircuitInputs();
  }
}

export class BankrollManagement implements Condition {
  name: string;
  private maxPercentage: number;
  private inner: Condition;

  constructor(maxPercentage: number, inner: Condition) {
    this.maxPercentage = maxPercentage;
    this.inner = inner;
    this.name = `BankrollMgmt(${maxPercentage}%, ${inner.name})`;
  }

  evaluate(lottery: LotteryState, agent: AgentState): boolean {
    if (agent.balance === 0n) return false;
    const maxWager = (agent.balance * BigInt(this.maxPercentage)) / 100n;
    if (lottery.entryFee > maxWager) return false;
    return this.inner.evaluate(lottery, agent);
  }

  toCircuitInputs() {
    return this.inner.toCircuitInputs();
  }
}
