"use client";

import React, { useState } from "react";
import { Check, Copy, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyableValueProps {
  value: string;
  displayText?: string;
  label?: string;
  explorerUrl?: string;
  className?: string;
  mono?: boolean;
}

export const CopyableValue: React.FC<CopyableValueProps> = ({
  value,
  displayText,
  label = "Copy value",
  explorerUrl,
  className,
  mono = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1 min-w-0 group/copy", className)}>
      <span
        title={value}
        className={cn("text-foreground/90 truncate", mono ? "font-mono text-xs tracking-tight" : "text-[13px]")}
      >
        {displayText || value}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : label}
        className="shrink-0 p-0.5 rounded text-foreground-muted opacity-50 group-hover/copy:opacity-100 hover:text-foreground hover:bg-surface-3 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
      >
        {copied ? (
          <Check className="w-3 h-3 text-success" aria-hidden="true" />
        ) : (
          <Copy className="w-3 h-3" aria-hidden="true" />
        )}
      </button>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on HashKey Chain Explorer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-0.5 rounded text-foreground-muted opacity-50 group-hover/copy:opacity-100 hover:text-foreground hover:bg-surface-3 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
        >
          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </a>
      )}
    </span>
  );
};
