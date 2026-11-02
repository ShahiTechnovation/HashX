import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small label above the title, e.g. object type ("Invoice", "Payment attempt"). */
  eyebrow?: React.ReactNode;
  /** Inline elements after the title (status badges). */
  badges?: React.ReactNode;
  /** Right-aligned actions. */
  actions?: React.ReactNode;
  /** Meta row under the description (IDs, timestamps). */
  meta?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  badges,
  actions,
  meta,
  back,
  className,
}) => (
  <header className={cn("flex flex-col gap-4 pb-8", className)}>
    {back && (
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 self-start text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {back.label}
      </Link>
    )}
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div className="min-w-0 space-y-2">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.032em] text-foreground leading-[1.1]">
            {title}
          </h1>
          {badges}
        </div>
        {description && <p className="text-[15px] text-foreground-secondary max-w-2xl leading-relaxed">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-foreground-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </header>
);

/** A labeled meta item for PageHeader.meta: "Created  Mar 02, 2026". */
export const MetaItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="text-foreground-muted">{label}</span>
    <span className="text-foreground-secondary">{children}</span>
  </span>
);
