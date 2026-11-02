"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { Address, OperationMode } from "@/types/domain";
import { findNetwork, isPublicNetwork, SEPOLIA_CHAIN_ID } from "@shared/networks";
import { LiveApi } from "@/lib/live/api";
import type { LiveSession } from "@/lib/live/types";
import { getEthereum, signSiwe, switchWalletChain } from "@/lib/live/wallet";

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
  /** Connected mode: authenticated SIWE session for the connected wallet (null until signed in). */
  session: LiveSession | null;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Connected mode API client; always sends the session bearer token. */
  liveApi: LiveApi;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Clearly labelled simulated wallet used only in demo mode.
const DEMO_SIMULATED_WALLET: Address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const SESSION_KEY = "hashx:session";
const INITIAL_MODE: OperationMode = process.env.NEXT_PUBLIC_OPERATION_MODE === "connected" ? "connected" : "demo";

function loadSession(): LiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LiveSession;
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<OperationMode>(INITIAL_MODE);
  const [chainId, setChainId] = useState<number>(INITIAL_MODE === "connected" ? SEPOLIA_CHAIN_ID : 133);
  const [walletAddress, setWalletAddress] = useState<Address | null>(INITIAL_MODE === "demo" ? DEMO_SIMULATED_WALLET : null);
  const [walletType, setWalletType] = useState<WalletType>(INITIAL_MODE === "demo" ? "simulated" : null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  useEffect(() => setSession(loadSession()), []);

  const persistSession = useCallback((s: LiveSession | null) => {
    setSession(s);
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const liveApi = useMemo(
    () =>
      new LiveApi(
        () => {
          const s = loadSession();
          return s?.token ?? null;
        },
        () => persistSession(null)
      ),
    [persistSession]
  );

  // A session is only valid for the wallet that created it.
  useEffect(() => {
    if (session && walletAddress && session.address.toLowerCase() !== walletAddress.toLowerCase()) persistSession(null);
  }, [session, walletAddress, persistSession]);

  // Pending human approvals count (connected mode: real backend data; demo: fixture count of 1).
  useEffect(() => {
    if (mode !== "connected") {
      setPendingApprovalsCount(1);
      return;
    }
    if (!session) {
      setPendingApprovalsCount(0);
      return;
    }
    let cancelled = false;
    liveApi
      .listPayments()
      .then((ps) => {
        if (cancelled) return;
        setPendingApprovalsCount(
          ps.filter(
            (p) => p.payer.toLowerCase() === session.address.toLowerCase() && ["AWAITING_SIGNATURE_APPROVAL", "AWAITING_SUBMISSION_APPROVAL", "AUTHORIZED"].includes(p.state)
          ).length
        );
      })
      .catch(() => !cancelled && setPendingApprovalsCount(0));
    return () => {
      cancelled = true;
    };
  }, [mode, session, liveApi, refreshKey]);

  const isWrongNetwork = mode === "connected" ? !isPublicNetwork(chainId) : !findNetwork(chainId);

  const setMode = useCallback(
    (newMode: OperationMode) => {
      setModeState(newMode);
      setWalletError(null);
      if (newMode === "connected") {
        if (walletType === "simulated") {
          setWalletAddress(null);
          setWalletType(null);
        }
      } else if (!walletAddress) {
        setWalletAddress(DEMO_SIMULATED_WALLET);
        setWalletType("simulated");
      }
    },
    [walletAddress, walletType]
  );

  const switchChain = useCallback(async (target: number) => {
    if (!findNetwork(target)) {
      setWalletError(`Unsupported chain ${target}`);
      return;
    }
    if (!getEthereum()) {
      setChainId(target);
      return;
    }
    try {
      await switchWalletChain(target);
      setChainId(target);
      setWalletError(null);
    } catch (err: any) {
      setWalletError(err?.message || "Failed to switch network");
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setWalletError(null);
    setIsConnecting(true);
    const ethereum = getEthereum();
    if (!ethereum) {
      if (mode === "demo") {
        setWalletAddress(DEMO_SIMULATED_WALLET);
        setWalletType("simulated");
      } else {
        setWalletError("No EIP-1193 wallet detected. Install MetaMask or another browser wallet.");
      }
      setIsConnecting(false);
      return;
    }
    try {
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) throw new Error("No accounts authorized by user");
      setWalletAddress(getAddress(accounts[0]));
      setWalletType("eoa");
      setChainId(parseInt((await ethereum.request({ method: "eth_chainId" })) as string, 16));
    } catch (err: any) {
      setWalletError(err?.message || "Wallet connection rejected");
      if (mode === "connected") {
        setWalletAddress(null);
        setWalletType(null);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [mode]);

  const signIn = useCallback(async () => {
    if (!walletAddress || walletType !== "eoa") {
      setWalletError("Connect a browser wallet before signing in.");
      return;
    }
    setIsSigningIn(true);
    setWalletError(null);
    try {
      const { nonce } = await liveApi.nonce();
      const signInChain = isPublicNetwork(chainId) ? chainId : SEPOLIA_CHAIN_ID;
      const { message, signature } = await signSiwe(walletAddress, nonce, signInChain);
      const res = await liveApi.verifySiwe(message, signature);
      persistSession({ token: res.token, address: res.address, expiresAt: res.expiresAt, counterpartyId: res.counterpartyId, displayName: res.displayName });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setWalletError(err?.message || "Sign-in failed");
    } finally {
      setIsSigningIn(false);
    }
  }, [walletAddress, walletType, chainId, liveApi, persistSession]);

  const signOut = useCallback(async () => {
    try {
      if (session) await liveApi.logout();
    } catch {
      /* session may already be expired */
    }
    persistSession(null);
    setRefreshKey((k) => k + 1);
  }, [session, liveApi, persistSession]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setWalletType(null);
    setWalletError(null);
    persistSession(null);
  }, [persistSession]);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum?.on) return;
    const onAccounts = (accounts: string[]) => {
      if (!accounts?.length) {
        if (mode === "connected") {
          setWalletAddress(null);
          setWalletType(null);
          persistSession(null);
        }
        return;
      }
      try {
        setWalletAddress(getAddress(accounts[0]));
        setWalletType("eoa");
        setWalletError(null);
      } catch {
        setWalletError("Wallet returned an invalid address");
      }
    };
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
      ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [mode, persistSession]);

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
        session,
        isSigningIn,
        signIn,
        signOut,
        liveApi,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
