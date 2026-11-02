import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toneStyles, type Tone } from "./StatusBadge";

interface MetricProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  href?: string;
  className?: string;
}

/**
 * A metric cell designed to sit inside <MetricStrip>, separated by
 * hairlines rather than boxed as an individual card.
 */
export const Metric: React.FC<MetricProps> = ({ label, value, hint, tone, href, className }) => {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
        {tone && tone !== "neutral" && <span className={cn("w-1.5 h-1.5 rounded-full", toneStyles[tone].dot)} />}
        {label}
      </div>
      <div className="mt-2.5 text-[26px] leading-none font-medium tracking-[-0.03em] tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="mt-2 text-2xs text-foreground-muted">{hint}</div>}
    </>
  );

  const cls = cn("block bg-surface-1 px-4 sm:px-5 py-4 sm:py-5", href && "hover:bg-surface-2 transition-colors", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

export const MetricStrip: React.FC<{ children: React.ReactNode; className?: string; cols?: 3 | 4 | 5 }> = ({
  children,
  className,
  cols = 4,
}) => (
  <div
    className={cn(
      "grid grid-cols-2 gap-px rounded-lg border border-border bg-border overflow-hidden shadow-panel",
      cols === 3 && "md:grid-cols-3",
      cols === 4 && "lg:grid-cols-4",
      cols === 5 && "lg:grid-cols-5",
      className
    )}
  >
    {children}
  </div>
);
