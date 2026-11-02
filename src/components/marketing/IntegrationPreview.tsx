"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

const REPO = "https://github.com/ShahiTechnovation/HashX";

/** Real usage: the official MCP TypeScript SDK against the HashX MCP endpoint (server/src/mcp/server.ts). */
const SNIPPET = `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "buyer-agent", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("https://<your-hashx-backend>/mcp"), {
    // Scoped agent credential, minted by a human wallet session
    requestInit: { headers: { Authorization: "Bearer hx_agent_<secret>" } },
  })
);

// Independently recompute the delivered work from chain RPC
await client.callTool({ name: "verify_delivery", arguments: { invoice_id: "inv_<id>" } });

// Creates the payment obligation only. It does not approve or pay:
// a human completes Stage 1 and Stage 2 in their own wallet.
const res = await client.callTool({ name: "request_payment", arguments: { invoice_id: "inv_<id>" } });
// → { attempt: { state: "AWAITING_SIGNATURE_APPROVAL", … }, humanApprovalRequired: true }`;

const TOOLS = [
  "create_invoice",
  "sign_invoice",
  "verify_invoice",
  "prepare_delivery",
  "submit_delivery",
  "verify_delivery",
  "request_payment",
  "get_payment_status",
  "get_receipt",
];

const KEYWORDS = new Set(["import", "from", "const", "await", "new", "true", "false"]);
const TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b[A-Za-z_]\w*\b)|([{}()[\],.:;])/gm;

/** Tiny, dependency-free TypeScript highlighter for the single example on this page. */
function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    const [tok, comment, str, word] = m;
    let cls = "text-foreground-muted";
    if (comment) cls = "text-foreground-muted italic";
    else if (str) cls = "text-success";
    else if (word) {
      if (KEYWORDS.has(word)) cls = "text-primary-light";
      else if (/^[A-Z]/.test(word)) cls = "text-info";
      else if (code[i + word.length] === "(") cls = "text-warning";
      else cls = "text-foreground";
    }
    out.push(
      <span key={k++} className={cls}>
        {tok}
      </span>
    );
    last = i + tok.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function IntegrationPreview() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable (insecure context) — the code stays selectable */
    }
  };

  return (
    <section id="developers" aria-labelledby="developers-title" className="section-y border-t border-border bg-surface-1">
      <div className="site-container grid gap-12 lg:grid-cols-12 lg:gap-14">
        <Reveal as="header" className="lg:col-span-5">
          <p className="mb-4 text-sm font-medium text-primary-light">Developers</p>
          <h2 id="developers-title" className="text-display-lg font-medium text-foreground text-balance">
            Built for agents. Controlled by humans.
          </h2>
          <p className="mt-5 text-lede text-foreground-secondary text-pretty">
            Agents connect over the Model Context Protocol or the REST API with scoped credentials. They can create invoices,
            deliver work and request payment — but approval always happens in a human&apos;s wallet.
          </p>

          <dl className="mt-10 divide-y divide-border border-y border-border text-[14px]">
            <div className="flex items-baseline justify-between gap-4 py-3.5">
              <dt className="text-foreground-muted">Transport</dt>
              <dd className="text-right text-foreground">MCP Streamable HTTP · REST</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3.5">
              <dt className="text-foreground-muted">Agent auth</dt>
              <dd className="text-right text-foreground">Scoped bearer credentials</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3.5">
              <dt className="text-foreground-muted">Human auth</dt>
              <dd className="text-right text-foreground">Sign-In with Ethereum (EIP-4361)</dd>
            </div>
            <div className="py-3.5">
              <dt className="text-foreground-muted">MCP tools</dt>
              <dd className="mt-2.5 flex flex-wrap gap-1.5">
                {TOOLS.map((t) => (
                  <code key={t} className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground-secondary">
                    {t}
                  </code>
                ))}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-medium">
            <Link href="/app/developers" className="group inline-flex items-center gap-1.5 text-foreground">
              Developer tools
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <a href={`${REPO}/blob/main/docs/api-contracts.md`} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 text-foreground-secondary hover:text-foreground">
              API reference
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </Reveal>

        <Reveal className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+32px)] lg:col-span-7 lg:self-start">
          <div className="surface-ink overflow-hidden rounded-xl border border-border shadow-raised">
            <div className="flex h-11 items-center justify-between border-b border-border pl-4 pr-2">
              <div className="flex items-center gap-2.5 text-[13px]">
                <span className="text-foreground">agent.ts</span>
                <span className="rounded bg-surface-3 px-1.5 py-px font-mono text-[11px] text-foreground-muted">TypeScript</span>
              </div>
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy code"}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-foreground-muted transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="overflow-x-auto px-4 py-5 font-mono text-[12.5px] leading-[1.75] sm:px-5">
              <code>{highlight(SNIPPET)}</code>
            </pre>
            <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-foreground-muted sm:px-5")}>
              <span>Official MCP SDK · placeholders in &lt;…&gt;</span>
              <span>No MCP tool can approve or send a payment</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
