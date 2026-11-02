"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Copy, Check, ShieldAlert, KeyRound } from "lucide-react";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/live/api";
import {
  HASHX_TOOLS,
  HTTP_ENDPOINT_GROUPS,
  MCP_ENDPOINT_PATH,
  TOOL_GROUP_LABELS,
  type MCPToolDef,
  type ToolGroup,
} from "@/components/developers/toolCatalog";

type ExampleTab = "arguments" | "envelope" | "result" | "typescript";

const MCP_URL = `${API_URL}${MCP_ENDPOINT_PATH}`;

function typescriptSnippet(tool: MCPToolDef) {
  return `// npm install @modelcontextprotocol/sdk
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Agent credential minted in HashX → Settings → Agent credentials (shown once).
const AGENT_SECRET = process.env.HASHX_AGENT_SECRET!; // "hx_agent_…"

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("${MCP_URL}"), {
    requestInit: { headers: { Authorization: \`Bearer \${AGENT_SECRET}\` } },
  })
);

const { tools } = await client.listTools(); // 9 tools; none can approve a payment

const result = await client.callTool({
  name: "${tool.name}",
  arguments: ${JSON.stringify(tool.exampleArguments, null, 2).replace(/\n/g, "\n  ")},
});

// Tool results are JSON text content; errors set result.isError = true.
const data = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
console.log(data);

await client.close();
`;
}

const GROUPS: ToolGroup[] = ["invoice", "delivery", "payment"];

