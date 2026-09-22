import { ethers } from "ethers";

/**
 * Manages HD-derived wallets for agents.
 * Each agent gets a unique wallet derived from a master mnemonic.
 * Derivation path: m/44'/60'/0'/0/{agentIndex}
 */
export class WalletManager {
  private mnemonic: string;
  private provider: ethers.JsonRpcProvider;
  private wallets: Map<number, ethers.Wallet> = new Map();

  constructor(mnemonic: string, rpcUrl: string) {
    this.mnemonic = mnemonic;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  getWallet(agentIndex: number): ethers.Wallet {
    const cached = this.wallets.get(agentIndex);
    if (cached) return cached;

    const hdNode = ethers.HDNodeWallet.fromPhrase(
      this.mnemonic,
      undefined,
      `m/44'/60'/0'/0/${agentIndex}`
    );

    const wallet = new ethers.Wallet(hdNode.privateKey, this.provider);
    this.wallets.set(agentIndex, wallet);
    return wallet;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async getBalance(agentIndex: number): Promise<bigint> {
    const wallet = this.getWallet(agentIndex);
    return this.provider.getBalance(wallet.address);
  }

  getAddress(agentIndex: number): string {
    return this.getWallet(agentIndex).address;
  }

  generateSecret(agentIndex: number, salt: string): bigint {
    const hash = ethers.keccak256(
      ethers.solidityPacked(
        ["string", "uint256", "string"],
        [this.mnemonic, agentIndex, salt]
      )
    );
    // Ensure the value is within the BN254 scalar field
    const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    return BigInt(hash) % BN254_ORDER;
  }
}
