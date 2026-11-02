"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeViewerProps {
  data: unknown;
  title?: string;
  language?: string;
  maxHeight?: string;
  className?: string;
  lineNumbers?: boolean;
  actions?: React.ReactNode;
}

const TOKEN_RE =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}[\],])/g;

/** Lightweight JSON tokenizer — keys, strings, numbers, literals, punctuation. */
function highlightJsonLine(line: string, lineKey: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of line.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(line.slice(last, idx));
    const tok = m[0];
    let cls = "text-foreground-secondary";
    if (tok.startsWith('"')) {
      if (m[2]) {
        const key = tok.slice(0, tok.lastIndexOf('"') + 1);
        out.push(
          <span key={`${lineKey}-${i++}`} className="text-primary-light">
            {key}
          </span>
        );
        out.push(<span key={`${lineKey}-${i++}`} className="text-foreground-muted">{tok.slice(key.length)}</span>);
        last = idx + tok.length;
        continue;
      }
      cls = /^"0x[0-9a-fA-F]+"$/.test(tok) ? "text-info" : "text-success/90";
    } else if (/^(true|false|null)$/.test(tok)) {
      cls = "text-warning";
    } else if (/^-?\d/.test(tok)) {
      cls = "text-warning/90";
    } else {
      cls = "text-foreground-muted";
    }
    out.push(
      <span key={`${lineKey}-${i++}`} className={cls}>
        {tok}
      </span>
    );
    last = idx + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  data,
  title,
  language,
  maxHeight = "max-h-96",
  className,
  lineNumbers = true,
  actions,
}) => {
  const [copied, setCopied] = useState(false);
  const isRawString = typeof data === "string";
  const text = isRawString ? (data as string) : JSON.stringify(data, null, 2);
  const lang = language ?? (isRawString ? "text" : "json");

  const lines = useMemo(() => text.split("\n"), [text]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn("surface-ink rounded-lg border border-border overflow-hidden", className)}>
      <div className="flex items-center justify-between h-10 pl-4 pr-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-foreground-secondary truncate">{title || "Document"}</span>
          <span className="text-2xs font-mono text-foreground-muted px-1.5 py-px rounded bg-surface-3/70">
            {lang}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy code"}
            className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-xs text-foreground-muted hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <pre className={cn("py-3.5 overflow-auto font-mono text-[12.5px] leading-[1.7]", maxHeight)}>
        <code className="block min-w-max">
          {lines.map((line, n) => (
            <div key={n} className="flex px-3.5 hover:bg-surface-1/60">
              {lineNumbers && (
                <span className="w-8 shrink-0 select-none pr-4 text-right text-foreground-muted/50 tabular-nums">{n + 1}</span>
              )}
              <span className="text-foreground/85 whitespace-pre">
                {lang === "json" ? highlightJsonLine(line, n) : line}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
};
