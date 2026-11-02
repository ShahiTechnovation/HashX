"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Developers", href: "#developers" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile menu: focus first link on open, Escape closes and returns focus, lock page scroll.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color] duration-200",
        scrolled || open ? "border-border bg-background/95" : "border-transparent bg-background"
      )}
    >
      <div className="site-container flex h-[var(--header-h)] items-center justify-between gap-6">
        <Logo size="md" href="/" />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[14px] text-foreground-secondary transition-colors duration-150 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/app" className={cn(buttonStyles({ variant: "inverse", size: "sm" }), "group hidden sm:inline-flex")}>
            Launch App
            <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="-mr-1.5 inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-surface-3 md:hidden"
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      <div
        id="site-mobile-nav"
        ref={panelRef}
        hidden={!open}
        className="animate-fade-in border-t border-border bg-background md:hidden"
      >
        <nav aria-label="Mobile" className="site-container flex h-[calc(100dvh-var(--header-h))] flex-col pb-8 pt-4">
          <ul className="divide-y divide-border">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center justify-between text-lg font-medium tracking-[-0.015em] text-foreground"
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Link href="/app" onClick={() => setOpen(false)} className={cn(buttonStyles({ variant: "inverse", size: "lg" }), "mt-auto w-full")}>
            Launch App
          </Link>
        </nav>
      </div>
    </header>
  );
}
