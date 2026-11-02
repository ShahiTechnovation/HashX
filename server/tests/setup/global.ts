/**
 * Global test setup:
 *  1. (Re)creates the dedicated `hashx_test` database and applies all migrations from scratch.
 *  2. Compiles contracts and starts a real local Hardhat EVM (chain 31337) on LOCAL_RPC_PORT.
 *  3. Deploys LocalTestUSDC and mints balances to the deterministic buyer accounts.
 */
import { spawn, execFileSync, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import type { TestProject } from "vitest/node";
import { adminDatabaseUrl, LOCAL_RPC_PORT, LOCAL_RPC_URL, testDatabaseUrl } from "./dbUrl";
import { KEYS } from "./accounts";

declare module "vitest" {
  export interface ProvidedContext {
    localToken: string;
    testDatabaseUrl: string;
  }
}

const CONTRACTS_DIR = path.resolve(__dirname, "../../../contracts");
const HARDHAT_CLI = path.join(CONTRACTS_DIR, "node_modules", "hardhat", "internal", "cli", "cli.js");
let node: ChildProcess | null = null;

async function resetDatabase() {
  const dbName = new URL(testDatabaseUrl()).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName) || !dbName.includes("test")) throw new Error(`Refusing to reset non-test database "${dbName}"`);
  const admin = new Client({ connectionString: adminDatabaseUrl() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();
  process.env.DATABASE_URL = testDatabaseUrl();
  const { runMigrations } = await import("../../src/db/migrate");
  await runMigrations({ connectionString: testDatabaseUrl() }, () => undefined);
}

async function startHardhat() {
  execFileSync(process.execPath, [HARDHAT_CLI, "compile", "--quiet"], { cwd: CONTRACTS_DIR, stdio: "pipe" });
  node = spawn(process.execPath, [HARDHAT_CLI, "node", "--port", String(LOCAL_RPC_PORT), "--hostname", "127.0.0.1"], {
    cwd: CONTRACTS_DIR,
    env: { ...process.env, HARDHAT_MIRROR_CHAIN: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Hardhat node did not start within 60s")), 60_000);
    node!.stdout!.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Started HTTP")) {
        clearTimeout(timer);
        resolve();
      }
    });
    node!.on("exit", (code) => reject(new Error(`Hardhat node exited early (code ${code}). Is port ${LOCAL_RPC_PORT} free?`)));
  });
}

async function deployToken(): Promise<string> {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(CONTRACTS_DIR, "artifacts_hardhat/src/test/LocalTestUSDC.sol/LocalTestUSDC.json"), "utf8")
  );
  const minter = privateKeyToAccount(KEYS.minter);
  const wallet = createWalletClient({ account: minter, chain: hardhat, transport: http(LOCAL_RPC_URL) });
  const pub = createPublicClient({ chain: hardhat, transport: http(LOCAL_RPC_URL) });
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode as Hex });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  const token = receipt.contractAddress!;
  for (const key of [KEYS.buyer, KEYS.attacker]) {
    const h = await wallet.writeContract({
      address: token,
      abi: artifact.abi,
      functionName: "mint",
      args: [privateKeyToAccount(key).address, 1_000_000_000n],
    });
    await pub.waitForTransactionReceipt({ hash: h });
  }
  return token;
}

export default async function setup(project: TestProject) {
  await resetDatabase();
  await startHardhat();
  const token = await deployToken();
  project.provide("localToken", token);
  project.provide("testDatabaseUrl", testDatabaseUrl());
  return async () => {
    node?.kill();
  };
}
