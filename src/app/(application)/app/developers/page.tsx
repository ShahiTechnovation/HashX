"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldAlert, KeyRound } from "lucide-react";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { buttonStyles } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelBody, PanelFooter, SectionHeading } from "@/components/ui/Panel";
import { DataList, DataRow } from "@/components/ui/DataList";
import { Segmented } from "@/components/ui/Field";
import { toneStyles } from "@/components/ui/StatusBadge";
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

const EXAMPLE_TABS: Array<{ value: ExampleTab; label: string }> = [
  { value: "typescript", label: "TypeScript" },
  { value: "arguments", label: "Arguments" },
  { value: "envelope", label: "JSON-RPC request" },
  { value: "result", label: "Result shape" },
];

const AccessBadge: React.FC<{ mutates: boolean; size?: "sm" | "md" }> = ({ mutates, size = "sm" }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
      size === "sm" ? "px-1.5 py-px text-2xs" : "px-2 py-0.5 text-xs",
      mutates ? toneStyles.warning.badge : toneStyles.neutral.badge
    )}
  >
    <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", mutates ? toneStyles.warning.dot : toneStyles.neutral.dot)} />
    {mutates ? "Writes state" : "Read-only"}
  </span>
);

export default function DevelopersWorkspacePage() {
  const [selectedTool, setSelectedTool] = useState<MCPToolDef>(HASHX_TOOLS[0]);
  const [exampleTab, setExampleTab] = useState<ExampleTab>("typescript");

  const exampleData =
    exampleTab === "arguments"
      ? selectedTool.exampleArguments
      : exampleTab === "envelope"
        ? { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: selectedTool.name, arguments: selectedTool.exampleArguments } }
        : selectedTool.resultShape;

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          className="pb-6"
          eyebrow="Developers"
          title="MCP server & HTTP API"
          description={
            <>
              Nine tools at <code className="code-inline">POST /mcp</code> (MCP Streamable HTTP, stateless, JSON responses), backed by the same
              service functions as the HTTP API. Testnet only: settlement is direct Test USDC on Ethereum Sepolia; HashKey HSP is not connected.
            </>
          }
          meta={
            <>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className="text-foreground-muted">MCP endpoint</span>
                <CopyableValue value={MCP_URL} label="Copy MCP endpoint" />
              </span>
              <span className="text-foreground-muted">from NEXT_PUBLIC_HASHX_API_URL</span>
            </>
          }
          actions={
            <Link href="/app/settings" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <KeyRound />
              Agent credentials
            </Link>
          }
        />

        {/* On-page navigation */}
        <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-3 text-[13px]">
          <span className="text-foreground-muted">On this page</span>
          <a href="#access" className="text-foreground-secondary transition-colors hover:text-foreground">
            Access & boundaries
          </a>
          <a href="#mcp-tools" className="text-foreground-secondary transition-colors hover:text-foreground">
            MCP tools
          </a>
          <a href="#http-api" className="text-foreground-secondary transition-colors hover:text-foreground">
            HTTP API
          </a>
        </nav>
      </div>

      {/* Access */}
      <section id="access" aria-labelledby="access-title" className="scroll-mt-20 space-y-4">
        <SectionHeading title={<span id="access-title">Access & boundaries</span>} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel>
            <PanelBody className="flex gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
              <div className="space-y-1.5 text-[13px] leading-relaxed text-foreground-secondary">
                <h3 className="font-medium text-foreground">Authentication</h3>
                <p>
                  Send <code className="code-inline">Authorization: Bearer hx_agent_…</code>. Mint a scoped agent credential in{" "}
                  <Link href="/app/settings" className="text-primary-light hover:underline">
                    Settings
                  </Link>{" "}
                  (connected mode, signed in). Unauthenticated calls get <code className="code-inline">401</code>; missing scopes return{" "}
                  <code className="code-inline">INSUFFICIENT_SCOPE</code>.
                </p>
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody className="flex gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div className="space-y-1.5 text-[13px] leading-relaxed text-foreground-secondary">
                <h3 className="font-medium text-foreground">Human-approval boundary</h3>
                <p>
                  No approve, authorize, or transaction tool exists. Agent credentials calling the approval routes get{" "}
                  <code className="code-inline">403 HUMAN_SESSION_REQUIRED</code>. A human completes Stage 1 and Stage 2 with their own wallet in
                  the HashX app. HashX never signs or holds keys.
                </p>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </section>

      {/* Tool explorer */}
      <section id="mcp-tools" aria-labelledby="mcp-tools-title" className="scroll-mt-20 space-y-4">
        <SectionHeading
          title={<span id="mcp-tools-title">MCP tools</span>}
          description={`${HASHX_TOOLS.length} tools · JSON-RPC 2.0 over MCP Streamable HTTP`}
        />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Panel as="aside" aria-label="MCP tools" className="lg:sticky lg:top-6 lg:col-span-4">
            <nav className="divide-y divide-border">
              {GROUPS.map((group) => (
                <div key={group} className="p-2">
                  <p className="px-2.5 pb-1.5 pt-2 text-xs text-foreground-muted">{TOOL_GROUP_LABELS[group]}</p>
                  <ul className="space-y-0.5">
                    {HASHX_TOOLS.filter((t) => t.group === group).map((tool) => {
                      const isSelected = selectedTool.name === tool.name;
                      return (
                        <li key={tool.name}>
                          <button
                            type="button"
                            onClick={() => setSelectedTool(tool)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150",
                              isSelected
                                ? "bg-surface-2 shadow-[inset_2px_0_0_0_rgb(var(--primary))]"
                                : "hover:bg-surface-2/70"
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className={cn("font-mono text-xs", isSelected ? "text-foreground" : "text-foreground-secondary")}>
                                {tool.name}
                              </span>
                              {tool.mutates && (
                                <span className="text-2xs text-warning" aria-label="Writes state">
                                  Writes
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-foreground-muted">{tool.description}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </Panel>

          <div className="min-w-0 space-y-6 lg:col-span-8">
            <Panel key={selectedTool.name} className="animate-crossfade">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-mono text-lg font-medium tracking-[-0.01em] text-foreground">{selectedTool.name}</h3>
                  <AccessBadge mutates={selectedTool.mutates} size="md" />
                </div>
                <p className="max-w-2xl text-[13px] leading-relaxed text-foreground-secondary">{selectedTool.description}</p>
              </div>
              <PanelBody className="space-y-6 sm:px-6">
                <DataList>
                  <DataRow label="Scope" mono>{selectedTool.scope}</DataRow>
                  <DataRow label="Caller">{selectedTool.caller}</DataRow>
                  <DataRow label="HTTP equivalent" mono>{selectedTool.httpBinding}</DataRow>
                </DataList>

                <div>
                  <h4 className="mb-2.5 text-[13px] font-medium text-foreground">
                    Input parameters <span className="font-normal text-foreground-muted">({selectedTool.params.length})</span>
                  </h4>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="table-base min-w-[560px]">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTool.params.map((param) => (
                          <tr key={param.name}>
                            <td className="whitespace-nowrap font-mono text-xs text-foreground">{param.name}</td>
                            <td className="whitespace-nowrap font-mono text-xs text-foreground-secondary">{param.type}</td>
                            <td className="whitespace-nowrap text-xs">
                              {param.required ? (
                                <span className="font-medium text-foreground">Required</span>
                              ) : (
                                <span className="text-foreground-muted">Optional</span>
                              )}
                            </td>
                            <td className="text-xs leading-relaxed text-foreground-secondary">{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-[13px] font-medium text-foreground">Example</h4>
                <div className="max-w-full overflow-x-auto">
                  <Segmented value={exampleTab} onChange={setExampleTab} options={EXAMPLE_TABS} size="sm" />
                </div>
              </div>
              <p className="text-xs text-foreground-muted">
                {exampleTab === "result"
                  ? "Field overview of the JSON text content returned by the tool — not real data."
                  : exampleTab === "typescript"
                    ? "Uses the official MCP TypeScript SDK (@modelcontextprotocol/sdk). Placeholder values (0x<…>, inv_<…>) are illustrative."
                    : "Placeholder values (0x<…>, inv_<…>) are illustrative; replace them with your own records."}
              </p>
              {exampleTab === "typescript" ? (
                <CodeViewer
                  key={`${selectedTool.name}-ts`}
                  title="agent.ts"
                  language="typescript"
                  data={typescriptSnippet(selectedTool)}
                  maxHeight="max-h-[480px]"
                  className="animate-crossfade"
                />
              ) : (
                <CodeViewer
                  key={`${selectedTool.name}-${exampleTab}`}
                  title={`${selectedTool.name} · ${exampleTab}.json`}
                  data={exampleData}
                  maxHeight="max-h-[380px]"
                  className="animate-crossfade"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* HTTP API */}
      <section id="http-api" aria-labelledby="http-api-title" className="scroll-mt-20 space-y-4">
        <SectionHeading
          title={<span id="http-api-title">HTTP API</span>}
          description={
            <>
              Base URL <span className="font-mono">{API_URL}</span>
            </>
          }
        />
        <Panel>
          <PanelBody className="border-b border-border text-[13px] leading-relaxed text-foreground-secondary">
            JSON bodies; errors are <code className="code-inline">{"{ error, code, details?, requestId }"}</code>. Authenticate with{" "}
            <code className="code-inline">Authorization: Bearer hx_sess_…</code> (SIWE wallet session) or{" "}
            <code className="code-inline">hx_agent_…</code> (scoped agent credential). Headers like{" "}
            <code className="code-inline">x-wallet-address</code> are ignored for identity.
          </PanelBody>
          <div className="divide-y divide-border">
            {HTTP_ENDPOINT_GROUPS.map((g) => (
              <div key={g.title} className="py-2">
                <h3 className="px-4 pb-2 pt-3 text-[13px] font-medium text-foreground sm:px-5">{g.title}</h3>
                <div className="overflow-x-auto">
                  <table className="table-base min-w-[720px]">
                    <thead>
                      <tr>
                        <th className="w-24">Method</th>
                        <th>Path</th>
                        <th>Auth</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.endpoints.map((e) => (
                        <tr key={`${e.method} ${e.path}`} className="hover:bg-surface-2/50">
                          <td className="whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex rounded px-1.5 py-px font-mono text-2xs font-medium ring-1 ring-inset",
                                e.method === "GET" ? toneStyles.neutral.badge : toneStyles.accent.badge
                              )}
                            >
                              {e.method}
                            </span>
                          </td>
                          <td className="font-mono text-xs text-foreground">{e.path}</td>
                          <td className="whitespace-nowrap text-xs text-foreground-secondary">{e.auth}</td>
                          <td className="text-xs leading-relaxed text-foreground-secondary">{e.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <PanelFooter className="text-xs leading-relaxed text-foreground-muted">
            HSP-rail invoices currently return <code className="code-inline">503 HSP_NOT_CONNECTED</code> on payment request; HashKey Mainnet
            invoices are rejected with <code className="code-inline">MAINNET_PAYMENTS_DISABLED</code>. Full reference:{" "}
            <span className="font-mono">docs/api-contracts.md</span>.
          </PanelFooter>
        </Panel>
      </section>
    </div>
  );
}
