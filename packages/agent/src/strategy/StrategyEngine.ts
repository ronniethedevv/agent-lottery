import type { Condition, LotteryState, AgentState } from "./conditions.js";
import {
  AlwaysEnter,
  MinJackpot,
  MaxParticipants,
  ExpectedValue,
  CompositeStrategy,
  Cooldown,
  BankrollManagement,
} from "./conditions.js";
import type { StrategyConfig, AgentConfig } from "@agent-lottery/common";
import { StrategyType } from "@agent-lottery/common";

export class StrategyEngine {
  private condition: Condition;

  constructor(condition: Condition) {
    this.condition = condition;
  }

  evaluate(lottery: LotteryState, agent: AgentState): boolean {
    return this.condition.evaluate(lottery, agent);
  }

  getCircuitInputs() {
    return this.condition.toCircuitInputs();
  }

  getName(): string {
    return this.condition.name;
  }

  static fromConfig(config: AgentConfig): StrategyEngine {
    let base = StrategyEngine.buildCondition(config.strategy);

    if (config.maxBalancePercentage > 0 && config.maxBalancePercentage < 100) {
      base = new BankrollManagement(config.maxBalancePercentage, base);
    }

    return new StrategyEngine(base);
  }

  static buildCondition(config: StrategyConfig): Condition {
    switch (config.type) {
      case StrategyType.AlwaysEnter:
        return new AlwaysEnter();
      case StrategyType.MinJackpot:
        return new MinJackpot(config.threshold);
      case StrategyType.MaxParticipants:
        return new MaxParticipants(Number(config.threshold));
      case StrategyType.ExpectedValue:
        return new ExpectedValue(config.threshold);
      case StrategyType.Composite:
        return new CompositeStrategy(config.threshold, Number(config.threshold2));
      default:
        return new AlwaysEnter();
    }
  }
}
