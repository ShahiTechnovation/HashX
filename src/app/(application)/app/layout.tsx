"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppProvider } from "@/providers/AppContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ConnectionNotice } from "@/components/layout/ConnectionNotice";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation, on Escape, and lock background scroll while open.
  useEffect(() => setMobileMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
        <Sidebar className="hidden lg:flex" />

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="fixed inset-0 animate-fade-in bg-foreground/25" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative z-10 flex w-72 max-w-[85vw] animate-slide-in-left shadow-overlay">
              <Sidebar className="w-full" onCloseMobile={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto print:overflow-visible">
            <div key={pathname} className="mx-auto w-full max-w-[1280px] animate-enter px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-12 lg:px-8 print:max-w-none print:p-0 print:animate-none">
              <ConnectionNotice />
              {children}
            </div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </AppProvider>
  );
}
