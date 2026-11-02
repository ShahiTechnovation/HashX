import React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const REPO = "https://github.com/ShahiTechnovation/HashX";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Security", href: "#security" },
      { label: "Settlement rails", href: "#rails" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "App",
    links: [
      { label: "Overview", href: "/app" },
      { label: "Trust Inspector", href: "/app/trust" },
      { label: "Proof Lab", href: "/app/demo" },
      { label: "Developer tools", href: "/app/developers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: REPO, external: true },
      { label: "API reference", href: `${REPO}/blob/main/docs/api-contracts.md`, external: true },
      { label: "Documentation", href: `${REPO}/tree/main/docs`, external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="site-container grid gap-12 py-14 md:grid-cols-12 md:py-16">
        <div className="md:col-span-5">
          <Logo size="md" href="/" />
          <p className="mt-4 max-w-[320px] text-[14px] leading-relaxed text-foreground-muted">
            The trust layer for agent payments. Verify the agreement, prove the delivery, authorize the exact terms.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-[13px] font-medium text-foreground">{col.title}</h2>
              <ul className="mt-4 space-y-3 text-[14px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noreferrer" className="text-foreground-muted transition-colors hover:text-foreground">
                        {l.label}
                      </a>
                    ) : l.href.startsWith("#") ? (
                      <a href={l.href} className="text-foreground-muted transition-colors hover:text-foreground">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-foreground-muted transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-container">
        <div className="flex flex-col gap-2 border-t border-border py-6 text-xs text-foreground-muted sm:flex-row sm:justify-between">
          <span>Testnet software. Sepolia test USDC has no monetary value.</span>
          <span>HashKey HSP not connected · Mainnet payments disabled</span>
        </div>
      </div>
    </footer>
  );
}
