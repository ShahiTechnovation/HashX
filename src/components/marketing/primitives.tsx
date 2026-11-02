"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals its content once, the first time it becomes meaningfully visible.
 * Hidden only under `html.js` (see globals.css), so no-JS clients always see content,
 * and `prefers-reduced-motion` shows it immediately.
 */
export function Reveal({
  as: Tag = "div",
  className,
  children,
  delay = 0,
  ...rest
}: {
  as?: "div" | "section" | "li" | "ol" | "ul" | "header" | "article";
  className?: string;
  children: React.ReactNode;
  /** Small offset (ms) for sequencing siblings. Keep ≤ 160ms. */
  delay?: number;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-revealed", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute("data-revealed", "");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Marketing section heading: optional eyebrow, display title, supporting copy. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  id,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  id?: string;
}) {
  return (
    <Reveal as="header" className={cn(align === "center" && "mx-auto text-center", "max-w-[760px]", className)}>
      {eyebrow && <p className="mb-4 text-sm font-medium text-primary-light">{eyebrow}</p>}
      <h2 id={id} className="text-display-lg font-medium text-foreground text-balance">
        {title}
      </h2>
      {description && (
        <p className={cn("mt-5 text-lede text-foreground-secondary text-pretty", align === "center" ? "mx-auto max-w-[600px]" : "max-w-[580px]")}>
          {description}
        </p>
      )}
    </Reveal>
  );
}

/** Small honesty label for illustrative fixtures shown outside the demo routes. */
export function IllustrativeLabel({ className, children = "Illustrative preview" }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-0.5 text-xs text-foreground-muted", className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-foreground-muted/60" />
      {children}
    </span>
  );
}
