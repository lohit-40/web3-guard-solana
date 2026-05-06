"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity, Users, ShieldAlert, Cpu, AlertTriangle,
  CheckCircle, Radio, Eye, Zap, TrendingUp, Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentEvent {
  id: number;
  contract: string;
  type: string;
  details: string;
  agent_type: string;
  risk_before?: string;
  risk_after?: string;
  vuln_count?: number;
  solana_proof_tx?: string;
  time: string;
}

interface RiskPoint {
  risk_score: number;
  risk_level: string;
  vuln_count: number;
  recorded_at: string;
}

interface WatchlistEntry {
  id: number;
  contract_address: string;
  risk_level: string;
  last_scanned?: string;
}

interface DashboardStats {
  programs_watched: number;
  scans_today: number;
  active_alerts: number;
  proofs_anchored: number;
}

interface MonitorStatus {
  scout: {
    mode: string;
    active_count: number;
    ws_subscriptions: string[];
  };
  scheduler: { running: boolean };
  queue_size: number;
}

// ── Agent Badges ───────────────────────────────────────────────────────────

const AGENT_META: Record<string, { emoji: string; label: string; color: string }> = {
  Scout:    { emoji: "🤖", label: "Scout",    color: "#9945FF" },
  Analyst:  { emoji: "🔬", label: "Analyst",  color: "#0284C7" },
  Reporter: { emoji: "📡", label: "Reporter", color: "#EA580C" },
  Defender: { emoji: "🛡️", label: "Defender", color: "#DC2626" },
  System:   { emoji: "⚙️",  label: "System",  color: "#6B7280" },
};

const RISK_COLOR: Record<string, string> = {
  CRITICAL: "#DC2626", HIGH: "#EA580C", MEDIUM: "#D97706",
  LOW: "#16A34A", SAFE: "#16A34A", UNKNOWN: "#6B7280",
};

// ── SVG Risk Timeline Chart ────────────────────────────────────────────────

