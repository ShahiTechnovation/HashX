"use client";

/**
 * Agent credentials (hx_agent_…) minted by the signed-in human wallet session.
 * The backend stores only a SHA-256 of the secret; it is shown here exactly once.
 * Agent credentials can never perform Stage 1 / Stage 2 approval or report transactions.
 */
import React, { useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";
import { useApp } from "@/providers/AppContext";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyableValue } from "@/components/ui/CopyableValue";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { errorMessage, LiveError, LiveGate, useLiveQuery } from "@/components/live/common";
import { Pill } from "./SettingsSections";

export const AGENT_SCOPES: Array<{ scope: string; description: string }> = [
  { scope: "invoices:read", description: "List and read invoices the owner participates in" },
  { scope: "invoices:write", description: "Create invoices and attach seller signatures" },
  { scope: "deliveries:write", description: "Prepare and submit delivery artifacts" },
  { scope: "verification:run", description: "Run invoice and delivery verification" },
  { scope: "payments:request", description: "Create a payment obligation (a human must still approve)" },
  { scope: "payments:read", description: "Read payment status and receipts" },
];

const CredentialsBody: React.FC = () => {
  const { liveApi } = useApp();
  const { data, error, loading, reload } = useLiveQuery(() => liveApi.listAgentCredentials(), [liveApi]);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<string[]>(["invoices:read", "payments:read"]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ secret: string; label: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const toggle = (s: string) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await liveApi.createAgentCredential(label.trim(), scopes);
      setSecret({ secret: res.secret, label: res.label });
      setLabel("");
      reload();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    setRevokeError(null);
    try {
      await liveApi.revokeAgentCredential(id);
      reload();
    } catch (err) {
      setRevokeError(errorMessage(err));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-5">
      <Callout tone="info" title="Agents can never approve payments">
        Agent credentials authenticate MCP and HTTP calls within their scopes only. Stage 1 term approval, Stage 2 wallet authorization, and
        transaction reporting require your own signed-in wallet session — agent credentials receive <code>403 HUMAN_SESSION_REQUIRED</code>.
      </Callout>

      {secret && (
        <Callout
          tone="warning"
          icon={AlertTriangle}
          title={`Secret for “${secret.label}” — copy it now`}
          actions={
            <Button size="xs" variant="secondary" onClick={() => setSecret(null)}>
              I saved it
            </Button>
          }
        >
          <div className="space-y-1.5">
            <p>This secret is shown exactly once. HashX stores only its SHA-256 hash and cannot show it again.</p>
            <div className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5">
              <CopyableValue value={secret.secret} label="Copy agent secret" />
            </div>
          </div>
        </Callout>
      )}

      <div className="space-y-4 rounded-md border border-border bg-surface-2/40 p-4 sm:p-5">
        <Field label="Label" htmlFor="agent-cred-label" hint="For your reference, e.g. “seller-agent-prod”.">
          <Input id="agent-cred-label" value={label} maxLength={128} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="mb-2 text-[13px] font-medium text-foreground">Scopes</legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            {AGENT_SCOPES.map((s) => (
              <label key={s.scope} className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-primary" checked={scopes.includes(s.scope)} onChange={() => toggle(s.scope)} />
                <span>
                  <code className="font-mono text-xs text-foreground">{s.scope}</code>
                  <span className="mt-0.5 block text-xs leading-relaxed text-foreground-muted">{s.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={create} isLoading={creating} disabled={!label.trim() || scopes.length === 0}>
            <KeyRound className="h-3.5 w-3.5" />
            Create credential
          </Button>
          {createError && <span className="text-xs text-danger">{createError}</span>}
        </div>
      </div>

      {revokeError && <p className="text-xs text-danger">{revokeError}</p>}
      {error ? (
        <LiveError error={error} title="Could not load agent credentials" onRetry={reload} />
      ) : loading && !data ? (
        <div aria-busy="true" className="h-16 rounded-md bg-surface-2" />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No agent credentials" description="Create one above to let an agent call the HashX MCP server on your behalf." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="table-base min-w-[680px]">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Label</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.keyPrefix}…</td>
                  <td>{c.label}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {c.scopes.map((s) => (
                        <code key={s} className="rounded-sm bg-surface-2 px-1.5 py-px font-mono text-2xs text-foreground-secondary ring-1 ring-inset ring-border">
                          {s}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs tabular-nums text-foreground-secondary">{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "Never"}</td>
                  <td>
                    {c.revokedAt ? <Pill tone="neutral">Revoked</Pill> : <Pill tone="success">Active</Pill>}
                  </td>
                  <td className="text-right">
                    {!c.revokedAt && (
                      <Button size="xs" variant="danger" onClick={() => void revoke(c.id)} isLoading={revoking === c.id}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AgentCredentialsSection: React.FC = () => (
  <Panel>
    <PanelHeader title="Agent credentials" description="Scoped bearer tokens (hx_agent_…) for the HashX MCP server and HTTP API." />
    <PanelBody>
      <LiveGate purpose="Only a signed-in human wallet session can mint or revoke agent credentials.">
        <CredentialsBody />
      </LiveGate>
    </PanelBody>
  </Panel>
);
