import React from "react";
import { cn } from "@/lib/utils";

/** Max-width content column used by every marketing section. */
export const Container: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)}>{children}</div>
);

/** Section shell: hairline top border + disciplined vertical rhythm. */
export const Section: React.FC<{
  id?: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}> = ({ id, className, containerClassName, children }) => (
  <section id={id} className={cn("relative border-t border-border py-20 sm:py-24 scroll-mt-14", className)}>
    <Container className={containerClassName}>{children}</Container>
  </section>
);

/**
 * Section intro. `layout="split"` puts the headline left and supporting copy
 * right — used to vary rhythm between sections.
 */
export const SectionIntro: React.FC<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  layout?: "stack" | "split";
  className?: string;
  aside?: React.ReactNode;
}> = ({ eyebrow, title, description, layout = "stack", className, aside }) => {
  if (layout === "split") {
    return (
      <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end", className)}>
        <div className="lg:col-span-7">
          {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
          <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.035em] text-foreground text-balance">
            {title}
          </h2>
        </div>
        <div className="lg:col-span-5 lg:pb-1.5">
          {description && <p className="text-[15px] sm:text-base leading-relaxed text-foreground-secondary">{description}</p>}
          {aside}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 className="font-display font-semibold text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.035em] text-foreground text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-foreground-secondary max-w-xl">{description}</p>
      )}
      {aside}
    </div>
  );
};

/** Machine data (hash, ID, raw units). */
export const Mono: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn("font-mono text-2xs tracking-tight text-foreground-secondary", className)}>{children}</span>
);

/** Reason / failure code chip. */
export const Code: React.FC<{ tone?: "danger" | "success" | "warning" | "neutral"; className?: string; children: React.ReactNode }> = ({
  tone = "neutral",
  className,
  children,
}) => (
  <span
    className={cn(
      "inline-flex items-center h-[18px] px-1.5 rounded-[4px] font-mono text-[10px] font-medium ring-1 ring-inset whitespace-nowrap",
      tone === "danger" && "bg-danger/10 text-danger ring-danger/25",
      tone === "success" && "bg-success/10 text-success ring-success/20",
      tone === "warning" && "bg-warning/10 text-warning ring-warning/25",
      tone === "neutral" && "bg-surface-3/70 text-foreground-secondary ring-border-strong/60",
      className
    )}
  >
    {children}
  </span>
);

/** Small square proof-bullet list. */
export const ProofList: React.FC<{ items: React.ReactNode[]; className?: string }> = ({ items, className }) => (
  <ul className={cn("space-y-2", className)}>
    {items.map((item, i) => (
      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground-secondary">
        <span aria-hidden="true" className="mt-[7px] w-1 h-1 shrink-0 bg-foreground-muted" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/** Architectural corner ticks for framing a visual on a grid. */
export const CornerTicks: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
    <span className="absolute -left-px -top-px w-2.5 h-2.5 border-l border-t border-border-strong" />
    <span className="absolute -right-px -top-px w-2.5 h-2.5 border-r border-t border-border-strong" />
    <span className="absolute -left-px -bottom-px w-2.5 h-2.5 border-l border-b border-border-strong" />
    <span className="absolute -right-px -bottom-px w-2.5 h-2.5 border-r border-b border-border-strong" />
  </div>
);

/** Fades a background pattern (bg-grid / bg-dots) out toward the edges. */
export const fadeMask = (shape = "ellipse 70% 60% at 50% 40%"): React.CSSProperties => ({
  maskImage: `radial-gradient(${shape}, black 30%, transparent 100%)`,
  WebkitMaskImage: `radial-gradient(${shape}, black 30%, transparent 100%)`,
});
