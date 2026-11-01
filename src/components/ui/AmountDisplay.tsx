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
    sm: "text-[13px] font-medium",
    md: "text-[15px] font-medium",
    lg: "text-xl font-semibold tracking-tight",
    xl: "text-[32px] font-semibold tracking-[-0.03em] font-display",
  };

  return (
    <div className={cn("inline-flex flex-col", className)}>
      <div className="inline-flex items-baseline gap-1.5">
        <span className={cn("tabular-nums text-foreground", sizeClasses[size])}>{usdFormatted || tokenFormatted}</span>
        {usdFormatted && <span className="text-2xs font-medium text-foreground-muted">USD</span>}
      </div>

      {tokenFormatted && usdFormatted && (
        <span className="text-2xs tabular-nums text-foreground-muted">≈ {tokenFormatted}</span>
      )}

      {showRawNotice && tokenRaw && (
        <span className="text-2xs font-mono text-foreground-muted mt-0.5">
          raw {tokenRaw} units
        </span>
      )}
    </div>
  );
};
