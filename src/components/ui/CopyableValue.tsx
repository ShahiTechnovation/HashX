"use client";

import React, { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
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
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 group", className)}>
      <span
        title={value}
        className={cn(
          "text-foreground hover:text-foreground truncate select-all",
          mono && "font-mono text-xs"
        )}
      >
        {displayText || value}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : label}
        className="p-1 rounded text-foreground-muted hover:text-primary-light hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" aria-hidden="true" />
        )}
      </button>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on HashKey Chain Explorer"
          className="p-1 rounded text-foreground-muted hover:text-primary-light hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
