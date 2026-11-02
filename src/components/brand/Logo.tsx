import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  /** Rendered pixel size (square). Picks the smallest optimized asset that stays sharp at 2x. */
  size?: number;
  /** Decorative when placed next to the wordmark. */
  decorative?: boolean;
}

/** The HashX 3D violet X mark, served from optimized WebP variants in /public/brand. */
export const LogoMark: React.FC<LogoMarkProps> = ({ className, size = 24, decorative = false }) => {
  const src = size <= 32 ? "/brand/hashx-mark-64.webp" : size <= 64 ? "/brand/hashx-mark-128.webp" : "/brand/hashx-mark-512.webp";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimized static asset with fixed dimensions
    <img
      src={src}
      width={size}
      height={size}
      alt={decorative ? "" : "HashX"}
      aria-hidden={decorative || undefined}
      draggable={false}
      decoding="async"
      className={cn("shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
};

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  showTagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: 20, text: "text-[15px]" },
  md: { mark: 24, text: "text-[17px]" },
  lg: { mark: 30, text: "text-[21px]" },
} as const;

export const Logo: React.FC<LogoProps> = ({ size = "md", href = "/", showTagline = false, className }) => {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <LogoMark size={SIZES[size].mark} decorative />
      <span className="flex items-baseline gap-2.5">
        <span className={cn("font-semibold tracking-[-0.035em] text-foreground leading-none", SIZES[size].text)}>HashX</span>
        {showTagline && (
          <span className="hidden sm:inline text-xs text-foreground-muted border-l border-border pl-2.5 leading-none">
            The Trust Layer for Agent Payments
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="HashX home" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {content}
      </Link>
    );
  }

  return content;
};
