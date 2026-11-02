import { describe, expect, it } from "vitest";
import { HashKeyHSPSettlementAdapter, HSPNotConnectedError, HSP_TOOL_ARGUMENTS } from "../../src/settlement/hspAdapter";

const base = { endpoint: "https://hsp.example/mcp", merchantName: "HashX", appKey: "k", appSecret: "s", allowlistConfirmed: true, egressIpDeclared: null };

function fakeClient(tools: Array<{ name: string; inputSchema?: any }>, fail?: string) {
  return () =>
    ({
      connect: async () => {
        if (fail) throw new Error(fail);
      },
      listTools: async () => ({ tools }),
      callTool: async () => {
        throw new Error("must never be called while unavailable");
      },
      close: async () => undefined,
    }) as any;
}

describe("HashKey HSP adapter stays fail-closed", () => {
  it("not configured → unavailable, never connects", async () => {
    const a = new HashKeyHSPSettlementAdapter({ ...base, appKey: null, appSecret: null });
    const s = await a.connect();
    expect(s.connection).toBe("not_configured");
    expect(s.settlementAvailable).toBe(false);
    expect(() => a.assertAvailable()).toThrow(HSPNotConnectedError);
  });

  it("allowlist unconfirmed → no outbound connection attempted", async () => {
    let attempted = false;
    const a = new HashKeyHSPSettlementAdapter({ ...base, allowlistConfirmed: false }, () => {
      attempted = true;
      return fakeClient([])();
    });
    const s = await a.connect();
    expect(attempted).toBe(false);
    expect(s.connection).toBe("blocked_allowlist_unconfirmed");
  });

  it("distinguishes authentication rejection from transport failure", async () => {
    const rejected = await new HashKeyHSPSettlementAdapter(base, fakeClient([], "HTTP 401 Unauthorized")).connect();
    expect(rejected.connection).toBe("failed");
    expect(rejected.authentication).toBe("rejected");
    const down = await new HashKeyHSPSettlementAdapter(base, fakeClient([], "ECONNREFUSED")).connect();
    expect(down.authentication).toBe("unknown");
  });

  it("reports missing tools and schema incompatibilities from real discovery", async () => {
    const a = new HashKeyHSPSettlementAdapter(base, fakeClient([{ name: "create_order", inputSchema: { properties: { amount: {} } } }]));
    const s = await a.connect();
    expect(s.connection).toBe("connected");
    expect(s.missingTools).toContain("prepare_payment");
    expect(s.schemaIncompatibilities[0]).toMatch(/create_order: schema lacks/);
    expect(s.settlementAvailable).toBe(false);
  });

  it("even a fully compatible discovery does not enable execution while the credential scheme is unverified", async () => {
    const tools = Object.entries(HSP_TOOL_ARGUMENTS).map(([name, args]) => ({
      name,
      inputSchema: { properties: Object.fromEntries(args.map((x) => [x, {}])) },
    }));
    const a = new HashKeyHSPSettlementAdapter(base, fakeClient(tools));
    const s = await a.connect();
    expect(s.missingTools).toEqual([]);
    expect(s.schemaIncompatibilities).toEqual([]);
    expect(s.settlementAvailable).toBe(false);
    expect(s.blockers.join(" ")).toMatch(/unverified/);
    expect(() => a.assertAvailable()).toThrow(HSPNotConnectedError);
    expect(JSON.stringify(a.publicStatus())).not.toMatch(/hsp\.example|"k"|"s"/);
  });
});
