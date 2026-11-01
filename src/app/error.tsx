"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center animate-fade-in">
        <LogoMark className="mx-auto w-7 h-7 text-foreground" />
        <p className="eyebrow mt-8">Something went wrong</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em] text-foreground">
          This view couldn&apos;t be loaded
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground-secondary">
          No records were changed. Invoices, approvals, and settlements are unaffected — try again, or return to the overview.
        </p>

        <div className="mt-6 text-left rounded-md border border-border bg-surface-1 px-3.5 py-3">
          <div className="text-2xs text-foreground-muted">Error</div>
          <p className="mt-1 font-mono text-xs text-foreground-secondary break-words">
            {error.message || "An unexpected error occurred while loading this interface."}
          </p>
          {error.digest && (
            <p className="mt-2 text-2xs text-foreground-muted">
              Reference <span className="font-mono text-foreground-secondary">{error.digest}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="primary" onClick={() => reset()}>
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </Button>
          <Link href="/app" className={buttonStyles({ variant: "secondary" })}>
            Go to overview
          </Link>
        </div>
      </div>
    </main>
  );
}
