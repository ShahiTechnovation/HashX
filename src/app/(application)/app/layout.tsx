"use client";

import React, { useState } from "react";
import { AppProvider } from "@/providers/AppContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ConnectionNotice } from "@/components/layout/ConnectionNotice";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar className="hidden md:flex" />

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/60 animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex w-64 max-w-[80vw] bg-carbon-nav z-10 animate-fade-in shadow-overlay">
              <Sidebar className="w-full bg-carbon-nav" onCloseMobile={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6 animate-fade-in">
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
