"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, FileCode2, ArrowLeft, Sparkles, Link as LinkIcon, Download } from "lucide-react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";

const API_URL = "/api";

interface Vulnerability {
  type: string;
  severity: string;
  line_number: number | null;
  description: string;
  remediation?: string;
}

interface ScanResponse {
  address: string;
  status: string;
  vulnerabilities: Vulnerability[];
  audit_tx_hash?: string;
  hash_key?: string;
  audit_chain?: string;          // "ethereum" | "solana" | "stellar"
  solana_explorer_url?: string;
  stellar_explorer_url?: string;
  soroban_contract_id?: string;  // Stellar: Soroban contract ID
  soroban_proof_id?: number;     // Stellar: sequential proof ID
}

export default function SharedAuditPage() {
  const params = useParams();
  const hash = params.hash as string;
  
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_URL}/report/${hash}`);
        if (!res.ok) {
          throw new Error("Report not found or expired.");
        }
        const data = await res.json();
        setResult(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (hash) fetchReport();
  }, [hash]);

  const getSeverityColor = (severity: string) => {
    switch(severity.toLowerCase()) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-500/30';
      default: return 'text-neutral-400 bg-neutral-800 border-neutral-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-mono">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin" />
          <p className="text-neutral-500 tracking-widest text-sm uppercase">Loading Shared Audit...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-mono">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-red-500/20 rounded-3xl p-8 text-center backdrop-blur-xl">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-xl font-semibold mb-2">Audit Not Found</h2>
          <p className="text-neutral-400 text-sm mb-8">{error}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-semibold tracking-wide hover:bg-neutral-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Go Home
          </Link>
        </div>
      </div>
    );
  }

  const isSecure = result.vulnerabilities.length === 0;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30 font-mono relative overflow-hidden flex flex-col items-center">
      <Toaster />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      <main className="w-full max-w-5xl mx-auto px-6 py-20 z-10 flex-grow relative">
        <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors mb-12 uppercase tracking-widest text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Run New Scan
        </Link>

        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <h1 className="text-4xl md:text-5xl font-light tracking-tighter mb-4">
              Security <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-400 to-neutral-600">Report.</span>
            </h1>
            <div className="flex items-center gap-3">
              <FileCode2 className="w-5 h-5 text-neutral-500" />
              <span className="text-neutral-400 text-sm tracking-widest uppercase">{result.address}</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied!");
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 px-6 py-2.5 rounded-full border border-purple-500/50 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all text-sm tracking-widest uppercase font-semibold"
          >
            <LinkIcon className="w-4 h-4" /> Copy Link
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className={`p-6 rounded-3xl border ${isSecure ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'} backdrop-blur-md flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
            {isSecure ? <ShieldCheck className="w-8 h-8 mb-3" /> : <ShieldAlert className="w-8 h-8 mb-3" />}
            <span className="text-2xl font-light">{isSecure ? 'Secure' : 'Critical'}</span>
            <span className="text-[10px] uppercase tracking-widest mt-1 opacity-70">Status</span>
          </div>
          <div className="p-6 rounded-3xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md flex flex-col items-center justify-center text-center">
            <span className="text-4xl font-light text-white">{result.vulnerabilities.length}</span>
            <span className="text-[10px] uppercase tracking-widest mt-1 text-neutral-500">Alerts Found</span>
          </div>
          {/* On-Chain Proof Card */}
          <div className="col-span-2 p-6 rounded-3xl border border-white/5 bg-[#0a0a0a]/50 backdrop-blur-md flex flex-col justify-center items-start">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">Proof of Audit</span>
              {result.audit_chain && (
                <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
                  result.audit_chain === 'solana'
                    ? 'border-[#9945FF]/50 bg-[#9945FF]/10 text-[#9945FF]'
                    : result.audit_chain === 'stellar'
                    ? 'border-[#08B5E5]/50 bg-[#08B5E5]/10 text-[#08B5E5]'
                    : 'border-green-500/50 bg-green-500/10 text-green-400'
                }`}>
                  {result.audit_chain === 'stellar' ? '🔵 Stellar Testnet'
                   : result.audit_chain === 'solana' ? '🟢 Solana Devnet'
                   : '🔷 Ethereum Sepolia'}
                </span>
              )}
            </div>

            {/* Tx Hash */}
            <span className="text-xs font-light text-neutral-300 truncate font-sans tracking-wide mb-1 block w-full">
              {result.audit_tx_hash || "Not anchored to blockchain"}
            </span>

            {/* Soroban contract details — only for Stellar */}
            {result.audit_chain === 'stellar' && result.soroban_contract_id && (
              <div className="mt-2 mb-3 w-full">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-[#08B5E5]/70">Soroban Contract</span>
                    <span className="text-[10px] text-[#08B5E5] font-mono truncate">{result.soroban_contract_id}</span>
                  </div>
                  {result.soroban_proof_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-[#08B5E5]/70">Proof ID</span>
                      <span className="text-[10px] text-[#08B5E5] font-mono">#{result.soroban_proof_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verify on Chain button */}
            {result.audit_tx_hash && (() => {
              const chain = result.audit_chain;
              const explorerUrl =
                chain === 'solana'
                  ? (result.solana_explorer_url || `https://explorer.solana.com/tx/${result.audit_tx_hash}?cluster=devnet`)
                  : chain === 'stellar'
                  ? (result.stellar_explorer_url || `https://stellar.expert/explorer/testnet/tx/${result.audit_tx_hash}`)
                  : `https://sepolia.etherscan.io/tx/${result.audit_tx_hash}`;
              const label =
                chain === 'solana' ? 'Verify on Solana'
                : chain === 'stellar' ? 'Verify on Stellar Expert'
                : 'Verify on Etherscan';
              const colorClass =
                chain === 'solana'
                  ? 'border-[#9945FF]/50 bg-[#9945FF]/10 text-[#9945FF] hover:bg-[#9945FF]/20'
                  : chain === 'stellar'
                  ? 'border-[#08B5E5]/50 bg-[#08B5E5]/10 text-[#08B5E5] hover:bg-[#08B5E5]/20'
                  : 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20';
              return (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-xs tracking-widest uppercase font-bold ${colorClass}`}
                >
                  <LinkIcon className="w-3 h-3" /> {label}
                </a>
              );
            })()}
          </div>
        </div>

        {/* Vulnerabilities List */}
        <div className="space-y-4 mb-24">
          {result.vulnerabilities.map((v, i) => (
            <div key={i} className={`p-6 md:p-8 rounded-3xl border border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md transition-all`}>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border ${getSeverityColor(v.severity)}`}>
                    {v.severity}
                  </span>
                  <h3 className="text-lg md:text-xl font-medium text-white tracking-tight">{v.type}</h3>
                </div>
                {v.line_number && (
                  <span className="text-xs text-neutral-500 uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/10">
                    Line {v.line_number}
                  </span>
                )}
              </div>
              <p className="text-neutral-400 text-sm md:text-base leading-relaxed mb-6">{v.description}</p>
              
              {v.remediation && (
                <div className="mt-4 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold block mb-3">Remediation Required</span>
                  <p className="text-neutral-300 text-sm leading-relaxed">{v.remediation}</p>
                </div>
              )}
            </div>
          ))}
          
          {isSecure && (
            <div className="p-12 rounded-3xl border border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md text-center flex flex-col items-center">
              <Sparkles className="w-12 h-12 text-yellow-500/50 mb-4" />
              <h3 className="text-2xl font-light text-white mb-2">Zero Vulnerabilities Detected</h3>
              <p className="text-neutral-400">This smart contract passed all heuristic and AI security checks seamlessly.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