function RiskChart({ history }: { history: RiskPoint[] }) {
  const W = 560, H = 140, PAD = 16;
  if (!history || history.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 font-mono text-xs opacity-40 uppercase">
        Awaiting scan history…
      </div>
    );
  }

  const reversed = [...history].reverse();
  const scores = reversed.map((p) => p.risk_score ?? 0);
  const maxScore = Math.max(...scores, 1);

  const pts = reversed.map((p, i) => {
    const x = PAD + (i / (reversed.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p.risk_score ?? 0) / maxScore) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const areaPath =
    `M${pts[0]} ` +
    pts.slice(1).map((p) => `L${p}`).join(" ") +
    ` L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`;

  const linePath = `M${pts[0]} ` + pts.slice(1).map((p) => `L${p}`).join(" ");

  const latest = reversed[reversed.length - 1];
  const dotColor = RISK_COLOR[latest?.risk_level ?? "UNKNOWN"] ?? "#6B7280";
  const lastPt = pts[pts.length - 1].split(",");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dotColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={dotColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={PAD} y1={H - PAD - t * (H - PAD * 2)}
          x2={W - PAD} y2={H - PAD - t * (H - PAD * 2)}
          stroke="#1C1C1C" strokeOpacity="0.08" strokeWidth="1"
        />
      ))}
      {/* Filled area */}
      <path d={areaPath} fill="url(#chartGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={dotColor} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Dots */}
      {pts.map((pt, i) => {
        const [cx, cy] = pt.split(",");
        const col = RISK_COLOR[reversed[i]?.risk_level ?? "UNKNOWN"] ?? "#6B7280";
        return <circle key={i} cx={cx} cy={cy} r="3.5" fill={col} stroke="white" strokeWidth="1.5" />;
      })}
      {/* Latest dot pulse */}
      <circle cx={lastPt[0]} cy={lastPt[1]} r="7" fill={dotColor} opacity="0.2">
        <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={lastPt[0]} cy={lastPt[1]} r="5" fill={dotColor} />
    </svg>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [events, setEvents]       = useState<AgentEvent[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [history, setHistory]     = useState<RiskPoint[]>([]);
  const [stats, setStats]         = useState<DashboardStats>({
    programs_watched: 0, scans_today: 0, active_alerts: 0, proofs_anchored: 0,
  });
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [live, setLive]           = useState(true);
  const [wsStatus, setWsStatus]   = useState<MonitorStatus | null>(null);

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // ── Fetch helpers ──────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/monitor/events?limit=30`, { cache: 'no-store' });
      const d = await r.json();
      setEvents(d.events ?? []);

      // Derive stats from events
      const today = new Date().toISOString().slice(0, 10);
      const scansToday = (d.events ?? []).filter((e: AgentEvent) =>
        e.time && e.time.startsWith(today)
      ).length;
      const alerts = (d.events ?? []).filter((e: AgentEvent) =>
        ["ANOMALY_DETECTED", "ANALYST_SCAN"].includes(e.type)
      ).length;
      const proofs = (d.events ?? []).filter((e: AgentEvent) =>
        e.solana_proof_tx && !e.solana_proof_tx.startsWith("error")
      ).length;

      setStats((s) => ({
        ...s, scans_today: scansToday, active_alerts: alerts, proofs_anchored: proofs,
      }));
    } catch { /* silently fail */ }
  }, [BASE]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/watchlist`, { cache: 'no-store' });
      const d = await r.json();
      setWatchlist(d ?? []);
      setStats((s) => ({ ...s, programs_watched: (d ?? []).length }));
      if (!selectedProgram && d.length > 0) {
        setSelectedProgram(d[0].contract_address);
      }
    } catch { /* silently fail */ }
  }, [BASE, selectedProgram]);

  const fetchHistory = useCallback(async (prog: string) => {
    try {
      const r = await fetch(`${BASE}/watchlist/${encodeURIComponent(prog)}/history`, { cache: 'no-store' });
      const d = await r.json();
      setHistory(d.history ?? []);
    } catch { /* silently fail */ }
  }, [BASE]);

  const fetchMonitorStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/monitoring/status`, { cache: 'no-store' });
      const d = await r.json();
      setWsStatus(d);
    } catch { /* silently fail */ }
  }, [BASE]);

  useEffect(() => {
    fetchEvents();
    fetchWatchlist();
    fetchMonitorStatus();
  }, [fetchEvents, fetchWatchlist, fetchMonitorStatus]);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      fetchEvents();
      fetchMonitorStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [live, fetchEvents, fetchMonitorStatus]);

  useEffect(() => {
    if (selectedProgram) fetchHistory(selectedProgram);
  }, [selectedProgram, fetchHistory]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pt-32 pb-24 px-4 md:px-12 pointer-events-auto"
      style={{ backgroundColor: "#F2F0EB" }}
    >
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-[0.15em] uppercase text-brutal-text mb-2">
              Agent <span className="text-brutal-orange">Command Center</span>
            </h1>
            <p className="font-mono text-sm uppercase tracking-widest text-brutal-text/60">
              Solana Autonomous Security Framework — Live Monitor
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLive((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 border-2 font-mono text-xs font-bold uppercase tracking-widest transition-all ${
                live
                  ? "border-green-500 text-green-600 bg-green-500/10"
                  : "border-brutal-text/30 text-brutal-text/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-brutal-text/30"}`} />
              {live ? "Live" : "Paused"}
            </button>

            {/* Real-time WebSocket Status Badge */}
            {wsStatus ? (
              wsStatus.scout.mode === "helius_websocket" && wsStatus.scout.active_count > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 border-2 border-green-500 bg-green-500/10">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-green-600">
                    WebSocket Live · {wsStatus.scout.active_count} programs
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 border-2 border-amber-400 bg-amber-400/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-600">
                    Polling · 60s
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-widest">
                  Scout Agent Active
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Programs Watched",  value: stats.programs_watched, icon: Eye,        bg: "bg-purple-500/10",  border: "border-purple-400",  text: "text-purple-600" },
            { label: "Scans Today",        value: stats.scans_today,      icon: Activity,   bg: "bg-blue-500/10",    border: "border-blue-400",    text: "text-blue-600" },
            { label: "Active Alerts",      value: stats.active_alerts,    icon: AlertTriangle, bg: "bg-orange-500/10", border: "border-orange-400", text: "text-orange-600" },
            { label: "Proofs On-Chain",    value: stats.proofs_anchored,  icon: Zap,        bg: "bg-green-500/10",  border: "border-green-400",   text: "text-green-600" },
          ].map(({ label, value, icon: Icon, bg, border, text }) => (
            <div
              key={label}
              className="border-4 border-brutal-text p-5 shadow-[6px_6px_0px_0px_rgba(28,28,28,1)] bg-white relative overflow-hidden group"
            >
              <div className={`absolute -right-4 -top-4 w-20 h-20 ${bg} rounded-full group-hover:scale-150 transition-transform duration-500`} />
              <div className={`flex items-center gap-3 mb-3`}>
                <div className={`p-2 ${bg} border-2 ${border}`}>
                  <Icon className={`w-5 h-5 ${text}`} />
                </div>
                <span className="font-bold tracking-widest uppercase text-xs">{label}</span>
              </div>
              <div className="text-4xl font-black">{value}</div>
            </div>
          ))}
        </div>

        {/* Main Grid — Timeline + Watchlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Risk Timeline */}
          <div className="lg:col-span-2 border-4 border-brutal-text bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
            <div className="bg-brutal-text p-4 text-brutal-bg flex items-center justify-between">
              <span className="font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Risk Timeline
              </span>
              <span className="font-mono text-xs opacity-70">7-day history</span>
            </div>
            <div className="p-4">
              {selectedProgram && (
                <p className="font-mono text-xs mb-3 opacity-50">
                  PROGRAM: {selectedProgram.slice(0, 10)}…{selectedProgram.slice(-6)}
                </p>
              )}
              <RiskChart history={history} />
              {/* Risk level legend */}
              <div className="flex gap-4 mt-3 flex-wrap">
                {Object.entries(RISK_COLOR).map(([lvl, col]) => (
                  <span key={lvl} className="flex items-center gap-1 font-mono text-[10px] uppercase">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                    {lvl}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Watchlist Picker */}
          <div className="border-4 border-brutal-text bg-white shadow-[8px_8px_0px_0px_rgba(28,28,28,1)]">
            <div className="bg-brutal-text p-4 text-brutal-bg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span className="font-bold uppercase tracking-[0.2em] text-sm">Watchlist</span>
            </div>
            <div className="divide-y-2 divide-brutal-text/10 overflow-y-auto max-h-60">
              {watchlist.length === 0 ? (
                <div className="p-6 font-mono text-xs opacity-40 uppercase text-center">
                  No programs watched yet.
                </div>
              ) : (
                watchlist.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedProgram(w.contract_address)}
                    className={`w-full text-left p-4 flex items-center justify-between hover:bg-brutal-text/5 transition-colors ${
                      selectedProgram === w.contract_address ? "bg-brutal-text/10" : ""
                    }`}
                  >
                    <div>
                      <p className="font-mono text-xs font-bold">
                        {w.contract_address.slice(0, 8)}…{w.contract_address.slice(-6)}
                      </p>
                      <p className="font-mono text-[10px] opacity-50 uppercase mt-0.5">
                        {w.last_scanned ? new Date(w.last_scanned).toLocaleTimeString() : "Not yet scanned"}
                      </p>
                    </div>
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold uppercase border-2 font-mono"
                      style={{
                        borderColor: RISK_COLOR[w.risk_level ?? "UNKNOWN"],
                        color: RISK_COLOR[w.risk_level ?? "UNKNOWN"],
                      }}
                    >
                      {w.risk_level ?? "—"}
                    </span>
                  </button>
                ))
              )}
            </div>
            {selectedProgram && (
              <div className="p-3 border-t-2 border-brutal-text/20">
                <a
                  href={`/monitor`}
                  className="block text-center font-mono text-xs font-bold uppercase tracking-widest text-brutal-orange hover:underline"
                >
                  Manage Watchlist →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Agent Activity Feed */}
        <div className="border-4 border-brutal-text bg-white shadow-[12px_12px_0px_0px_rgba(28,28,28,1)] overflow-hidden">
          <div className="bg-brutal-text p-4 border-b-4 border-brutal-text text-brutal-bg flex items-center justify-between">
            <h2 className="font-bold uppercase tracking-[0.2em] flex items-center gap-3">
              <Cpu className="w-5 h-5" /> Agent Activity Feed
            </h2>
            <span className="font-mono text-xs opacity-60">
              {events.length} events
            </span>
          </div>

          <div>
            {events.length === 0 ? (
              <div className="p-10 text-center font-mono opacity-40 uppercase text-sm">
                <Radio className="w-8 h-8 mx-auto mb-3 animate-pulse" />
                Listening for agent broadcasts…
              </div>
            ) : (
              <div className="divide-y-2 divide-brutal-text/10">
                <AnimatePresence initial={false}>
                  {events.map((event) => {
                    const agent = AGENT_META[event.agent_type] ?? AGENT_META.System;
                    const isAlert = ["ANOMALY_DETECTED", "ANALYST_SCAN", "WS_LIVE_EVENT"].includes(event.type);
                    const isWsEvent = event.type === "WS_LIVE_EVENT";
                    const riskColor = RISK_COLOR[event.risk_after ?? ""] ?? "#6B7280";

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="p-5 md:p-6 flex flex-col md:flex-row gap-5 md:items-start hover:bg-brutal-text/5 transition-colors"
                      >
                        {/* Agent Badge */}
                        <div
                          className="flex-shrink-0 w-14 h-14 border-2 flex flex-col items-center justify-center text-xl gap-0.5"
                          style={{ borderColor: agent.color, backgroundColor: `${agent.color}12` }}
                        >
                          <span>{agent.emoji}</span>
                          <span className="font-mono text-[8px] font-bold uppercase" style={{ color: agent.color }}>
                            {agent.label}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 font-mono"
                              style={{ borderColor: isAlert ? "#EA580C" : "#16A34A",
                                       color: isAlert ? "#EA580C" : "#16A34A" }}
                            >
                              {event.type}
                            </span>
                            {event.risk_after && (
                              <span
                                className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border-2 font-mono"
                                style={{ borderColor: riskColor, color: riskColor }}
                              >
                                {event.risk_after}
                              </span>
                            )}
                            <span className="font-mono text-[10px] opacity-40 uppercase">
                              {event.time ? new Date(event.time).toLocaleString() : "—"}
                            </span>
                          </div>
                          <p className="font-mono text-sm leading-relaxed text-brutal-text/80">
                            {event.details}
                          </p>
                          <div className="flex flex-wrap gap-4 mt-2">
                            <span className="font-mono text-[10px] font-bold">
                              TARGET:{" "}
                              <span className="text-brutal-orange">
                                {event.contract?.slice(0, 8)}…{event.contract?.slice(-6)}
                              </span>
                            </span>
                            {event.solana_proof_tx && !event.solana_proof_tx.startsWith("error") && (
                              <a
                                href={`https://explorer.solana.com/tx/${event.solana_proof_tx}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                ⛓ Proof: {event.solana_proof_tx.slice(0, 12)}…
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Vuln count bubble */}
                        {(event.vuln_count ?? 0) > 0 && (
                          <div
                            className="flex-shrink-0 w-12 h-12 border-2 flex flex-col items-center justify-center"
                            style={{ borderColor: riskColor, backgroundColor: `${riskColor}15` }}
                          >
                            <span className="text-xl font-black" style={{ color: riskColor }}>
                              {event.vuln_count}
                            </span>
                            <span className="font-mono text-[8px] uppercase opacity-70">vulns</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
