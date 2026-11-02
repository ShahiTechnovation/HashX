"use client";

import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestnetBadge } from "@/components/live/common";
import { SEPOLIA_CHAIN_ID } from "@shared/networks";
import { ModeSection, NetworksSection, ReadinessSection, WalletSessionSection } from "./SettingsSections";
import { AgentCredentialsSection } from "./AgentCredentials";

/** Connected-mode settings: real backend status, wallet session, networks, and agent credentials. */
export const LiveSettings: React.FC = () => (
  <div className="max-w-5xl space-y-6">
    <PageHeader
      eyebrow="Settings"
      title="Workspace settings"
      description="Connected to the real HashX backend. Payments execute only on Ethereum Sepolia with Circle test USDC; HashKey HSP is not connected and mainnet payments are disabled."
      badges={<TestnetBadge chainId={SEPOLIA_CHAIN_ID} />}
    />
    <ModeSection />
    <WalletSessionSection />
    <NetworksSection />
    <ReadinessSection />
    <AgentCredentialsSection />
  </div>
);
