import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

/**
 * HashX 3D Logo Mark: The iridescent violet/purple X insignia.
 */
export const LogoMark: React.FC<LogoMarkProps> = ({ className }) => (
  <img
    src="/logo.png"
    alt="HashX Logo"
    className={cn("w-6 h-6 object-contain shrink-0 select-none", className)}
  />
);

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = "md", href = "/", showTagline = false, className }) => {
  const sizes = {
    sm: { mark: "w-4 h-4", text: "text-[15px]" },
    md: { mark: "w-[18px] h-[18px]", text: "text-[17px]" },
    lg: { mark: "w-6 h-6", text: "text-2xl" },
  };

  const content = (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <LogoMark className={cn("text-foreground", sizes[size].mark)} />
      <span className="flex items-baseline gap-2.5">
        <span className={cn("font-display font-semibold tracking-[-0.03em] text-foreground leading-none", sizes[size].text)}>
          HashX
        </span>
        {showTagline && (
          <span className="hidden sm:inline text-2xs text-foreground-muted border-l border-border pl-2.5 leading-none">
            Trust Layer for Agent Payments
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="HashX home" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        {content}
      </Link>
    );
  }

  return content;
};
