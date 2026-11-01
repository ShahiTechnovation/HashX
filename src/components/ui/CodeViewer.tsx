"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeViewerProps {
  data: unknown;
  title?: string;
  maxHeight?: string;
  className?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  data,
  title,
  maxHeight = "max-h-96",
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const jsonString = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border border-border bg-surface-1 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-surface-2/60">
        <span className="text-xs font-mono text-foreground-secondary">{title || "JSON Document"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono text-foreground-muted hover:text-foreground hover:bg-surface-3 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <pre
        className={cn(
          "p-4 overflow-x-auto overflow-y-auto font-mono text-xs text-foreground/90 leading-relaxed scrollbar-thin",
          maxHeight
        )}
      >
        <code>{jsonString}</code>
      </pre>
    </div>
  );
};
