export const CHAIN_IDS = {
  BSC_MAINNET: 56,
  BSC_TESTNET: 97,
  HARDHAT: 31337,
} as const;

export const RPC_URLS: Record<number, string> = {
  [CHAIN_IDS.BSC_MAINNET]: "https://bsc-dataseed1.binance.org/",
  [CHAIN_IDS.BSC_TESTNET]: "https://data-seed-prebsc-1-s1.binance.org:8545/",
  [CHAIN_IDS.HARDHAT]: "http://127.0.0.1:8545/",
};

export const BLOCK_EXPLORERS: Record<number, string> = {
  [CHAIN_IDS.BSC_MAINNET]: "https://bscscan.com",
  [CHAIN_IDS.BSC_TESTNET]: "https://testnet.bscscan.com",
};

export const VRF_CONFIG = {
  [CHAIN_IDS.BSC_MAINNET]: {
    coordinator: "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE",
    keyHash: "0x114f3da0a805b6a67d6e9cd2ec746f7028f1b7376365af575cfea3550dd1aa04",
  },
  [CHAIN_IDS.BSC_TESTNET]: {
    coordinator: "0xDA3b641D438362C440Ac5458c57e00a712b66700",
    keyHash: "0x8596b430971ac45bdf6088665b9ad8e8630c9d5049ab54b14dff711bee7c0e26",
  },
} as const;

export const PROTOCOL_CONSTANTS = {
  MERKLE_TREE_DEPTH: 20,
  ROOT_HISTORY_SIZE: 30,
  MIN_STAKE: "100000000000000000", // 0.1 BNB in wei
  DEFAULT_DEREGISTRATION_COOLDOWN: 86400, // 24 hours
  DEFAULT_PROTOCOL_FEE_RATE: 200, // 2% in basis points
  CLAIM_TIMEOUT: 172800, // 48 hours
  MAX_CREATOR_FEE_RATE: 1000, // 10% in basis points
  MIN_ENTRY_FEE: "1000000000000000", // 0.001 BNB
  MAX_ENTRY_FEE: "100000000000000000000", // 100 BNB
} as const;

export const ZERO_VALUE = BigInt(0);
