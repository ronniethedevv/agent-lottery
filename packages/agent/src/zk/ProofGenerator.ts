import * as snarkjs from "snarkjs";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
  Groth16Proof,
  EligibilityPublicInputs,
  TicketPublicInputs,
  ClaimPublicInputs,
} from "@agent-lottery/common";

export interface CircuitPaths {
  eligibility: { wasm: string; zkey: string };
  ticket: { wasm: string; zkey: string };
  claim: { wasm: string; zkey: string };
}

interface ProofResult {
  proof: Groth16Proof;
  publicSignals: string[];
}

export class ProofGenerator {
  private paths: CircuitPaths;
  private wasmCache: Map<string, Buffer> = new Map();

  constructor(circuitBasePath: string) {
    this.paths = {
      eligibility: {
        wasm: join(circuitBasePath, "build", "eligibility", "eligibility_js", "eligibility.wasm"),
        zkey: join(circuitBasePath, "keys", "eligibility_final.zkey"),
      },
      ticket: {
        wasm: join(circuitBasePath, "build", "ticket", "ticket_js", "ticket.wasm"),
        zkey: join(circuitBasePath, "keys", "ticket_final.zkey"),
      },
      claim: {
        wasm: join(circuitBasePath, "build", "claim", "claim_js", "claim.wasm"),
        zkey: join(circuitBasePath, "keys", "claim_final.zkey"),
      },
    };
  }

  async generateEligibilityProof(inputs: {
    balance: bigint;
    strategyType: number;
    strategyThreshold: bigint;
    strategyThreshold2: bigint;
    agentSecret: bigint;
    lotteryId: bigint;
    minEntryFee: bigint;
    jackpotSize: bigint;
    participantCount: bigint;
    agentCommitment: bigint;
  }): Promise<ProofResult> {
    const circuitInputs = {
      balance: inputs.balance.toString(),
      strategyType: inputs.strategyType.toString(),
      strategyThreshold: inputs.strategyThreshold.toString(),
      strategyThreshold2: inputs.strategyThreshold2.toString(),
      agentSecret: inputs.agentSecret.toString(),
      lotteryId: inputs.lotteryId.toString(),
      minEntryFee: inputs.minEntryFee.toString(),
      jackpotSize: inputs.jackpotSize.toString(),
      participantCount: inputs.participantCount.toString(),
      agentCommitment: inputs.agentCommitment.toString(),
    };

    return this._generateProof("eligibility", circuitInputs);
  }

  async generateTicketProof(inputs: {
    secret: bigint;
    nullifier: bigint;
    commitment: bigint;
    lotteryId: bigint;
  }): Promise<ProofResult> {
    const circuitInputs = {
      secret: inputs.secret.toString(),
      nullifier: inputs.nullifier.toString(),
      commitment: inputs.commitment.toString(),
      lotteryId: inputs.lotteryId.toString(),
    };

    return this._generateProof("ticket", circuitInputs);
  }

  async generateClaimProof(inputs: {
    secret: bigint;
    nullifier: bigint;
    pathElements: bigint[];
    pathIndices: number[];
    root: bigint;
    nullifierHash: bigint;
    lotteryId: bigint;
    roundId: bigint;
    recipient: bigint;
    leafIndex: number;
  }): Promise<ProofResult> {
    const circuitInputs = {
      secret: inputs.secret.toString(),
      nullifier: inputs.nullifier.toString(),
      pathElements: inputs.pathElements.map((e) => e.toString()),
      pathIndices: inputs.pathIndices.map((i) => i.toString()),
      root: inputs.root.toString(),
      nullifierHash: inputs.nullifierHash.toString(),
      lotteryId: inputs.lotteryId.toString(),
      roundId: inputs.roundId.toString(),
      recipient: inputs.recipient.toString(),
      leafIndex: inputs.leafIndex.toString(),
    };

    return this._generateProof("claim", circuitInputs);
  }

  private async _generateProof(
    circuitName: keyof CircuitPaths,
    inputs: Record<string, string | string[]>
  ): Promise<ProofResult> {
    const paths = this.paths[circuitName];

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      paths.wasm,
      paths.zkey
    );

    return {
      proof: {
        a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
        b: [
          [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
          [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
        ],
        c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
      },
      publicSignals,
    };
  }

  static formatProofForContract(proof: Groth16Proof): {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  } {
    return {
      a: [proof.a[0].toString(), proof.a[1].toString()],
      b: [
        [proof.b[0][0].toString(), proof.b[0][1].toString()],
        [proof.b[1][0].toString(), proof.b[1][1].toString()],
      ],
      c: [proof.c[0].toString(), proof.c[1].toString()],
    };
  }
}
