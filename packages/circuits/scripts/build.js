#!/usr/bin/env node

/**
 * ZK Circuit Build Pipeline
 *
 * Compiles Circom circuits, performs trusted setup, and generates
 * Solidity verifier contracts for deployment.
 *
 * Steps per circuit:
 *   1. Compile .circom → .r1cs + .wasm + .sym
 *   2. Generate zkey (Groth16 setup using powers-of-tau)
 *   3. Export verification key (JSON)
 *   4. Export Solidity verifier contract
 *
 * Usage: node scripts/build.js [--circuit <name>] [--ptau <path>]
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const BUILD = join(ROOT, "build");
const KEYS = join(ROOT, "keys");
const CONTRACTS_ZK = join(ROOT, "..", "contracts", "contracts", "zk");

const CIRCUITS = ["eligibility", "ticket", "claim"];
const PTAU_SIZE = 14; // 2^14 = 16384 constraints (our largest circuit is ~6k); keeps ptau small

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function exec(cmd, opts = {}) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

function checkDependencies() {
  try {
    execSync("circom --version", { stdio: "pipe" });
  } catch {
    console.error("Error: circom is not installed.");
    console.error("Install it from https://docs.circom.io/getting-started/installation/");
    console.error("Or via: cargo install circom");
    process.exit(1);
  }

  try {
    // snarkjs `--version` exits non-zero, so resolve the module instead.
    createRequire(import.meta.url).resolve("snarkjs");
  } catch {
    console.error("Error: snarkjs is not installed. Run 'pnpm install' first.");
    process.exit(1);
  }
}

async function downloadPtau() {
  const ptauFile = join(KEYS, `pot${PTAU_SIZE}_final.ptau`);
  if (existsSync(ptauFile)) {
    console.log(`  Powers of tau file already exists: ${ptauFile}`);
    return ptauFile;
  }

  console.log(`  Generating powers of tau (2^${PTAU_SIZE})...`);
  const ptauNew = join(KEYS, `pot${PTAU_SIZE}_0000.ptau`);
  const ptauContrib = join(KEYS, `pot${PTAU_SIZE}_0001.ptau`);

  exec(`pnpm exec snarkjs powersoftau new bn128 ${PTAU_SIZE} "${ptauNew}" -v`);
  exec(`pnpm exec snarkjs powersoftau contribute "${ptauNew}" "${ptauContrib}" --name="Dev contribution" -v -e="random entropy for development"`);
  exec(`pnpm exec snarkjs powersoftau prepare phase2 "${ptauContrib}" "${ptauFile}" -v`);

  // Drop the intermediates immediately to keep peak disk low
  for (const f of [ptauNew, ptauContrib]) {
    if (existsSync(f)) rmSync(f);
  }

  return ptauFile;
}

async function buildCircuit(name, ptauFile) {
  console.log(`\n========================================`);
  console.log(`  Building circuit: ${name}`);
  console.log(`========================================\n`);

  const circuitDir = join(BUILD, name);
  ensureDir(circuitDir);

  const srcFile = join(SRC, `${name}.circom`);
  if (!existsSync(srcFile)) {
    console.error(`  Circuit source not found: ${srcFile}`);
    process.exit(1);
  }

  // Step 1: Compile
  console.log("  [1/5] Compiling circuit...");
  exec(`circom "${srcFile}" --r1cs --wasm --sym -o "${circuitDir}" -l "${join(ROOT, "node_modules")}"`);

  const r1csFile = join(circuitDir, `${name}.r1cs`);
  const wasmFile = join(circuitDir, `${name}_js`, `${name}.wasm`);

  // Print circuit info
  exec(`pnpm exec snarkjs r1cs info "${r1csFile}"`);

  // Step 2: Generate zkey (Groth16 setup)
  console.log("  [2/5] Generating zkey (Groth16 setup)...");
  const zkey0 = join(KEYS, `${name}_0000.zkey`);
  const zkeyFinal = join(KEYS, `${name}_final.zkey`);

  exec(`pnpm exec snarkjs groth16 setup "${r1csFile}" "${ptauFile}" "${zkey0}"`);
  exec(`pnpm exec snarkjs zkey contribute "${zkey0}" "${zkeyFinal}" --name="Dev contribution" -v -e="random entropy for ${name}"`);

  // Drop the intermediate zkey; only the final zkey is needed to prove
  if (existsSync(zkey0)) rmSync(zkey0);

  // Step 3: Export verification key
  console.log("  [3/5] Exporting verification key...");
  const vkeyFile = join(KEYS, `${name}_verification_key.json`);
  exec(`pnpm exec snarkjs zkey export verificationkey "${zkeyFinal}" "${vkeyFile}"`);

  // Step 4: Export Solidity verifier
  console.log("  [4/5] Generating Solidity verifier...");
  const verifierFile = join(circuitDir, `${capitalize(name)}Verifier.sol`);
  exec(`pnpm exec snarkjs zkey export solidityverifier "${zkeyFinal}" "${verifierFile}"`);

  // Post-process: rename the contract to avoid collisions
  let verifierSource = readFileSync(verifierFile, "utf-8");
  verifierSource = verifierSource.replace(
    /contract Groth16Verifier/g,
    `contract ${capitalize(name)}Verifier`
  );
  writeFileSync(verifierFile, verifierSource);

  // Step 5: Copy verifier to contracts package
  console.log("  [5/5] Copying verifier to contracts...");
  ensureDir(CONTRACTS_ZK);
  copyFileSync(verifierFile, join(CONTRACTS_ZK, `${capitalize(name)}Verifier.sol`));

  console.log(`  ✓ Circuit ${name} built successfully`);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  console.log("Agent Lottery — ZK Circuit Build Pipeline\n");

  checkDependencies();
  ensureDir(BUILD);
  ensureDir(KEYS);

  const ptauFile = await downloadPtau();

  const targetCircuit = process.argv.find((a, i) => process.argv[i - 1] === "--circuit");
  const circuits = targetCircuit ? [targetCircuit] : CIRCUITS;

  for (const circuit of circuits) {
    await buildCircuit(circuit, ptauFile);
  }

  // The ptau is only needed during setup — drop it now that zkeys exist
  if (existsSync(ptauFile)) rmSync(ptauFile);

  console.log("\n========================================");
  console.log("  All circuits built successfully!");
  console.log(`  Verifiers copied to: ${CONTRACTS_ZK}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
