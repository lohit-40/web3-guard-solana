"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ShieldAlert, Plus, Trash2, Pause, RefreshCw, ExternalLink, Radio, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface WatchlistEntry {
  id: number;
  contract_address: string;
  risk_level: string;
  owner_wallet?: string;
  telegram_chat_id?: string;
  discord_webhook?: string;
  last_scanned?: string;
  source_code?: string;
}

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#DC2626", HIGH: "#EA580C", MEDIUM: "#D97706",
  LOW: "#16A34A", SAFE: "#16A34A", UNKNOWN: "#6B7280", PENDING: "#9945FF",
};

const RISK_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE", "UNKNOWN", "PENDING"];

export default function MonitorPage() {
  const [watchlist, setWatchlist]   = useState<WatchlistEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState({
    contract_address:  "",
    owner_wallet:      "",
    telegram_chat_id:  "",
    discord_webhook:   "",
    source_code:       "",
    risk_level:        "PENDING",
  });

  const BASE = "/api";

  const fetchWatchlist = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${BASE}/watchlist`, { cache: 'no-store' });
      const d = await r.json();
      const sorted = (d ?? []).sort(
        (a: WatchlistEntry, b: WatchlistEntry) =>
          RISK_ORDER.indexOf(a.risk_level ?? "UNKNOWN") -
          RISK_ORDER.indexOf(b.risk_level ?? "UNKNOWN")
      );
      setWatchlist(sorted);
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contract_address.trim()) return;
    await fetch(`${BASE}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, added_by: form.owner_wallet || "Dashboard" }),
    });
    setShowAdd(false);
    setForm({
      contract_address: "", owner_wallet: "", telegram_chat_id: "",
      discord_webhook: "", source_code: "", risk_level: "PENDING",
    });
    await fetchWatchlist();
  };

  const handleDelete = async (programId: string) => {
    await fetch(`${BASE}/watchlist/${encodeURIComponent(programId)}`, { method: "DELETE" });
    setWatchlist((prev) => prev.filter((w) => w.contract_address !== programId));
  };

  const handlePause = async (programId: string) => {
    setPauseLoading(programId);
    try {
      const r = await fetch(`${BASE}/monitor/pause/${encodeURIComponent(programId)}`, { method: "POST" });
      const d = await r.json();
      alert(d.status ?? "Pause proposal sent to Telegram.");
    } finally {
      setPauseLoading(null);
    }
  };

  const toggleExpand = (programId: string) => {
    setExpandedRow((prev) => (prev === programId ? null : programId));
  };

  return (
    <div
      className="min-h-screen pt-32 pb-24 px-4 md:px-12 pointer-events-auto"
      style={{ backgroundColor: "#F2F0EB" }}
    >
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-[0.15em] uppercase text-brutal-text mb-2">
              Monitor <span className="text-brutal-orange">Watchlist</span>
            </h1>
            <p className="font-mono text-sm uppercase tracking-widest text-brutal-text/60">
              Register Solana Programs for 24/7 Autonomous Security Monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWatchlist}
              className="p-3 border-2 border-brutal-text hover:bg-brutal-text hover:text-brutal-bg transition-all shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-6 py-3 bg-brutal-text text-brutal-bg border-2 border-brutal-text font-bold uppercase tracking-widest text-xs hover:bg-brutal-orange hover:border-brutal-orange transition-all shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]"
            >
              <Plus className="w-4 h-4" /> Add Program
            </button>
          </div>
        </header>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Watched",  value: watchlist.length },
            { label: "Critical / High", value: watchlist.filter((w) => ["CRITICAL","HIGH"].includes(w.risk_level ?? "")).length },
            { label: "Safe / Low",      value: watchlist.filter((w) => ["SAFE","LOW"].includes(w.risk_level ?? "")).length },
          ].map(({ label, value }) => (
            <div key={label} className="border-4 border-brutal-text p-4 bg-white shadow-[6px_6px_0px_0px_rgba(28,28,28,1)]">
              <div className="text-4xl font-black">{value}</div>
              <div className="font-mono text-xs uppercase opacity-50 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border-4 border-brutal-orange bg-white shadow-[10px_10px_0px_0px_rgba(255,69,34,1)]"
            >
              <div className="bg-brutal-orange p-4 text-brutal-bg flex items-center justify-between">
                <span className="font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Program to Watchlist
                </span>
                <button onClick={() => setShowAdd(false)} className="text-brutal-bg/70 hover:text-brutal-bg font-bold text-lg leading-none">×</button>
              </div>
              <form onSubmit={handleAdd} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-mono text-xs font-bold uppercase tracking-widest mb-1">
                    Program ID / Address *
                  </label>
                  <input
                    required
                    value={form.contract_address}
                    onChange={(e) => setForm({ ...form, contract_address: e.target.value })}
                    placeholder="e.g. 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
                    className="w-full border-2 border-brutal-text p-3 font-mono text-sm bg-transparent outline-none focus:border-brutal-orange placeholder:opacity-30"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-widest mb-1">
                    Owner Wallet (optional)
                  </label>
                  <input
                    value={form.owner_wallet}
                    onChange={(e) => setForm({ ...form, owner_wallet: e.target.value })}
                    placeholder="Your wallet pubkey"
                    className="w-full border-2 border-brutal-text p-3 font-mono text-sm bg-transparent outline-none focus:border-brutal-orange placeholder:opacity-30"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-widest mb-1">
                    Telegram Chat ID (for alerts)
                  </label>
                  <input
                    value={form.telegram_chat_id}
                    onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                    placeholder="e.g. -1001234567890"
                    className="w-full border-2 border-brutal-text p-3 font-mono text-sm bg-transparent outline-none focus:border-brutal-orange placeholder:opacity-30"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-mono text-xs font-bold uppercase tracking-widest mb-1">
                    Discord Webhook URL (optional)
                  </label>
                  <input
                    value={form.discord_webhook}
                    onChange={(e) => setForm({ ...form, discord_webhook: e.target.value })}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full border-2 border-brutal-text p-3 font-mono text-sm bg-transparent outline-none focus:border-brutal-orange placeholder:opacity-30"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-mono text-xs font-bold uppercase tracking-widest mb-1">
                    Rust Source Code (paste for AI analysis)
                  </label>
                  <textarea
                    rows={6}
                    value={form.source_code}
                    onChange={(e) => setForm({ ...form, source_code: e.target.value })}
                    placeholder="use anchor_lang::prelude::*;&#10;..."
                    className="w-full border-2 border-brutal-text p-3 font-mono text-xs bg-transparent outline-none focus:border-brutal-orange placeholder:opacity-30 resize-none"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-6 py-3 border-2 border-brutal-text font-bold uppercase tracking-widest text-xs hover:bg-brutal-text/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-brutal-text text-brutal-bg border-2 border-brutal-text font-bold uppercase tracking-widest text-xs hover:bg-brutal-orange hover:border-brutal-orange transition-all shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]"
                  >
                    Add to Watchlist
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watchlist Table */}
        <div className="border-4 border-brutal-text bg-white shadow-[10px_10px_0px_0px_rgba(28,28,28,1)] overflow-hidden">
          <div className="bg-brutal-text p-4 text-brutal-bg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-bold uppercase tracking-[0.2em]">Active Monitoring Programs</span>
          </div>

          {loading ? (
            <div className="p-10 text-center font-mono text-sm opacity-40 uppercase">
              <Radio className="w-8 h-8 mx-auto mb-3 animate-pulse" />
              Fetching watchlist…
            </div>
          ) : watchlist.length === 0 ? (
            <div className="p-10 text-center font-mono text-sm opacity-40 uppercase">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No programs on watchlist yet.
              <br />
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 text-brutal-orange underline font-bold text-xs"
              >
                + Add your first program
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b-2 border-brutal-text/20">
                    {["Program ID", "Risk Level", "Telegram", "Last Scanned", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs uppercase tracking-widest font-bold opacity-50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {watchlist.map((w) => (
                      <React.Fragment key={w.id}>
                      <motion.tr
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="border-b border-brutal-text/10 hover:bg-brutal-text/5 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(w.contract_address)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">
                              {w.contract_address.slice(0, 8)}…{w.contract_address.slice(-6)}
                            </span>
                            <a
                              href={`https://explorer.solana.com/address/${w.contract_address}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brutal-orange opacity-60 hover:opacity-100"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          {w.owner_wallet && (
                            <p className="text-[10px] opacity-40 mt-0.5">
                              Owner: {w.owner_wallet.slice(0, 8)}…
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2"
                            style={{
                              borderColor: RISK_COLOR[w.risk_level ?? "UNKNOWN"],
                              color: RISK_COLOR[w.risk_level ?? "UNKNOWN"],
                              backgroundColor: `${RISK_COLOR[w.risk_level ?? "UNKNOWN"]}12`,
                            }}
                          >
                            {w.risk_level ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs opacity-60">
                          {w.telegram_chat_id ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Configured
                            </span>
                          ) : (
                            <span className="opacity-30">Not set</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs opacity-50">
                          {w.last_scanned
                            ? new Date(w.last_scanned).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handlePause(w.contract_address)}
                              disabled={pauseLoading === w.contract_address}
                              title="Trigger Defender Agent pause proposal"
                              className="p-1.5 border-2 border-brutal-orange text-brutal-orange hover:bg-brutal-orange hover:text-white transition-all disabled:opacity-40"
                            >
                              {pauseLoading === w.contract_address ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Pause className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(w.contract_address)}
                              title="Remove from watchlist"
                              className="p-1.5 border-2 border-brutal-text/30 text-brutal-text/40 hover:border-red-500 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => toggleExpand(w.contract_address)}
                              className="p-1.5 ml-2 border-2 border-transparent hover:border-brutal-text/20 transition-all"
                            >
                              {expandedRow === w.contract_address ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      {expandedRow === w.contract_address && (
                        <tr className="bg-brutal-text/5 border-b border-brutal-text/20">
                          <td colSpan={5} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-6">
                                <RiskTimelineChart programId={w.contract_address} base={BASE} />
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Feed Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <AgentFeed base={BASE} />
          <ThreatFeed base={BASE} />
        </div>

      </div>
    </div>
  );
}

function ThreatFeed({ base }: { base: string }) {
  const [feed, setFeed] = useState<{ vuln_type: string; severity: string; detected_in: string; created_at: string }[]>([]);

  useEffect(() => {
    fetch(`${base}/threat-feed`)
      .then((r) => r.json())
      .then((d) => setFeed(d.feed ?? []))
      .catch(() => {});
  }, [base]);

  if (feed.length === 0) return null;

  return (
    <div className="border-4 border-brutal-text bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] flex flex-col h-full">
      <div className="bg-brutal-text p-4 text-brutal-bg font-bold uppercase tracking-[0.2em] text-sm">
        🌐 Cross-Protocol Threat Intelligence
      </div>
      <div className="divide-y divide-brutal-text/10 flex-1 overflow-y-auto max-h-[400px]">
        {feed.slice(0, 8).map((item, i) => (
          <div key={i} className="px-5 py-3 flex items-center gap-4">
            <span
              className="px-2 py-0.5 text-[10px] font-bold uppercase border-2 font-mono flex-shrink-0"
              style={{
                borderColor: RISK_COLOR[item.severity ?? "MEDIUM"],
                color: RISK_COLOR[item.severity ?? "MEDIUM"],
              }}
            >
              {item.severity}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-bold truncate">{item.vuln_type}</p>
              <p className="font-mono text-[10px] opacity-40">
                Detected in: {item.detected_in?.slice(0, 8)}… · {item.created_at}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentFeed({ base }: { base: string }) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${base}/monitor/events`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {});
    
    const interval = setInterval(() => {
      fetch(`${base}/monitor/events`)
        .then((r) => r.json())
        .then((d) => setEvents(d.events ?? []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [base]);

  if (events.length === 0) return (
    <div className="border-4 border-brutal-text bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] flex flex-col h-full min-h-[300px]">
       <div className="bg-brutal-text p-4 text-brutal-bg font-bold uppercase tracking-[0.2em] text-sm flex items-center gap-2">
         <Activity className="w-4 h-4" /> Live Agent Feed
       </div>
       <div className="flex-1 flex items-center justify-center text-sm font-mono opacity-50 p-10 text-center">
         Waiting for agent activity...
       </div>
    </div>
  );

  const getAgentIcon = (type: string) => {
    if (type.toLowerCase() === 'scout') return '🤖';
    if (type.toLowerCase() === 'analyst') return '🔬';
    if (type.toLowerCase() === 'reporter') return '📡';
    if (type.toLowerCase() === 'defender') return '🛡️';
    return '⚡';
  };

  return (
    <div className="border-4 border-brutal-text bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] flex flex-col h-full">
      <div className="bg-brutal-text p-4 text-brutal-bg font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" /> Live Agent Feed
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live
        </div>
      </div>
      <div className="divide-y divide-brutal-text/10 flex-1 overflow-y-auto max-h-[400px]">
        <AnimatePresence>
          {events.map((ev, i) => (
            <motion.div 
              key={ev.id || i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-5 py-4 flex items-start gap-3"
            >
              <div className="text-xl mt-1">{getAgentIcon(ev.agent_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs uppercase tracking-widest">{ev.agent_type}</span>
                  <span className="text-[10px] opacity-40 font-mono">{ev.time}</span>
                </div>
                <p className="font-mono text-xs opacity-80 mb-2">{ev.details}</p>
                {ev.solana_proof_tx && (
                  <a 
                    href={`https://explorer.solana.com/tx/${ev.solana_proof_tx}?cluster=devnet`} 
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-brutal-orange uppercase tracking-widest font-bold hover:underline"
                  >
                    ⛓️ Proof anchored: {ev.solana_proof_tx.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RiskTimelineChart({ programId, base }: { programId: string, base: string }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${base}/watchlist/${encodeURIComponent(programId)}/history`)
      .then(r => r.json())
      .then(d => {
        // Assume latest is first, we want chronological order for chart
        const sorted = (d.history || []).reverse();
        setHistory(sorted);
      })
      .catch(() => {});
  }, [base, programId]);

  if (history.length === 0) return <div className="text-sm font-mono opacity-50 p-4">No risk history available yet.</div>;

  const labels = history.map(h => new Date(h.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
  
  // Use vulnerability count or risk score if it exists. 
  // Let's plot Risk Score if available, otherwise vuln_count
  const dataPoints = history.map(h => h.risk_score !== undefined && h.risk_score !== null ? h.risk_score : (h.vuln_count * 10));

  const data = {
    labels,
    datasets: [
      {
        label: 'Risk Score',
        data: dataPoints,
        borderColor: '#EA580C',
        backgroundColor: 'rgba(234, 88, 12, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#1C1C1C',
        pointBorderColor: '#EA580C',
        pointBorderWidth: 2,
        pointRadius: 4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1C1C1C',
        titleFont: { family: 'monospace' },
        bodyFont: { family: 'monospace' },
        padding: 10,
        displayColors: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(28,28,28,0.1)' },
        ticks: { font: { family: 'monospace', size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'monospace', size: 10 } }
      }
    }
  };

  return (
    <div className="bg-white border-2 border-brutal-text p-4 h-[250px] shadow-[4px_4px_0px_0px_rgba(28,28,28,1)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4 text-brutal-orange" /> Risk Timeline
        </h3>
        <span className="text-[10px] opacity-50 font-mono">Last {history.length} scans</span>
      </div>
      <div className="h-[180px]">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
