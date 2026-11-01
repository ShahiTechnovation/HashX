import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Container } from "./primitives";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Architecture", href: "#architecture" },
  { label: "Developers", href: "#developers" },
  { label: "Demo", href: "/app/demo" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <Container className="flex h-14 items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <Logo showTagline />
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV.map((item) =>
              item.href.startsWith("#") ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="h-8 inline-flex items-center px-2.5 rounded-md text-[13px] text-foreground-secondary hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="h-8 inline-flex items-center px-2.5 rounded-md text-[13px] text-foreground-secondary hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/demo" className={cn(buttonStyles({ variant: "ghost", size: "sm" }), "md:hidden")}>
            Demo
          </Link>
          <Link href="/app" className={buttonStyles({ variant: "primary", size: "sm" })}>
            Launch app
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </Container>
    </header>
  );
}
