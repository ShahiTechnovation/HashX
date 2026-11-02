"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAddress } from "viem";
import { Address, OperationMode } from "@/types/domain";

export type WalletType = "eoa" | "simulated" | null;

interface AppContextType {
  mode: OperationMode;
  setMode: (mode: OperationMode) => void;
  chainId: number;
  setChainId: (chainId: number) => void;
  walletAddress: Address | null;
  walletType: WalletType;
  isWalletConnected: boolean;
  isWrongNetwork: boolean;
  isConnecting: boolean;
  walletError: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchChain: (targetChainId: number) => Promise<void>;
  pendingApprovalsCount: number;
  refreshKey: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Deterministic simulated demo wallet for isolated demo mode
const DEMO_SIMULATED_WALLET: Address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<OperationMode>("demo");
  const [chainId, setChainId] = useState<number>(133); // HashKey Chain Testnet default
  const [walletAddress, setWalletAddress] = useState<Address | null>(DEMO_SIMULATED_WALLET);
  const [walletType, setWalletType] = useState<WalletType>("simulated");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);
  const [pendingApprovalsCount] = useState<number>(1);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // When switching between Demo and Connected mode:
  // In Connected Mode, NEVER present a fake wallet! Must start as null unless real EIP-1193 connected.
  const setMode = useCallback((newMode: OperationMode) => {
    setModeState(newMode);
    setWalletError(null);
    if (newMode === "connected") {
      if (walletType === "simulated") {
        setWalletAddress(null);
        setWalletType(null);
      }
    } else if (newMode === "demo") {
      if (!walletAddress) {
        setWalletAddress(DEMO_SIMULATED_WALLET);
        setWalletType("simulated");
      }
    }
  }, [walletAddress, walletType]);

  // EIP-1193 Chain Switching
  const switchChain = useCallback(async (targetChainId: number) => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setChainId(targetChainId);
      setIsWrongNetwork(targetChainId !== 133 && targetChainId !== 177);
      return;
    }

    const ethereum = (window as any).ethereum;
    const hexChainId = `0x${targetChainId.toString(16)}`;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
      setChainId(targetChainId);
      setIsWrongNetwork(false);
      setWalletError(null);
    } catch (switchError: any) {
      // 4902 error code indicates chain has not been added to wallet
      if (switchError.code === 4902 && targetChainId === 133) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x85",
                chainName: "HashKey Chain Testnet",
                nativeCurrency: { name: "HashKey EcoPoints", symbol: "HSK", decimals: 18 },
                rpcUrls: ["https://testnet.hsk.xyz"],
                blockExplorerUrls: ["https://testnet-explorer.hsk.xyz"],
              },
            ],
          });
          setChainId(133);
          setIsWrongNetwork(false);
          setWalletError(null);
        } catch (addError: any) {
          setWalletError(addError.message || "Failed to add HashKey Chain Testnet");
        }
      } else {
        setWalletError(switchError.message || "Failed to switch Ethereum chain");
      }
    }
  }, []);

  // EIP-1193 Wallet Connection
  const connectWallet = useCallback(async () => {
    setWalletError(null);
    setIsConnecting(true);

    if (mode === "demo") {
      // In Demo Mode, if no browser wallet, provide clearly labelled simulated wallet
      if (typeof window === "undefined" || !(window as any).ethereum) {
        setWalletAddress(DEMO_SIMULATED_WALLET);
        setWalletType("simulated");
        setIsConnecting(false);
        return;
      }
    }

    // In Connected Mode (or Demo Mode with browser wallet):
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setWalletError("MetaMask or EIP-1193 compatible wallet not detected. Please install a browser wallet.");
      setIsConnecting(false);
      return;
    }

    const ethereum = (window as any).ethereum;

    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts authorized by user");
      }

      const activeAddress = getAddress(accounts[0]);
      setWalletAddress(activeAddress);
      setWalletType("eoa");

      // Verify chain
      const hexChain = (await ethereum.request({ method: "eth_chainId" })) as string;
      const parsedChain = parseInt(hexChain, 16);
      setChainId(parsedChain);
      setIsWrongNetwork(parsedChain !== 133 && parsedChain !== 177);
    } catch (err: any) {
      console.warn("[AppContext] Wallet connection failed:", err);
      setWalletError(err.message || "Wallet connection rejected");
      if (mode === "connected") {
        setWalletAddress(null);
        setWalletType(null);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [mode]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setWalletType(null);
    setWalletError(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Listen to EIP-1193 account & chain change events
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        if (mode === "connected") {
          setWalletAddress(null);
          setWalletType(null);
        }
      } else {
        try {
          const formatted = getAddress(accounts[0]);
          setWalletAddress(formatted);
          setWalletType("eoa");
          setWalletError(null);
        } catch {
          setWalletAddress(accounts[0] as Address);
          setWalletType("eoa");
        }
      }
    };

    const handleChainChanged = (hexChain: string) => {
      const parsedChain = parseInt(hexChain, 16);
      setChainId(parsedChain);
      setIsWrongNetwork(parsedChain !== 133 && parsedChain !== 177);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [mode]);

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        chainId,
        setChainId,
        walletAddress,
        walletType,
        isWalletConnected: Boolean(walletAddress),
        isWrongNetwork,
        isConnecting,
        walletError,
        connectWallet,
        disconnectWallet,
        switchChain,
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
