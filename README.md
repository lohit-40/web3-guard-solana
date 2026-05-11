# Web3 Guard — Solana Autonomous Agent Framework
### Colosseum Frontier Hackathon 2026 Submission

> **"On April 5th 2026, the Drift Protocol lost $285 million because no autonomous system was watching their admin keys. We built that system."**

---

## 🤖 What We Built

Web3 Guard is the **world's first autonomous multi-agent security monitoring system for Solana programs**. Instead of one-time audits costing $50K–$500K, we provide continuous 24/7 AI-powered surveillance for **$99–$2,000/month**.

### The Autonomous ReAct Agent Architecture

We upgraded our standard LLM pipeline to a **Hermes-Style ReAct (Reasoning and Acting) Agent Framework**. The system doesn't just pass code to an LLM—it autonomously "thinks" and actively uses tools to verify live state before making a decision.

| Agent | Role | Execution Flow |
|-------|------|----------------|
| 🤖 **Scout** | Anomaly Detection | Monitors Solana programs via Helius RPC. If tx rate or fail rate spikes, it triggers the Analyst. |
| 🔬 **Analyst** | ReAct Security Engine | Uses **Gemini 2.5** to enter a ReAct Loop (`Thought -> Action -> Observation -> Final Answer`). It actively calls RPC tools (e.g. `fetch_onchain_status`) to verify live state. |
| 🧠 **Memory** | Persistent RAG DB | A PostgreSQL-backed Vector Database. The Analyst performs a cosine similarity search on historical scans before analyzing, ensuring it learns from past mistakes. |
| 📡 **Reporter** | On-Chain Verification | Anchors a cryptographically secure `Proof-of-Audit` hash directly to a smart contract to ensure the scan wasn't tampered with. |
| 🛡️ **Defender**| Automated Multisig | If a `CRITICAL` severity vulnerability is found, it automatically proposes a protocol pause directly to the developers via Telegram. |

### 🧠 Self-Improving Persistent Memory
The Analyst Agent is fully stateful. Whenever a new vulnerability type is confirmed, it is securely embedded (using `gemini-embedding-001`) and stored in a PostgreSQL `rag_memory` table. On all future scans, the Agent pulls related lessons via semantic search, dramatically reducing hallucinations.

### ⚡ Cloud Run CI/CD Integration
Web3 Guard is fully production-ready. We utilize Google Cloud Build (`cloudbuild.yaml`) to automatically compile and deploy the backend to Google Cloud Run upon every Git push. The service is explicitly configured with a **300-second execution timeout** to allow the ReAct Agent plenty of time to process complex, multi-tool reasoning loops safely.

### What We Scan For (Top 10 Solana Vulnerabilities)

1. Missing Signer Checks
2. Missing Ownership Checks
3. Arbitrary CPI (Cross-Program Invocation)
4. Integer Overflow/Underflow
5. Account Reinitialization
6. PDA Seed Collision
7. Type Confusion / Type Cosplay
8. Duplicate Mutable Accounts
9. Compute Budget Exhaustion
10. Missing System Account Validation

---

## 🚀 Quick Start

### 1. Clone & Navigate

```bash
cd solana_submission_v2
```

### 2. Backend Setup

```bash
cd backend

# Copy and fill in your tokens
cp .env.example .env
# Edit .env with your GEMINI_API_KEY, HELIUS_KEY, TELEGRAM_BOT_TOKEN

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be at **http://localhost:3000**

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` in the `/backend` folder and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI scanning |
| `HELIUS_KEY` | ✅ | Helius RPC key for Solana monitoring (free tier: helius.dev) |
| `TELEGRAM_BOT_TOKEN` | ⚡ | Telegram bot token from @BotFather |
| `BASE_URL` | ⚡ | Your public deployment URL (for Telegram webhook) |
| `WALLET_PRIVATE_KEY` | 📌 | 64-byte hex key of devnet wallet for on-chain proof anchoring |
| `DISCORD_WEBHOOK_URL` | 📌 | Optional Discord channel webhook |

---

## 📡 Telegram Bot Commands

Once `TELEGRAM_BOT_TOKEN` and `BASE_URL` are set:

```
/status <program_id>    — Get current risk level & last scan time
/watchlist              — List all programs you're monitoring
/approve                — Approve a Defender Agent pause proposal
/dismiss                — Dismiss a pause proposal
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/watchlist` | Add program to watchlist |
| `GET` | `/watchlist` | List all watched programs |
| `DELETE` | `/watchlist/{id}` | Remove from watchlist |
| `GET` | `/watchlist/{id}/history` | Risk score timeline |
| `GET` | `/monitor/events` | Paginated agent activity feed |
| `POST` | `/monitor/pause/{id}` | Trigger Defender Agent |
| `GET` | `/threat-feed` | Cross-protocol threat intelligence |
| `POST` | `/telegram-webhook` | Telegram bot update receiver |
| `POST` | `/scan` | Manual AI security audit |

---

## 🏗️ Architecture

```
Frontend (Next.js 14)
  ├── /          — AI Audit Interface
  ├── /dashboard — Agent Command Center (Live Feed + Risk Timeline)
  ├── /monitor   — Watchlist Manager (CRUD + Pause trigger)
  └── /explorer  — Public Audit History

Backend (FastAPI + Python)
  ├── main.py    — API server + APScheduler lifecycle
  ├── agents.py  — ScoutAgent, AnalystAgent, ReporterAgent, DefenderAgent
  └── database.py— SQLite/Postgres schema (watchlist, events, risk_history, agent_memory, threat_signatures)

Solana Integration
  ├── Helius RPC — Real-time program monitoring
  ├── MemoSq4   — On-chain Proof-of-Audit anchoring
  └── Devnet     — Demo environment
```

---

## 💡 Market Opportunity

- 10,000+ active Solana programs
- $50B+ TVL needing continuous security
- $600M lost to Solana exploits (2020–Q1 2025)
- Audit firms charge $50K–$500K **one-time** — we charge $99–$2K/month **continuously**

---

## 🏆 Hackathon Category

**Colosseum Frontier Hackathon 2026 — AI & Automation Track**

Built with: FastAPI · Next.js 14 · Gemini 2.5 Flash · APScheduler · Helius RPC · Solana Web3.js · Telegram Bot API
