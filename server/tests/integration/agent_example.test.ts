/** Executes the documented agent-to-agent example end to end against the real app and local EVM. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSubjectActivity, startApp, subject, testClient } from "../setup/helpers";
import { KEYS } from "../setup/accounts";
import { LOCAL_RPC_URL } from "../setup/dbUrl";
import { runGoldenPath } from "../../examples/agent-golden-path";
import { verifyReceiptDocument } from "../../src/cli/verify-receipt";

let app: Awaited<ReturnType<typeof startApp>>;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => app.close());

describe("examples/agent-golden-path.ts", () => {
  it("completes seller agent → delivery → verification → human approval → transfer → receipt", async () => {
    const range = await createSubjectActivity();
    const result = await runGoldenPath({
      apiUrl: app.baseUrl,
      rpcUrl: LOCAL_RPC_URL,
      chainId: 31337,
      sellerKey: KEYS.seller,
      buyerKey: KEYS.buyer,
      subject: subject.address,
      startBlock: range.start,
      endBlock: range.end,
      amountRaw: "1250000",
      afterTransfer: async () => {
        await testClient.mine({ blocks: 1 });
      },
      log: () => undefined,
    });
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    const checks = await verifyReceiptDocument(result.receipt.document, LOCAL_RPC_URL);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });
});
