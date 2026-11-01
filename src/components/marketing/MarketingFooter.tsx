import React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "./primitives";

type FooterLink = { label: string; href?: string };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/app" },
      { label: "Invoices", href: "/app/invoices" },
      { label: "Trust Inspector", href: "/app/trust" },
      { label: "Approvals", href: "/app/approvals" },
      { label: "Settlements", href: "/app/settlements" },
      { label: "Receipts", href: "/app/receipts" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "MCP tools", href: "/app/developers" },
      { label: "API contracts", href: "/app/developers" },
      { label: "Demo center", href: "/app/demo" },
    ],
  },
  {
    title: "Network",
    links: [{ label: "HashKey Chain" }, { label: "HSP" }, { label: "EIP-712" }],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-y-10 gap-x-6">
          <div className="col-span-2 md:col-span-6">
            <Logo />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-foreground-muted">
              The trust layer for agent payments. Verify the invoice, verify the work, authorize the exact terms, prove the settlement.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <h3 className="text-xs font-medium text-foreground">{col.title}</h3>
              <ul className="mt-3.5 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link href={link.href} className="text-[13px] text-foreground-muted hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-foreground-muted">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-foreground-muted">
          <span>© 2026 HashX</span>
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
            HashKey Chain · <span className="tabular-nums">133 / 177</span>
          </span>
        </div>
      </Container>
    </footer>
  );
}
