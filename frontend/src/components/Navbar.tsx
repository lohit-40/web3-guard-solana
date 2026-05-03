"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cpu, Wallet, Zap } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

export default function Navbar() {
  const pathname = usePathname();
  const { chain, address, isConnected, xlmBalance, connectEVM, connectSolana, connectStellar, disconnect } = useWallet();

  const handleConnect = () => {
    if (chain === "solana") {
      connectSolana();
    } else if (chain === "stellar") {
      connectStellar();
    } else {
      connectEVM();
    }
  };

  const chainLabel = chain === "solana" ? "SOL DEVNET" : chain === "stellar" ? "STELLAR" : "SEPOLIA";
  const chainColor = chain === "solana" ? "#9945FF" : chain === "stellar" ? "#08B5E5" : "#10B981";

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <nav className="fixed top-0 left-0 w-full z-40 px-6 py-6 md:px-12 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 border-2 border-brutal-text bg-brutal-text flex items-center justify-center group-hover:bg-brutal-orange group-hover:border-brutal-orange transition-colors">
            <Cpu className="w-6 h-6 text-brutal-bg" />
          </div>
          <span className="font-bold tracking-[0.2em] text-lg uppercase text-brutal-text hidden md:block group-hover:text-brutal-orange transition-colors">
            web3 | guard
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-2 border-2 border-brutal-text bg-brutal-bg p-1 rounded-none shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
          <Link 
            href="/"
            className={`px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
              pathname === "/" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text hover:bg-brutal-text/5"
            }`}
          >
            audit
          </Link>
          <Link 
            href="/explorer"
            className={`px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
              pathname === "/explorer" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text hover:bg-brutal-text/5"
            }`}
          >
            explorer
          </Link>
          <Link 
            href="/about"
            className={`px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
              pathname === "/about" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text hover:bg-brutal-text/5"
            }`}
          >
            ethos
          </Link>
          <Link 
            href="/dashboard"
            className={`px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
              pathname === "/dashboard" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text hover:bg-brutal-text/5"
            }`}
          >
            agents
          </Link>
          <Link 
            href="/monitor"
            className={`px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
              pathname === "/monitor" ? "bg-brutal-orange text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text hover:bg-brutal-text/5"
            }`}
          >
            monitor
          </Link>
        </div>

        {/* Wallet Connect — Multi-Chain */}
        <div className="pointer-events-auto">
          {isConnected ? (
            <button 
              onClick={() => disconnect()}
              title="Click to disconnect"
              className="px-4 py-3 border-2 text-xs tracking-[0.1em] uppercase font-bold flex items-center gap-3 transition-colors hover:brightness-125"
              style={{
                borderColor: chainColor,
                backgroundColor: `${chainColor}10`,
                color: chainColor,
                boxShadow: `4px 4px 0px 0px ${chainColor}30`,
              }}
            >
              <div className="w-2 h-2 animate-pulse rounded-full" style={{ backgroundColor: chainColor }} />
              <span className="text-[10px] opacity-70">{chainLabel}</span>
              
              {/* XLM Balance Display — L1 requirement */}
              {chain === "stellar" && xlmBalance && (
                <span
                  className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold border"
                  style={{ borderColor: `${chainColor}50`, backgroundColor: `${chainColor}15` }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {xlmBalance} XLM
                </span>
              )}

              <span className="hidden sm:inline">{truncated}</span>
              <span className="sm:hidden">Connected</span>
              <span className="hidden sm:inline-block ml-1 opacity-50 hover:opacity-100 text-[10px] uppercase">X</span>
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="flex items-center gap-3 px-6 py-3 border-2 border-brutal-text bg-brutal-text text-brutal-bg hover:bg-brutal-orange hover:border-brutal-orange text-xs tracking-[0.2em] font-bold transition-all shadow-[4px_4px_0px_0px_rgba(28,28,28,1)] hover:shadow-[4px_4px_0px_0px_rgba(255,69,34,1)]"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </button>
          )}
        </div>

      </div>
    </nav>
  );
}
