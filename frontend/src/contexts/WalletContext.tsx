"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  isConnected as isFreighterConnected,
  isAllowed as isFreighterAllowed,
  requestAccess as requestFreighterAccess,
  getAddress as getFreighterAddress,
} from "@stellar/freighter-api";

type WalletChain = "evm" | "solana" | "stellar";

interface WalletContextType {
  // Current connection state
  chain: WalletChain;
  address: string | null;
  isConnected: boolean;
  xlmBalance: string | null;   // Stellar XLM balance (L1)

  // Connection actions
  connectEVM: () => Promise<void>;
  connectSolana: () => Promise<void>;
  connectStellar: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chain: WalletChain) => Promise<void>;

  // Solana utilities
  solanaConnection: Connection | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

/** Fetch the native XLM balance for a given Stellar public key */
async function fetchXlmBalance(publicKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${HORIZON_TESTNET}/accounts/${publicKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const native = (data.balances as any[]).find((b: any) => b.asset_type === "native");
    return native ? parseFloat(native.balance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : null;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<WalletChain>("evm");
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [stellarAddress, setStellarAddress] = useState<string | null>(null);
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);

  // Solana Devnet connection (lazy init to avoid SSR issues)
  const [solanaConnection, setSolanaConnection] = useState<Connection | null>(null);
  useEffect(() => {
    setSolanaConnection(new Connection(clusterApiUrl("devnet"), "confirmed"));
  }, []);

  // Derived state
  const address = chain === "evm" ? evmAddress : chain === "solana" ? solanaAddress : stellarAddress;
  const isConnected = !!address;

  // Fetch XLM balance whenever stellar address changes
  useEffect(() => {
    if (stellarAddress) {
      fetchXlmBalance(stellarAddress).then(setXlmBalance);
    } else {
      setXlmBalance(null);
    }
  }, [stellarAddress]);

  // ─── EVM (MetaMask) ─────────────────────────
  const connectEVM = useCallback(async () => {
    if (typeof window === "undefined") return;
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("Please install MetaMask to connect an EVM wallet.");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        setEvmAddress(accounts[0]);
        setChain("evm");
      }
    } catch (e) {
      console.error("EVM connect error:", e);
    }
  }, []);

  // Auto-detect existing EVM connection
  useEffect(() => {
    const eth = (window as any)?.ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accts: string[]) => {
      if (accts.length > 0) setEvmAddress(accts[0]);
    }).catch(console.error);

    const handleChange = (accts: string[]) => {
      setEvmAddress(accts.length > 0 ? accts[0] : null);
    };
    eth.on("accountsChanged", handleChange);
    return () => eth.removeListener("accountsChanged", handleChange);
  }, []);

  // ─── Solana (Phantom) ───────────────────────
  const getPhantomSolana = (): any => {
    if (typeof window === "undefined") return null;
    const phantom = (window as any).phantom?.solana;
    if (phantom?.isPhantom) return phantom;
    // Fallback: some versions expose it on window.solana
    const sol = (window as any).solana;
    if (sol?.isPhantom) return sol;
    return null;
  };

  const connectSolana = useCallback(async () => {
    const phantom = getPhantomSolana();
    if (!phantom) {
      alert("Please install Phantom wallet to connect to Solana Devnet.");
      return;
    }
    try {
      const resp = await phantom.connect();
      const pubkey = resp.publicKey.toString();
      setSolanaAddress(pubkey);
      setChain("solana");
    } catch (e) {
      console.error("Solana connect error:", e);
    }
  }, []);

  // Auto-detect existing Solana connection
  useEffect(() => {
    const phantom = getPhantomSolana();
    if (!phantom) return;

    if (phantom.isConnected && phantom.publicKey) {
      setSolanaAddress(phantom.publicKey.toString());
    }

    phantom.on("connect", (pk: PublicKey) => {
      setSolanaAddress(pk.toString());
    });
    phantom.on("disconnect", () => {
      setSolanaAddress(null);
    });
  }, []);

  // ─── Stellar (Freighter) ────────────────────
  const connectStellar = useCallback(async () => {
    try {
      // Step 1: Check if the extension is installed at all
      const connectionStatus = await isFreighterConnected();
      const extensionInstalled =
        typeof connectionStatus === "object"
          ? connectionStatus.isConnected
          : !!connectionStatus;

      if (!extensionInstalled) {
        alert(
          "Freighter wallet not found. Please install the Freighter browser extension from freighter.app"
        );
        return;
      }

      // Step 2: Call requestAccess() — THIS is what opens the popup
      const accessResult = await requestFreighterAccess();
      if (accessResult.error) {
        if (
          accessResult.error.toLowerCase().includes("rejected") ||
          accessResult.error.toLowerCase().includes("denied")
        ) {
          alert("Connection rejected. Please approve in Freighter.");
        } else {
          alert("Freighter access error: " + accessResult.error);
        }
        return;
      }

      // Step 3: Get the connected address
      const pubkey = await getFreighterAddress();
      if (pubkey.error) {
        alert("Error getting address: " + pubkey.error);
        return;
      }

      setStellarAddress(pubkey.address);
      setChain("stellar");
      const bal = await fetchXlmBalance(pubkey.address);
      setXlmBalance(bal);
    } catch (e: any) {
      console.error("Stellar connect error:", e);
      alert("Freighter error: " + (e?.message || String(e)));
    }
  }, []);

  // Auto-detect existing Stellar connection (only if already allowed — no popup)
  useEffect(() => {
    isFreighterAllowed()
      .then((allowed) => {
        // isAllowed returns {isAllowed: boolean} in v6
        const isOk =
          typeof allowed === "object" ? (allowed as any).isAllowed : !!allowed;
        if (!isOk) return;
        getFreighterAddress()
          .then((res) => {
            if (!res.error && res.address) setStellarAddress(res.address);
          })
          .catch(console.error);
      })
      .catch(console.error);
  }, []);

  // ─── Chain Switching ────────────────────────
  const switchChain = useCallback(async (target: WalletChain) => {
    setChain(target);
  }, []);

  const disconnect = useCallback(() => {
    if (chain === "solana") {
      const phantom = getPhantomSolana();
      phantom?.disconnect();
      setSolanaAddress(null);
    } else if (chain === "stellar") {
      setStellarAddress(null);
      setXlmBalance(null);
    }
    setEvmAddress(null);
  }, [chain]);

  return (
    <WalletContext.Provider value={{
      chain,
      address,
      isConnected,
      xlmBalance,
      connectEVM,
      connectSolana,
      connectStellar,
      disconnect,
      switchChain,
      solanaConnection,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
