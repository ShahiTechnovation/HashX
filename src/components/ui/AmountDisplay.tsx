import React from "react";
import { cn } from "@/lib/utils";
import { formatMinorToUsd, formatRawTokenUnits } from "@/lib/formatters";

interface AmountDisplayProps {
  amountMinor?: string | number;
  tokenRaw?: string;
  tokenDecimals?: number;
  tokenSymbol?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showRawNotice?: boolean;
  className?: string;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  amountMinor,
  tokenRaw,
  tokenDecimals = 6,
  tokenSymbol = "USDT",
  size = "md",
  showRawNotice = false,
  className,
}) => {
  const usdFormatted = amountMinor !== undefined ? formatMinorToUsd(amountMinor) : null;
  const tokenFormatted = tokenRaw ? formatRawTokenUnits(tokenRaw, tokenDecimals, tokenSymbol) : null;

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base font-medium",
    lg: "text-xl font-semibold",
    xl: "text-3xl font-bold tracking-tight",
  };

  return (
    <div className={cn("inline-flex flex-col", className)}>
      <div className="inline-flex items-baseline gap-1.5">
        <span className={cn("font-mono tabular-nums text-foreground", sizeClasses[size])}>
          {usdFormatted || tokenFormatted}
        </span>
        {usdFormatted && (
          <span className="text-xs font-mono uppercase text-foreground-muted">USD</span>
        )}
      </div>

      {tokenFormatted && usdFormatted && (
        <span className="text-xs font-mono text-foreground-muted">
          ≈ {tokenFormatted}
        </span>
      )}

      {showRawNotice && tokenRaw && (
        <span className="text-[11px] font-mono text-foreground-muted/70 mt-0.5">
          Raw authorized: {tokenRaw} (units)
        </span>
      )}
    </div>
  );
};
