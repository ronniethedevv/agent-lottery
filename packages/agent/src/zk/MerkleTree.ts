import { poseidonHash2 } from "./poseidon.js";
import { PROTOCOL_CONSTANTS } from "@agent-lottery/common";

/**
 * Client-side incremental Merkle tree that mirrors the on-chain tree.
 * Used to generate Merkle proofs for claim transactions.
 */
export class MerkleTree {
  readonly depth: number;
  readonly zeroValues: bigint[];
  private leaves: bigint[] = [];
  private layers: bigint[][] = [];

  private constructor(depth: number, zeroValues: bigint[]) {
    this.depth = depth;
    this.zeroValues = zeroValues;
    this.layers = Array.from({ length: depth + 1 }, () => []);
  }

  static async create(depth: number = PROTOCOL_CONSTANTS.MERKLE_TREE_DEPTH): Promise<MerkleTree> {
    const zeroValues: bigint[] = [0n];
    for (let i = 1; i <= depth; i++) {
      zeroValues[i] = await poseidonHash2(zeroValues[i - 1], zeroValues[i - 1]);
    }
    return new MerkleTree(depth, zeroValues);
  }

  async insert(leaf: bigint): Promise<number> {
    const index = this.leaves.length;
    this.leaves.push(leaf);
    await this._rebuild();
    return index;
  }

  async getProof(leafIndex: number): Promise<{
    pathElements: bigint[];
    pathIndices: number[];
    root: bigint;
  }> {
    if (leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds (${this.leaves.length} leaves)`);
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    let currentIndex = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const layerValues = this.layers[level];

      const sibling = siblingIndex < layerValues.length
        ? layerValues[siblingIndex]
        : this.zeroValues[level];

      pathElements.push(sibling);
      pathIndices.push(currentIndex % 2);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      pathElements,
      pathIndices,
      root: this.getRoot(),
    };
  }

  getRoot(): bigint {
    if (this.layers[this.depth].length === 0) {
      return this.zeroValues[this.depth];
    }
    return this.layers[this.depth][0];
  }

  getLeafCount(): number {
    return this.leaves.length;
  }

  private async _rebuild(): Promise<void> {
    // Layer 0 = leaves
    this.layers[0] = [...this.leaves];

    for (let level = 0; level < this.depth; level++) {
      const currentLayer = this.layers[level];
      const nextLayer: bigint[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length
          ? currentLayer[i + 1]
          : this.zeroValues[level];
        nextLayer.push(await poseidonHash2(left, right));
      }

      // If empty, push zero
      if (nextLayer.length === 0) {
        nextLayer.push(this.zeroValues[level + 1]);
      }

      this.layers[level + 1] = nextLayer;
    }
  }
}
