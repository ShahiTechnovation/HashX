import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = "md", href = "/", className }) => {
  const content = (
    <div className={cn("inline-flex items-center gap-2.5 group select-none", className)}>
      <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 border border-border group-hover:border-primary-light/50 transition-colors shadow-sm overflow-hidden">
        {/* Subtle violet ambient light */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-primary-light relative z-10 transition-transform group-hover:scale-110"
        >
          <path d="M4 4l16 16" />
          <path d="M4 20l16-16" />
          <circle cx="12" cy="12" r="2.5" fill="#8238E8" stroke="#B78AFF" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold tracking-tight text-foreground text-base">
            Hash<span className="text-primary-light">X</span>
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded bg-surface-3 text-foreground-secondary border border-border">
            Global
          </span>
        </div>
        <span className="text-[10px] text-foreground-muted tracking-tight -mt-0.5">
          Trust Layer
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};
