"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { AlertOctagon, RefreshCw } from "lucide-react";

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 rounded-full bg-danger/10 border border-danger/30 text-danger mb-4 shadow-xl">
        <AlertOctagon className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-display font-bold text-foreground">
        Application Processing Exception
      </h2>
      <p className="text-sm font-mono text-foreground-secondary max-w-lg mt-2 mb-6 p-3 rounded-lg bg-surface-2 border border-border text-left break-all">
        {error.message || "An unexpected error occurred while loading this interface."}
      </p>
      <Button variant="primary" onClick={() => reset()} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        <span>Recover State</span>
      </Button>
    </div>
  );
}
