"use client";

import React, { useState } from "react";
import {
  Terminal,
  Code2,
  Lock,
  Copy,
  Check,
  Play,
  Share2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { CodeViewer } from "@/components/ui/CodeViewer";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { cn } from "@/lib/utils";
import { HASHX_TOOLS, HSP_TOOLS, HSP_MCP_ENDPOINT, type MCPToolDef } from "@/components/developers/toolCatalog";

const HASHX_API_URL = process.env.NEXT_PUBLIC_HASHX_API_URL || "http://localhost:8080";

type ExampleTab = "arguments" | "envelope" | "response" | "python" | "typescript";

export default function DevelopersWorkspacePage() {
  const { mode } = useApp();
  const [selectedTool, setSelectedTool] = useState<MCPToolDef>(HASHX_TOOLS[0]);
  const [exampleTab, setExampleTab] = useState<ExampleTab>("arguments");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const getPythonSnippet = (tool: MCPToolDef) => {
    return `# HashX Agent Integration (Standard MCP over HTTP JSON-RPC)
# Planned SDK wrapper; currently connects via standard MCP JSON-RPC protocol
import httpx

response = httpx.post(
    "${HASHX_API_URL}/mcp",
    headers={"Content-Type": "application/json"},
    json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "${tool.name}",
            "arguments": ${JSON.stringify(tool.requestSchema, null, 4)}
        }
    }
)

result = response.json()
print("Tool Execution Result:", result)
`;
  };

  const getTypescriptSnippet = (tool: MCPToolDef) => {
    return `// HashX TypeScript SDK (MCP Client)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(new URL("${HASHX_API_URL}/mcp"));
const client = new Client({ name: "agent-runner", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

// Execute ${tool.name}
const response = await client.callTool({
  name: "${tool.name}",
  arguments: ${JSON.stringify(tool.requestSchema, null, 2)}
});
console.log(response);
`;
  };

  const exampleData =
    exampleTab === "arguments"
      ? selectedTool.requestSchema
      : exampleTab === "envelope"
      ? { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: selectedTool.name, arguments: selectedTool.requestSchema } }
      : selectedTool.responseSchema;

  return (
    <div className="space-y-6">
      {/* 1. Header & Reconciler Context Bar */}
      <section className="bg-carbon-nav border border-carbon-border p-4 rounded select-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-carbon-muted mb-1">
              <span>Console</span>
              <span className="text-carbon-border">/</span>
              <span>Developer</span>
              <span className="text-carbon-border">/</span>
              <span className="text-primary font-semibold">Model Context Protocol (MCP) Tool Registry v2.4</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-carbon-text tracking-tight uppercase flex items-center gap-2.5">
              <span>HashX MCP Protocol Suite</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 font-mono font-normal">
                SPEC: 2024-11-05
              </span>
            </h1>
            <p className="text-xs text-carbon-muted font-mono mt-0.5">
              Standardized agent runtime for cryptographic commercial invoicing, RPC delivery witnessing, and HSP settlement.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-carbon-muted">
            <div className="flex items-center gap-1.5 bg-carbon-panel px-2.5 py-1 rounded border border-carbon-border">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-carbon-text">MCP Streamable HTTP: Ready</span>
            </div>
          </div>
        </div>

        {/* Middleware Guarantee Banner */}
        <div className="mt-4 pt-3 border-t border-carbon-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold">MIDDLEWARE GUARANTEE:</span>
            <span className="text-carbon-muted">
              HashX provides the verification, intent binding, and delivery evidence middleware. Financial clearing is executed through HashKey HSP rails. HashX never takes custody of agent funds.
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-carbon-void text-success border border-carbon-border">
              ✓ Non-Custodial
            </span>
            <span className="px-2 py-0.5 rounded bg-carbon-void text-primary border border-carbon-border">
              EIP-712 Schemas
            </span>
            <span className="px-2 py-0.5 rounded bg-carbon-void text-warning border border-carbon-border">
              HashKey HSP Rails
            </span>
          </div>
        </div>
      </section>

      {/* 2. Main 2-Column Workspace: Left Nav Rail + Right Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT NAV RAIL (4 cols / 280px-340px) */}
        <aside className="lg:col-span-4 bg-carbon-nav border border-carbon-border rounded p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-carbon-border text-[11px] font-mono">
            <span className="font-bold text-carbon-muted uppercase tracking-wider">
              REGISTERED MCP TOOLS ({HASHX_TOOLS.length})
            </span>
            <span className="px-1.5 py-0.2 rounded bg-carbon-void text-success border border-carbon-border text-[10px]">
              JSON-RPC 2.0
            </span>
          </div>

          <div className="space-y-4 font-mono">
            {/* Group: Commercial Intent */}
            <div>
              <div className="text-[10px] text-carbon-muted uppercase tracking-wider px-2 py-1 flex justify-between">
                <span>Rail 1: Commercial Intent</span>
                <span className="text-primary font-semibold">EIP-712</span>
              </div>
              <div className="space-y-1 mt-1">
                {HASHX_TOOLS.slice(0, 3).map((tool) => {
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
                        <span className="font-semibold text-carbon-text group-hover:text-primary">
                          {tool.name}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 py-0.2 rounded",
                            tool.mutates
                              ? "bg-warning/15 text-warning border border-warning/30"
                              : "bg-success/15 text-success border border-success/30"
                          )}
                        >
                          {tool.mutates ? "MUTATION" : "READ-ONLY"}
                        </span>
                      </div>
                      <span className="text-[10px] text-carbon-muted truncate mt-0.5">
                        {tool.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group: Delivery Evidence */}
            <div>
              <div className="text-[10px] text-carbon-muted uppercase tracking-wider px-2 py-1 flex justify-between">
                <span>Rail 2: Independent Evidence</span>
                <span className="text-success font-semibold">RPC Witness</span>
              </div>
              <div className="space-y-1 mt-1">
                {HASHX_TOOLS.slice(3, 5).map((tool) => {
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
                        <span className="font-semibold text-carbon-text group-hover:text-primary">
                          {tool.name}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 py-0.2 rounded",
                            tool.mutates
                              ? "bg-warning/15 text-warning border border-warning/30"
                              : "bg-success/15 text-success border border-success/30"
                          )}
                        >
                          {tool.mutates ? "MUTATION" : "READ-ONLY"}
                        </span>
                      </div>
                      <span className="text-[10px] text-carbon-muted truncate mt-0.5">
                        {tool.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group: Settlement & Receipts */}
            <div>
              <div className="text-[10px] text-carbon-muted uppercase tracking-wider px-2 py-1 flex justify-between">
                <span>Rail 3: Settlement &amp; Receipts</span>
                <span className="text-primary font-semibold">HSP Rail</span>
              </div>
              <div className="space-y-1 mt-1">
                {HASHX_TOOLS.slice(5).map((tool) => {
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
                        <span className="font-semibold text-carbon-text group-hover:text-primary">
                          {tool.name}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1 py-0.2 rounded",
                            tool.mutates
                              ? "bg-warning/15 text-warning border border-warning/30"
                              : "bg-success/15 text-success border border-success/30"
                          )}
                        >
                          {tool.mutates ? "MUTATION" : "READ-ONLY"}
                        </span>
                      </div>
                      <span className="text-[10px] text-carbon-muted truncate mt-0.5">
                        {tool.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT TOOL EXPLORER & TERMINAL (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Tool Header Card */}
          <div className="bg-carbon-nav border border-carbon-border rounded p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-carbon-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold text-carbon-text">
                    {selectedTool.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded border",
                      selectedTool.mutates
                        ? "bg-warning/15 text-warning border-warning/40 font-bold"
                        : "bg-success/15 text-success border-success/40 font-bold"
                    )}
                  >
                    {selectedTool.mutates ? "MUTATION (State Change)" : "IDEMPOTENT QUERY"}
                  </span>
                </div>
                <p className="text-xs text-carbon-muted font-mono mt-1">
                  {selectedTool.description}
                </p>
              </div>

              <div className="font-mono text-xs text-carbon-muted">
                Authorization:{" "}
                <span className="text-carbon-text font-semibold">{selectedTool.authorization}</span>
              </div>
            </div>

            {/* HTTP REST equivalent */}
            {selectedTool.httpBinding && (
              <div className="bg-carbon-panel p-2.5 rounded border border-carbon-border flex items-center justify-between text-xs font-mono">
                <span className="text-carbon-muted">HTTP Equivalent:</span>
                <span className="text-primary font-bold">{selectedTool.httpBinding}</span>
              </div>
            )}

            {/* Parameter Specification Table */}
            <div>
              <h3 className="font-mono text-xs font-bold text-carbon-muted uppercase tracking-wider mb-2">
                Schema Parameters ({selectedTool.params.length})
              </h3>
              <div className="border border-carbon-border rounded overflow-hidden">
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
                          {param.required ? (
                            <span className="text-warning font-bold">REQUIRED</span>
                          ) : (
                            <span className="text-carbon-muted">Optional</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-carbon-muted">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Interactive Request / Code Inspector */}
          <div className="bg-carbon-nav border border-carbon-border rounded p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-carbon-border pb-3">
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono">
                {[
                  { id: "arguments" as ExampleTab, label: "Arguments JSON" },
                  { id: "envelope" as ExampleTab, label: "JSON-RPC 2.0" },
                  { id: "response" as ExampleTab, label: "Response Schema" },
                  { id: "python" as ExampleTab, label: "Python (MCP HTTP)" },
                  { id: "typescript" as ExampleTab, label: "TypeScript (MCP SDK)" },
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
                  const text =
                    exampleTab === "python"
                      ? getPythonSnippet(selectedTool)
                      : exampleTab === "typescript"
                      ? getTypescriptSnippet(selectedTool)
                      : JSON.stringify(exampleData, null, 2);
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

            {/* Code Output Viewer */}
            <div>
              {exampleTab === "python" ? (
                <pre className="p-4 rounded bg-carbon-void text-carbon-text font-mono text-xs overflow-x-auto border border-carbon-border">
                  <code>{getPythonSnippet(selectedTool)}</code>
                </pre>
              ) : exampleTab === "typescript" ? (
                <pre className="p-4 rounded bg-carbon-void text-carbon-text font-mono text-xs overflow-x-auto border border-carbon-border">
                  <code>{getTypescriptSnippet(selectedTool)}</code>
                </pre>
              ) : (
                <CodeViewer
                  title={`${selectedTool.name} · ${exampleTab}.json`}
                  data={exampleData}
                  maxHeight="max-h-[380px]"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
