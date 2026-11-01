"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/providers/AppContext";
import { Callout } from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";

const API_URL = process.env.NEXT_PUBLIC_HASHX_API_URL || "http://localhost:8080";

/**
 * In connected mode, pages never fall back to demo fixtures — so when the
 * backend is unreachable they would otherwise render as silently empty.
 * This makes the outage explicit on every route.
 */
export const ConnectionNotice: React.FC = () => {
  const { mode, setMode, refreshKey } = useApp();
  const [status, setStatus] = useState<"unknown" | "up" | "down">("unknown");

  useEffect(() => {
    if (mode !== "connected") return;
    let cancelled = false;
    setStatus("unknown");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    fetch(`${API_URL}/health`, { signal: ctrl.signal })
      .then((res) => !cancelled && setStatus(res.ok ? "up" : "down"))
      .catch(() => !cancelled && setStatus("down"))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [mode, refreshKey]);

  if (mode !== "connected" || status !== "down") return null;

  return (
    <Callout
      tone="danger"
      title="Connected backend unreachable"
      className="mb-6"
      actions={
        <Button variant="secondary" size="sm" onClick={() => setMode("demo")}>
          Switch to demo data
        </Button>
      }
    >
      No response from <span className="font-mono text-foreground-secondary">{API_URL}</span>. Records below are
      not shown until the HashX API is running — demo fixtures are never substituted in connected mode.
    </Callout>
  );
};
