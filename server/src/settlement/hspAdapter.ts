/**
 * HashKeyHSPSettlementAdapter — HashKey Settlement Protocol via MCP (Streamable HTTP).
 *
 * Status: FAIL-CLOSED. This adapter never fabricates flow IDs, transaction hashes,
 * confirmations, or finality. Settlement is reported available only when ALL hold:
 *   1. endpoint + credentials are configured on the backend (never the frontend);
 *   2. the operator confirmed the backend's real public egress IP is allowlisted;
 *   3. an MCP connection was actually established and the server accepted our credentials;
 *   4. the required tools were discovered via tools/list; and
 *   5. each discovered tool's input schema accepts the exact arguments this adapter sends.
 * A boolean flag alone can never enable execution.
 *
 * Known blocker: HashKey has not published (to this team) a public specification of the
 * credential header scheme. The header names below are UNVERIFIED and are reported as such.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AppConfig } from "../config.js";
import { log } from "../lib/core.js";

export class HSPNotConnectedError extends Error {
  readonly code = "HSP_NOT_CONNECTED";
  constructor(message = "HashKey HSP is not connected. HSP settlement is unavailable; no payment was created.") {
    super(message);
    this.name = "HSPNotConnectedError";
  }
}

/** Arguments this adapter would send to each HSP tool. Used to validate discovered schemas. */
export const HSP_TOOL_ARGUMENTS: Record<string, string[]> = {
  get_chain_config: ["chain_id"],
  create_order: ["merchant_name", "pay_to", "payer", "currency", "amount_minor", "preferred_chain_id", "reference_id"],
  prepare_payment: ["flow_id", "payment_request_id", "payer"],
  submit_payment: ["flow_id", "payment_request_id"],
  query_payment: ["flow_id", "payment_request_id"],
};

export type HSPConnectionState = "not_configured" | "blocked_allowlist_unconfirmed" | "not_attempted" | "connecting" | "connected" | "failed";

export interface HSPStatus {
  rail: "hashkey-hsp";
  configured: boolean;
  allowlistConfirmed: boolean;
  connection: HSPConnectionState;
  authentication: "unknown" | "accepted" | "rejected";
  credentialScheme: "unverified";
  discoveredTools: string[];
  missingTools: string[];
  schemaIncompatibilities: string[];
  settlementAvailable: boolean;
  blockers: string[];
  lastError: string | null;
  checkedAt: string | null;
}

type McpLike = Pick<Client, "connect" | "listTools" | "callTool" | "close">;

export class HashKeyHSPSettlementAdapter {
  readonly rail = "hashkey-hsp" as const;
  private client: McpLike | null = null;
  private state: HSPConnectionState;
  private auth: HSPStatus["authentication"] = "unknown";
  private tools = new Map<string, { inputSchema?: { properties?: Record<string, unknown> } }>();
  private lastError: string | null = null;
  private checkedAt: string | null = null;

  constructor(
    private readonly cfg: AppConfig["hsp"],
    private readonly clientFactory: () => McpLike = () => new Client({ name: "hashx-backend", version: "2.0.0" }, { capabilities: {} })
  ) {
    this.state = !this.isConfigured() ? "not_configured" : !cfg.allowlistConfirmed ? "blocked_allowlist_unconfirmed" : "not_attempted";
  }

  isConfigured(): boolean {
    return Boolean(this.cfg.endpoint && this.cfg.appKey && this.cfg.appSecret);
  }

  /** Attempts a real connection. Safe to call at startup; failures are recorded, never thrown. */
  async connect(): Promise<HSPStatus> {
    if (!this.isConfigured() || !this.cfg.allowlistConfirmed) return this.status();
    this.state = "connecting";
    try {
      const transport = new StreamableHTTPClientTransport(new URL(this.cfg.endpoint!), {
        requestInit: {
          headers: {
            // UNVERIFIED header scheme — see module docs.
            "x-merchant-name": this.cfg.merchantName,
            "x-app-key": this.cfg.appKey!,
            "x-app-secret": this.cfg.appSecret!,
          },
        },
      });
      const client = this.clientFactory();
      await client.connect(transport);
      this.client = client;
      this.state = "connected";
      this.auth = "accepted";
      const listed = await client.listTools();
      this.tools.clear();
      for (const t of listed.tools) this.tools.set(t.name, t as never);
      this.lastError = null;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.state = "failed";
      this.auth = /401|403|unauthori[sz]ed|forbidden/i.test(msg) ? "rejected" : "unknown";
      this.lastError = msg.slice(0, 300);
      this.client = null;
      log("WARN", "hsp_connect_failed", { error: this.lastError });
    }
    this.checkedAt = new Date().toISOString();
    return this.status();
  }

  status(): HSPStatus {
    const discovered = Array.from(this.tools.keys()).sort();
    const missing = Object.keys(HSP_TOOL_ARGUMENTS).filter((t) => !this.tools.has(t));
    const incompatibilities: string[] = [];
    for (const [name, args] of Object.entries(HSP_TOOL_ARGUMENTS)) {
      const tool = this.tools.get(name);
      if (!tool) continue;
      const props = Object.keys(tool.inputSchema?.properties ?? {});
      const unknown = args.filter((a) => !props.includes(a));
      if (unknown.length) incompatibilities.push(`${name}: schema lacks ${unknown.join(", ")}`);
    }
    const blockers: string[] = [];
    if (!this.isConfigured()) blockers.push("HSP endpoint/credentials not configured on the backend");
    if (!this.cfg.allowlistConfirmed) blockers.push("Backend public egress IP allowlisting not confirmed by HSP operations");
    if (this.state !== "connected") blockers.push(`MCP connection state: ${this.state}`);
    if (this.state === "connected" && missing.length) blockers.push(`Required tools not exposed: ${missing.join(", ")}`);
    if (incompatibilities.length) blockers.push("Discovered tool schemas do not match adapter arguments");
    blockers.push("Credential header scheme unverified against an official HSP specification");

    // The unverified credential scheme is itself a blocker: execution stays disabled.
    const settlementAvailable = false;
    return {
      rail: "hashkey-hsp",
      configured: this.isConfigured(),
      allowlistConfirmed: this.cfg.allowlistConfirmed,
      connection: this.state,
      authentication: this.auth,
      credentialScheme: "unverified",
      discoveredTools: discovered,
      missingTools: this.state === "connected" ? missing : Object.keys(HSP_TOOL_ARGUMENTS),
      schemaIncompatibilities: incompatibilities,
      settlementAvailable,
      blockers,
      lastError: this.lastError,
      checkedAt: this.checkedAt,
    };
  }

  /** Public health view: no endpoint URLs, credentials, or raw provider errors. */
  publicStatus() {
    const s = this.status();
    return {
      rail: s.rail,
      configured: s.configured,
      allowlistConfirmed: s.allowlistConfirmed,
      connection: s.connection,
      authentication: s.authentication,
      toolsDiscovered: s.discoveredTools.length,
      settlementAvailable: s.settlementAvailable,
      blockers: s.blockers,
    };
  }

  /** Entry point used by the payments service. Throws until every availability condition holds. */
  assertAvailable(): void {
    const s = this.status();
    if (!s.settlementAvailable) {
      throw new HSPNotConnectedError(`HSP settlement unavailable: ${s.blockers.join("; ")}`);
    }
  }

  async close() {
    await this.client?.close().catch(() => undefined);
    this.client = null;
  }
}