export default function DevelopersWorkspacePage() {
  const [selectedTool, setSelectedTool] = useState<MCPToolDef>(HASHX_TOOLS[0]);
  const [exampleTab, setExampleTab] = useState<ExampleTab>("typescript");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const exampleData =
    exampleTab === "arguments"
      ? selectedTool.exampleArguments
      : exampleTab === "envelope"
        ? { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: selectedTool.name, arguments: selectedTool.exampleArguments } }
        : selectedTool.resultShape;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Developer</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">MCP tools &amp; HTTP API</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase">
              HashX MCP Server
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Nine tools at <code>POST /mcp</code> (MCP Streamable HTTP, stateless, JSON responses), backed by the same service functions as the
              HTTP API. Testnet only: settlement is direct Test USDC on Ethereum Sepolia; HashKey HSP is not connected.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1 text-xs font-mono text-carbon-muted">
            <span className="text-[10px] uppercase tracking-wider">Endpoint (from NEXT_PUBLIC_HASHX_API_URL)</span>
            <CopyableValue value={MCP_URL} label="Copy MCP endpoint" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-carbon-border/70 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="flex items-start gap-2">
            <KeyRound className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-carbon-muted">
              <span className="text-carbon-text font-semibold">Authentication:</span> <code>Authorization: Bearer hx_agent_…</code>. Mint a scoped agent
              credential in{" "}
              <Link href="/app/settings" className="text-primary hover:underline">
                Settings
              </Link>{" "}
              (connected mode, signed in). Unauthenticated calls get 401; missing scopes return <code>INSUFFICIENT_SCOPE</code>.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
            <span className="text-carbon-muted">
              <span className="text-carbon-text font-semibold">Human-approval boundary:</span> no approve / authorize / transaction tool exists.
              Agent credentials calling the approval routes get <code>403 HUMAN_SESSION_REQUIRED</code>. A human completes Stage 1 and Stage 2
              with their own wallet in the HashX app. HashX never signs or holds keys.
            </span>
          </div>
        </div>
      </section>

      {/* 2. Tool explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 bg-carbon-nav border border-carbon-border rounded p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-carbon-border text-[11px] font-mono">
            <span className="font-bold text-carbon-muted uppercase tracking-wider">MCP tools ({HASHX_TOOLS.length})</span>
            <span className="px-1.5 py-0.2 rounded bg-carbon-void text-carbon-muted border border-carbon-border text-[10px]">JSON-RPC 2.0</span>
          </div>

          <div className="space-y-4 font-mono">
            {GROUPS.map((group) => (
              <div key={group}>
                <div className="text-[10px] text-carbon-muted uppercase tracking-wider px-2 py-1">{TOOL_GROUP_LABELS[group]}</div>
                <div className="space-y-1 mt-1">
                  {HASHX_TOOLS.filter((t) => t.group === group).map((tool) => {
                    const isSelected = selectedTool.name === tool.name;
                    return (
                      <button
                        key={tool.name}
                        onClick={() => setSelectedTool(tool)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded text-xs transition-colors flex flex-col group border",
                          isSelected
                            ? "bg-carbon-panel text-carbon-text border-primary shadow-sm"
                            : "border-transparent text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-carbon-text group-hover:text-primary">{tool.name}</span>
                          <span
                            className={cn(
                              "text-[9px] px-1 py-0.2 rounded",
                              tool.mutates ? "bg-warning/15 text-warning border border-warning/30" : "bg-success/15 text-success border border-success/30"
                            )}
                          >
                            {tool.mutates ? "WRITES" : "READ-ONLY"}
                          </span>
                        </div>
                        <span className="text-[10px] text-carbon-muted truncate mt-0.5">{tool.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-8 space-y-5">
          <div className="bg-carbon-nav border border-carbon-border rounded p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-carbon-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold text-carbon-text">{selectedTool.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded border font-bold",
                      selectedTool.mutates ? "bg-warning/15 text-warning border-warning/40" : "bg-success/15 text-success border-success/40"
                    )}
                  >
                    {selectedTool.mutates ? "WRITES STATE" : "READ-ONLY"}
                  </span>
                </div>
                <p className="text-xs text-carbon-muted font-mono mt-1">{selectedTool.description}</p>
              </div>
              <div className="font-mono text-xs text-carbon-muted space-y-0.5 shrink-0">
                <div>
                  Scope: <span className="text-carbon-text font-semibold">{selectedTool.scope}</span>
                </div>
                <div>
                  Caller: <span className="text-carbon-text">{selectedTool.caller}</span>
                </div>
              </div>
            </div>

            <div className="bg-carbon-panel p-2.5 rounded border border-carbon-border flex items-center justify-between text-xs font-mono">
              <span className="text-carbon-muted">HTTP equivalent:</span>
              <span className="text-primary font-bold">{selectedTool.httpBinding}</span>
            </div>

            <div>
              <h3 className="font-mono text-xs font-bold text-carbon-muted uppercase tracking-wider mb-2">
                Input parameters ({selectedTool.params.length})
              </h3>
              <div className="border border-carbon-border rounded overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-carbon-void text-[10px] uppercase text-carbon-muted border-b border-carbon-border">
                    <tr>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Required</th>
                      <th className="py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-carbon-border bg-carbon-panel text-[11px]">
                    {selectedTool.params.map((param) => (
                      <tr key={param.name} className="hover:bg-carbon-void transition-colors">
                        <td className="py-2 px-3 font-semibold text-carbon-text">{param.name}</td>
                        <td className="py-2 px-3 text-primary">{param.type}</td>
                        <td className="py-2 px-3">
                          {param.required ? <span className="text-warning font-bold">REQUIRED</span> : <span className="text-carbon-muted">Optional</span>}
                        </td>
                        <td className="py-2 px-3 text-carbon-muted">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-carbon-border pb-3">
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono">
                {[
                  { id: "typescript" as ExampleTab, label: "TypeScript (@modelcontextprotocol/sdk)" },
                  { id: "arguments" as ExampleTab, label: "Arguments" },
                  { id: "envelope" as ExampleTab, label: "JSON-RPC request" },
                  { id: "result" as ExampleTab, label: "Result shape" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setExampleTab(tab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded font-medium transition-colors shrink-0",
                      exampleTab === tab.id
                        ? "bg-carbon-panel text-carbon-text border border-carbon-border font-bold shadow-sm"
                        : "text-carbon-muted hover:text-carbon-text hover:bg-carbon-panel/40"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={async () => {
                  const text = exampleTab === "typescript" ? typescriptSnippet(selectedTool) : JSON.stringify(exampleData, null, 2);
                  await navigator.clipboard.writeText(text);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-carbon-panel hover:bg-carbon-void border border-carbon-border text-[11px] font-mono text-carbon-muted hover:text-carbon-text transition-colors flex items-center gap-1.5 self-end sm:self-auto"
              >
                {copiedSnippet ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSnippet ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <p className="text-[11px] font-mono text-carbon-muted">
              {exampleTab === "result"
                ? "Field overview of the JSON text content returned by the tool — not real data."
                : "Placeholder values (0x<…>, inv_<…>) are illustrative; replace them with your own records."}
            </p>

            {exampleTab === "typescript" ? (
              <pre className="p-4 rounded bg-carbon-void text-carbon-text font-mono text-xs overflow-x-auto border border-carbon-border">
                <code>{typescriptSnippet(selectedTool)}</code>
              </pre>
            ) : (
              <CodeViewer title={`${selectedTool.name} · ${exampleTab}.json`} data={exampleData} maxHeight="max-h-[380px]" />
            )}
          </div>
        </div>
      </div>

      {/* 3. HTTP API */}
      <section className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-5">
        <div>
          <h2 className="text-sm font-display font-bold text-carbon-text uppercase tracking-tight">HTTP API</h2>
          <p className="text-xs font-mono text-carbon-muted mt-1">
            Base URL <code>{API_URL}</code>. JSON bodies; errors are <code>{"{ error, code, details?, requestId }"}</code>. Authenticate with{" "}
            <code>Authorization: Bearer hx_sess_…</code> (SIWE wallet session) or <code>hx_agent_…</code> (scoped agent credential). Headers like{" "}
            <code>x-wallet-address</code> are ignored for identity.
          </p>
        </div>
        {HTTP_ENDPOINT_GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="font-mono text-xs font-bold text-carbon-muted uppercase tracking-wider mb-2">{g.title}</h3>
            <div className="border border-carbon-border rounded overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-carbon-void text-[10px] uppercase text-carbon-muted border-b border-carbon-border">
                  <tr>
                    <th className="py-2 px-3 w-24">Method</th>
                    <th className="py-2 px-3">Path</th>
                    <th className="py-2 px-3">Auth</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-border bg-carbon-panel text-[11px]">
                  {g.endpoints.map((e) => (
                    <tr key={`${e.method} ${e.path}`}>
                      <td className="py-2 px-3 text-primary font-semibold whitespace-nowrap">{e.method}</td>
                      <td className="py-2 px-3 text-carbon-text">{e.path}</td>
                      <td className="py-2 px-3 text-carbon-muted whitespace-nowrap">{e.auth}</td>
                      <td className="py-2 px-3 text-carbon-muted">{e.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-[11px] font-mono text-carbon-muted">
          HSP-rail invoices currently return <code>503 HSP_NOT_CONNECTED</code> on payment request; HashKey Mainnet invoices are rejected with{" "}
          <code>MAINNET_PAYMENTS_DISABLED</code>. Full reference: <code>docs/api-contracts.md</code>.
        </p>
      </section>
    </div>
  );
}
