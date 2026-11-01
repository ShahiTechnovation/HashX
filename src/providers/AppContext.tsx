"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Address, OperationMode } from "@/types/domain";

interface AppContextType {
  mode: OperationMode;
  setMode: (mode: OperationMode) => void;
  chainId: number;
  setChainId: (chainId: number) => void;
  walletAddress: Address | null;
  isWalletConnected: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  pendingApprovalsCount: number;
  refreshKey: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<OperationMode>("demo");
  const [chainId, setChainId] = useState<number>(133); // HashKey Chain Testnet default
  const [walletAddress, setWalletAddress] = useState<Address | null>(
    "0x1234567890123456789012345678901234567890"
  );
  const [pendingApprovalsCount] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const connectWallet = () => {
    // Demo / mock wallet connection or window.ethereum if available
    setWalletAddress("0x1234567890123456789012345678901234567890");
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
  };

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        chainId,
        setChainId,
        walletAddress,
        isWalletConnected: Boolean(walletAddress),
        connectWallet,
        disconnectWallet,
        pendingApprovalsCount,
        refreshKey,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
