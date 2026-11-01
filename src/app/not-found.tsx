"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="p-4 rounded-full bg-surface-2 border border-border text-primary-light mb-4 shadow-xl">
        <FileQuestion className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-display font-bold text-foreground">
        404 — Record Not Found
      </h1>
      <p className="text-sm text-foreground-secondary max-w-md mt-2 mb-6">
        The requested HashX commercial record, invoice, or verification proof does not exist on this environment.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/app">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Button>
        </Link>
        <Link href="/">
          <Button variant="primary" className="gap-2">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
