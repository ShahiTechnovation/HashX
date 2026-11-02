/**
 * OPT-IN read-only Sepolia RPC integration test. Runs only when SEPOLIA_RPC_URL_TEST is set.
 * It never sends transactions; it validates chain ID and Circle's official test USDC on-chain.
 */
import { describe, expect, it } from "vitest";
import { ViemChainReader } from "../../src/chain/readers";
import { validateSettlementToken } from "../../src/settlement/sepoliaUsdc";
import { loadConfig } from "../../src/config";
import { SEPOLIA_CHAIN_ID } from "../../../shared/networks";

const rpc = process.env.SEPOLIA_RPC_URL_TEST;

describe.skipIf(!rpc)("Sepolia RPC (read-only, opt-in)", () => {
  it("RPC reports chain 11155111 and the official USDC contract has code, 6 decimals and symbol USDC", async () => {
    const reader = new ViemChainReader(SEPOLIA_CHAIN_ID, rpc!, 15000);
    await reader.assertChainId();
    const chainCfg = loadConfig({ ...process.env, SEPOLIA_RPC_URL: rpc }).chains.get(SEPOLIA_CHAIN_ID)!;
    const v = await validateSettlementToken(reader, chainCfg);
    expect(v, JSON.stringify(v)).toMatchObject({ ok: true, decimals: 6, symbol: "USDC" });
  });

  it("a reader expecting another chain refuses the Sepolia RPC", async () => {
    const wrong = new ViemChainReader(1, rpc!, 15000);
    await expect(wrong.assertChainId()).rejects.toMatchObject({ code: "RPC_CHAIN_MISMATCH" });
  });
});
