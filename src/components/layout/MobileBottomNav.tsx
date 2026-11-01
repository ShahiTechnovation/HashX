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
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-carbon-nav/95 backdrop-blur-md border-t border-carbon-border px-1 py-1.5 flex items-center justify-around select-none"
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 py-1 px-1 rounded transition-colors relative",
              active ? "text-primary font-semibold" : "text-carbon-muted hover:text-carbon-text"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-carbon-muted")} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-warning text-carbon-void font-mono font-bold text-[9px] flex items-center justify-center animate-pulse">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono mt-0.5 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

