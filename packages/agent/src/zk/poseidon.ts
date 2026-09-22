/**
 * Poseidon hash wrapper for agent-side computation.
 * Uses the circomlibjs implementation to match on-chain + circuit Poseidon.
 */

// circomlibjs provides the Poseidon hash matching circomlib circuits
let poseidonFn: ((inputs: bigint[]) => Uint8Array) | null = null;
let F: { toObject: (v: Uint8Array) => bigint } | null = null;

async function loadPoseidon() {
  if (poseidonFn) return;

  // Dynamic import because circomlibjs uses CommonJS
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  poseidonFn = poseidon;
  F = poseidon.F;
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  await loadPoseidon();
  const hash = poseidonFn!(inputs);
  return F!.toObject(hash);
}

export async function poseidonHash2(a: bigint, b: bigint): Promise<bigint> {
  return poseidonHash([a, b]);
}

export async function poseidonHash1(a: bigint): Promise<bigint> {
  return poseidonHash([a]);
}
