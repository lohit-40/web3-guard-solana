"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Award, Activity, ExternalLink, Search, Cpu, Hash, Clock, User, AlertTriangle } from "lucide-react";

// Direct backend URL — bypasses broken /api Next.js proxy (returns 404 on Vercel)
const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "https://web3-guard-solana-173382554287.europe-west1.run.app";

interface AuditRecord {
  id: number | string;
  audited_contract: string;
  report_hash: string;
  timestamp: number;
  audit_chain?: string;
  explorer_url?: string;
}

interface BadgeRecord {
  token_id: number;
  owner: string;
  contract_audited: string;
  vulns_found: number;
  severity: string;
  timestamp: number;
}

interface Stats {
  total_audits: number;
  total_badges: number;
  contract_audit_address: string;
  contract_badge_address: string;
  chain: string;
  rpc_connected: boolean;
}

export default function ExplorerPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"audits" | "badges" | "agent_activity">("audits");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, auditsRes, badgesRes, liveRes, eventsRes] = await Promise.all([
          fetch(`${BACKEND}/explorer/stats`, { cache: 'no-store' }),
          fetch(`${BACKEND}/explorer/audits`, { cache: 'no-store' }),
          fetch(`${BACKEND}/explorer/badges`, { cache: 'no-store' }),
          fetch(`${BACKEND}/metrics/live`, { cache: 'no-store' }),
          fetch(`${BACKEND}/monitor/events`, { cache: 'no-store' })
        ]);
        if (statsRes.ok) {
          const explorerData = await statsRes.json();
          const liveData = liveRes.ok ? await liveRes.json() : {};
          // Always use the max of both sources so Explorer matches Dashboard
          setStats({
            ...explorerData,
            total_audits: Math.max(explorerData.total_audits || 0, liveData.total_audits || 0)
          });
        }
        if (auditsRes.ok) {
          const data = await auditsRes.json();
          setAudits(data.audits || []);
        }
        if (badgesRes.ok) {
          const data = await badgesRes.json();
          setBadges(data.badges || []);
        }
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error("Explorer fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);


  const formatTime = (ts: number) => {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const truncAddr = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  const severityColor = (sev: string) => {
    switch (sev) {
      case "SECURE": return "text-[#10B981] border-[#10B981]";
      case "HIGH": return "text-[#FF4522] border-[#FF4522]";
      case "MEDIUM": return "text-amber-500 border-amber-500";
      default: return "text-blue-500 border-blue-500";
    }
  };

  const filteredAudits = audits.filter(a =>
    a.audited_contract.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.report_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBadges = badges.filter(b =>
    b.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.contract_audited.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvents = events.filter(e =>
    e.agent_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.solana_proof_tx?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgentIcon = (type: string) => {
    if (type?.toLowerCase() === 'scout') return '🤖';
    if (type?.toLowerCase() === 'analyst') return '🔬';
    if (type?.toLowerCase() === 'reporter') return '📡';
    if (type?.toLowerCase() === 'defender') return '🛡️';
    return '⚡';
  };

  return (
    <main className="relative min-h-screen w-full">
      <div className="relative z-10 w-full min-h-screen flex flex-col px-6 md:px-24 pt-32 pb-20">
        <div className="max-w-6xl w-full mx-auto">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-20"
          >
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-brutal-orange" />
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-brutal-text/60">live on-chain data</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-brutal-text lowercase leading-[0.9]">
              block <br /> explorer *
            </h1>
            <p className="mt-6 text-lg text-brutal-text/60 max-w-xl font-medium">
              Real-time verification portal. Every audit and security badge ever recorded on the Ethereum, Solana, and Stellar blockchains by Web3 Guard.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
          >
            <div className="border-2 border-brutal-text p-6 group hover:bg-brutal-text hover:text-brutal-bg transition-all">
              <ShieldCheck className="w-6 h-6 mb-3 text-brutal-orange group-hover:text-brutal-bg" />
              <p className="text-4xl md:text-5xl font-bold font-mono">{(stats?.total_audits || 0)}</p>
              <p className="text-xs tracking-[0.2em] uppercase mt-2 opacity-60">audits recorded</p>
            </div>
            <div className="border-2 border-brutal-text p-6 group hover:bg-brutal-text hover:text-brutal-bg transition-all">
              <Award className="w-6 h-6 mb-3 text-purple-500 group-hover:text-brutal-bg" />
              <p className="text-4xl md:text-5xl font-bold font-mono">{stats?.total_badges ?? "—"}</p>
              <p className="text-xs tracking-[0.2em] uppercase mt-2 opacity-60">badges minted</p>
            </div>
            <div className="border-2 border-brutal-text p-6 group hover:bg-brutal-text hover:text-brutal-bg transition-all">
              <Cpu className="w-6 h-6 mb-3 text-[#10B981] group-hover:text-brutal-bg" />
              <p className="text-lg font-bold font-mono mt-2">Omni-Chain</p>
              <p className="text-xs tracking-[0.2em] uppercase mt-2 opacity-60">network</p>
            </div>
            <div className="border-2 border-brutal-text p-6 group hover:bg-brutal-text hover:text-brutal-bg transition-all">
              <Activity className="w-6 h-6 mb-3 group-hover:text-brutal-bg" />
              <div className={`flex items-center gap-2 mt-2 ${stats?.rpc_connected ? 'text-[#10B981]' : 'text-red-500'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${stats?.rpc_connected ? 'bg-[#10B981] animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-bold uppercase">{stats?.rpc_connected ? "Live" : "Offline"}</span>
              </div>
              <p className="text-xs tracking-[0.2em] uppercase mt-2 opacity-60">rpc status</p>
            </div>
          </motion.div>

          {/* Contract Links */}
          {stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-4 mb-12"
            >
              {stats.contract_audit_address && (
                <a href={`https://sepolia.etherscan.io/address/${stats.contract_audit_address}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-brutal-text/20 text-brutal-text/60 hover:text-brutal-text hover:border-brutal-text transition-all text-xs tracking-wider font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ProofOfAudit: {truncAddr(stats.contract_audit_address)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {stats.contract_badge_address && (
                <a href={`https://sepolia.etherscan.io/address/${stats.contract_badge_address}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-purple-500/30 text-purple-500/70 hover:text-purple-500 hover:border-purple-500 transition-all text-xs tracking-wider font-mono">
                  <Award className="w-3.5 h-3.5" />
                  AuditBadgeNFT: {truncAddr(stats.contract_badge_address)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

          {/* Search Bar */}
          <div className="relative mb-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brutal-text/30" />
            <input
              type="text"
              placeholder="Search by address, hash, or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-2 border-brutal-text/20 focus:border-brutal-orange pl-12 pr-4 py-4 outline-none text-lg tracking-tight text-brutal-text placeholder:text-brutal-text/30 transition-colors font-mono"
            />
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-0 mb-10 border-2 border-brutal-text w-max">
            <button
              onClick={() => setActiveTab("audits")}
              className={`px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold transition-all ${
                activeTab === "audits" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text"
              }`}
            >
              <ShieldCheck className="w-4 h-4 inline mr-2" />
              audit records
            </button>
            <button
              onClick={() => setActiveTab("badges")}
              className={`px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold transition-all border-l-2 border-brutal-text ${
                activeTab === "badges" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text"
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              nft badges
            </button>
            <button
              onClick={() => setActiveTab("agent_activity")}
              className={`px-8 py-3 text-xs uppercase tracking-[0.2em] font-bold transition-all border-l-2 border-brutal-text ${
                activeTab === "agent_activity" ? "bg-brutal-text text-brutal-bg" : "text-brutal-text/60 hover:text-brutal-text"
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              agent activity
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-8 h-8 border-3 border-brutal-text border-t-transparent rounded-full"
              />
            </div>
          )}

          {/* Audits Tab */}
          {!loading && activeTab === "audits" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {filteredAudits.length === 0 ? (
                <div className="border-2 border-brutal-text/20 p-12 text-center">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-brutal-text/20" />
                  <p className="text-brutal-text/40 text-sm uppercase tracking-widest font-bold">No audit records found</p>
                </div>
              ) : (
                filteredAudits.map((audit, idx) => {
                  const isSolana = audit.audit_chain === "solana";
                  const isStellar = audit.audit_chain === "stellar";
                  
                  let borderColorClass = "border-brutal-text/20 hover:border-brutal-text";
                  let idColorClass = "border-brutal-orange text-brutal-orange";
                  let hoverIdColorClass = "group-hover:border-brutal-bg group-hover:text-brutal-bg";
                  let iconColorClass = "group-hover:text-brutal-bg hover:opacity-70 text-brutal-orange";
                  
                  if (isSolana) {
                    borderColorClass = "border-[#14F195]/30 hover:border-[#14F195]";
                    idColorClass = "border-[#9945FF] text-[#9945FF]";
                    hoverIdColorClass = "group-hover:border-[#14F195] group-hover:text-[#14F195]";
                    iconColorClass = "group-hover:text-[#14F195] hover:opacity-70 text-[#9945FF]";
                  } else if (isStellar) {
                    borderColorClass = "border-[#08B5E5]/30 hover:border-[#08B5E5]";
                    idColorClass = "border-[#08B5E5] text-[#08B5E5]";
                    hoverIdColorClass = "group-hover:border-[#fff] group-hover:text-black";
                    iconColorClass = "group-hover:text-[#fff] hover:opacity-70 text-[#08B5E5]";
                  }

                  const explorerLink = audit.explorer_url 
                    ? audit.explorer_url 
                    : `https://sepolia.etherscan.io/address/${stats?.contract_audit_address}`;
                    
                  // Navigate to detailed audit report page on click
                  const reportHash = audit.report_hash.replace(/^0x/, "");
                  return (
                    <motion.div
                      key={audit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`border-2 ${borderColorClass} p-6 group transition-all hover:bg-brutal-text hover:text-brutal-bg cursor-pointer`}
                      onClick={() => window.open(`/audit/${reportHash}`, '_blank')}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 border-2 ${idColorClass} flex items-center justify-center font-bold font-mono text-sm ${hoverIdColorClass}`}>
                            #{audit.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-3.5 h-3.5 opacity-50" />
                              <span className="font-mono text-xs">{truncAddr(audit.audited_contract)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs mt-1 opacity-50">
                              <Hash className="w-3 h-3" />
                              <span className="font-mono">{audit.report_hash.slice(0, 18)}...</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Chain badge with icon */}
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                            isStellar ? 'border-[#08B5E5]/50 bg-[#08B5E5]/10 text-[#08B5E5]'
                            : isSolana ? 'border-[#9945FF]/50 bg-[#9945FF]/10 text-[#9945FF]'
                            : 'border-green-500/50 bg-green-500/10 text-green-400'
                          }`}>
                            {isStellar ? '🔵' : isSolana ? '🟢' : '🔷'}
                            {isStellar ? 'Stellar' : isSolana ? 'Solana' : 'Ethereum'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs opacity-60">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(audit.timestamp)}</span>
                          </div>
                          {/* External explorer link */}
                          <a
                            href={explorerLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={iconColorClass}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                      {/* Click hint */}
                      <div className="mt-3 text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-40 transition-opacity">
                        Click to view full audit report →
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Badges Tab */}
          {!loading && activeTab === "badges" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBadges.length === 0 ? (
                <div className="col-span-2 border-2 border-purple-500/20 p-12 text-center">
                  <Award className="w-12 h-12 mx-auto mb-4 text-purple-500/20" />
                  <p className="text-brutal-text/40 text-sm uppercase tracking-widest font-bold">No badges minted yet</p>
                </div>
              ) : (
                filteredBadges.map((badge, idx) => (
                  <motion.div
                    key={badge.token_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="border-2 border-purple-500/30 hover:border-purple-500 p-6 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center">
                          <Award className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-bold text-lg font-mono">Badge #{badge.token_id}</p>
                          <p className="text-xs text-brutal-text/50 font-mono">{truncAddr(badge.owner)}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border ${severityColor(badge.severity)}`}>
                        {badge.severity}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs">
                      <div>
                        <span className="uppercase tracking-widest text-brutal-text/40">Audited</span>
                        <p className="font-mono mt-1">{truncAddr(badge.contract_audited)}</p>
                      </div>
                      <div>
                        <span className="uppercase tracking-widest text-brutal-text/40">Vulns</span>
                        <p className="font-mono mt-1 text-2xl font-bold">{badge.vulns_found}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-brutal-text/10 text-xs text-brutal-text/40">
                      <Clock className="w-3 h-3" />
                      {formatTime(badge.timestamp)}
                      <a
                        href={`https://sepolia.etherscan.io/nft/${stats?.contract_badge_address}/${badge.token_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-purple-500 hover:text-purple-400 flex items-center gap-1"
                      >
                        View NFT <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* Agent Activity Tab */}
          {!loading && activeTab === "agent_activity" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="border-2 border-brutal-text/20 p-12 text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-brutal-text/20" />
                  <p className="text-brutal-text/40 text-sm uppercase tracking-widest font-bold">No agent activity found</p>
                </div>
              ) : (
                <div className="border-2 border-brutal-text divide-y divide-brutal-text/10 bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
                  {filteredEvents.map((ev, idx) => (
                    <motion.div
                      key={ev.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="px-6 py-5 flex items-start gap-4 hover:bg-brutal-text/5 transition-colors"
                    >
                      <div className="text-3xl mt-1">{getAgentIcon(ev.agent_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                          <span className="font-bold text-sm uppercase tracking-[0.2em]">{ev.agent_type}</span>
                          <span className="text-xs opacity-50 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {ev.time}
                          </span>
                        </div>
                        <p className="font-mono text-sm opacity-80 mb-3">{ev.details}</p>
                        {ev.solana_proof_tx && (
                          <div className="flex items-center">
                            <a 
                              href={`https://explorer.solana.com/tx/${ev.solana_proof_tx}?cluster=devnet`} 
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brutal-orange text-xs text-brutal-orange uppercase tracking-widest font-bold hover:bg-brutal-orange hover:text-white transition-all"
                            >
                              ⛓️ Proof Anchored <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>
    </main>
  );
}
