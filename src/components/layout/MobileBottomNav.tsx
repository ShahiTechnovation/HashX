"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  ScanSearch,
  FileText,
  KeyRound,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/providers/AppContext";

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { pendingApprovalsCount } = useApp();

  const navItems = [
    { label: "Overview", href: "/app", icon: LayoutGrid },
    { label: "Trust", href: "/app/trust", icon: ScanSearch },
    { label: "Invoices", href: "/app/invoices", icon: FileText },
    {
      label: "Approvals",
      href: "/app/approvals",
      icon: KeyRound,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { label: "Settlement", href: "/app/settlements", icon: ArrowLeftRight },
  ];

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  };

  return (
    <nav
      aria-label="Primary"
      className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 border-t border-border px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none"
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-md transition-colors relative",
              active ? "text-foreground font-medium" : "text-foreground-muted hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon aria-hidden="true" strokeWidth={1.75} className={cn("w-5 h-5", active ? "text-primary" : "text-foreground-muted")} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-warning text-white font-medium text-[10px] tabular-nums flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

