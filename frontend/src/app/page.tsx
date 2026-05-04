"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, Code2, Link, Sparkles, Download, Award } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { playSound } from "@/utils/sounds";
import { useWallet } from "@/contexts/WalletContext";
import {
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Address,
  Keypair,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";

const API_URL = "/api";

// ─── Soroban Config ──────────────────────────────────────────────────────────
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const SOROBAN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID ||
  "CDQQQUGCX33O7JAUXOJHPC6JONZ3D5UPWW6IHNUHLPSLF7IPZHQ2WBZU";
// Native XLM token contract on testnet
const NATIVE_TOKEN_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/**
 * Build, sign (via Phantom), and submit a Solana memo transaction.
 * Returns the submitted transaction signature on success.
 */
async function submitSolanaProof({
  callerPublicKey,
  auditHash,
  programId,
  riskLevel,
  vulnCount,
}: {
  callerPublicKey: string;
  auditHash: string;
  programId: string;
  riskLevel: string;
  vulnCount: number;
}): Promise<string> {
  const provider = (window as any).phantom?.solana || (window as any).solana;
  if (!provider?.isPhantom) {
    throw new Error("Phantom wallet not found. Please install the Phantom extension.");
  }

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Memo program ID
  const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  
  const memoData = `WG|${programId}|${auditHash}|${riskLevel}|${vulnCount}`;
  
  const instruction = new TransactionInstruction({
    keys: [{ pubkey: new PublicKey(callerPublicKey), isSigner: true, isWritable: true }],
    programId: memoProgramId,
    data: Buffer.from(memoData, "utf-8"),
  });
  
  const transaction = new Transaction().add(instruction);
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(callerPublicKey);
  
  // Sign and send transaction via Phantom
  const { signature } = await provider.signAndSendTransaction(transaction);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, "confirmed");
  
  return signature;
}

/**
 * Build, simulate, sign (via Freighter), and submit a Soroban store_proof invocation.
 * Returns the submitted transaction hash on success.
 */
async function submitSorobanProof({
  callerPublicKey,
  auditHash,
  programId,
  riskLevel,
  vulnCount,
}: {
  callerPublicKey: string;
  auditHash: string;
  programId: string;
  riskLevel: string;
  vulnCount: number;
}): Promise<string> {
  const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
  const account = await server.getAccount(callerPublicKey);

  const contract = new Contract(SOROBAN_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "store_proof",
        // caller: Address
        new Address(callerPublicKey).toScVal(),
        // fee_token: Address (native XLM contract)
        new Address(NATIVE_TOKEN_ID).toScVal(),
        // audit_hash: String
        nativeToScVal(auditHash, { type: "string" }),
        // program_id: String
        nativeToScVal(programId, { type: "string" }),
        // risk_level: String
        nativeToScVal(riskLevel, { type: "string" }),
        // vuln_count: u32
        nativeToScVal(vulnCount, { type: "u32" }),
      )
    )
    .setTimeout(30)
    .build();

  // Simulate to get the footprint / auth entries
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error("Simulation failed: " + simResult.error);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const preparedTxXdr = preparedTx.toXDR();

  // Sign via Freighter wallet (user must click "Approve")
  const signResult = await signTransaction(preparedTxXdr, {
    networkPassphrase: Networks.TESTNET,
  });

  if (signResult.error) {
    throw new Error("Wallet signing error: " + signResult.error);
  }

  // Submit the signed transaction with FEE BUMP (L6 Advanced Feature)
  const innerTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET);
  
  // Create a randomized sponsor Keypair for demonstration (in production, backend signs this)
  const sponsorKey = Keypair.random();
  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    sponsorKey,
    String(Number(BASE_FEE) * 2),
    innerTx as any,
    Networks.TESTNET
  );
  feeBumpTx.sign(sponsorKey);

  const sendResult = await server.sendTransaction(feeBumpTx);

  if (sendResult.status === "ERROR") {
    throw new Error("Submission failed: " + JSON.stringify(sendResult.errorResult));
  }

  // Poll for finality
  let txStatus = sendResult;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollResult = await server.getTransaction(sendResult.hash);
    if (pollResult.status === "SUCCESS") return sendResult.hash;
    if (pollResult.status === "FAILED") throw new Error("Transaction failed on-chain");
  }
  // Return hash even if still pending (network congestion)
  return sendResult.hash;
}

const Chatbot = dynamic(() => import("@/components/Chatbot"), { ssr: false });
const HistorySidebar = dynamic(() => import("@/components/HistorySidebar"), { ssr: false });

interface Vulnerability {
  type: string;
  severity: string;
  line_number: number | null;
  description: string;
  remediation: string | null;
}

interface ScanResponse {
  address: string;
  status: string;
  vulnerabilities: Vulnerability[];
  audit_tx_hash?: string;
  hash_key?: string;
  audit_chain?: string;           // "ethereum" | "solana" | "stellar"
  solana_explorer_url?: string;
  stellar_explorer_url?: string;
  soroban_contract_id?: string;   // Soroban contract ID (Stellar)
  soroban_proof_id?: number;      // Sequential proof number
}

export default function App() {
  const { address: userAddress, isConnected, chain: walletChain, switchChain } = useWallet();
  const [inputMode, setInputMode] = useState<'address' | 'code' | null>(null);
  const [ecosystem, setEcosystem] = useState<'Solidity' | 'Rust'>('Solidity');
  const [address, setAddress] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [chainId, setChainId] = useState("1");
  const [loading, setLoading] = useState(false);
  const scanSteps = ["Fetching Blockchain Data...", "Decompiling Contract...", "Running AI Heuristics...", "Finalizing Report..."];
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-switch wallet chain when ecosystem changes
  useEffect(() => {
    if (ecosystem === 'Rust') {
      if (chainId === 'solana' || chainId === '101') {
        switchChain('solana');
      } else if (chainId === 'stellar') {
        switchChain('stellar');
      }
    } else {
      switchChain('evm');
    }
  }, [ecosystem, chainId]);

  // Auto-Remediation State
  const [secureContract, setSecureContract] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // NFT Badge Minting State
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{ tx_hash: string; token_id: number | null; etherscan_nft_url: string | null } | null>(null);

  const handleScan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputMode === 'address' && !address) {
      toast.error("Please provide a verified contract address.");
      return;
    }
    if (inputMode === 'code' && !sourceCode) {
      toast.error("Please paste your raw Solidity source code.");
      return;
    }

    // L1 + L2: For Stellar, require Freighter to be connected
    if (chainId === 'stellar' && !isConnected) {
      toast.error("Please connect your Freighter wallet first to submit a Stellar audit proof.");
      return;
    }
    
    if (chainId === 'solana' && !isConnected) {
      toast.error("Please connect your Phantom wallet first to submit a Solana audit proof.");
      return;
    }
    
    setLoading(true);
    setResult(null);
    setScanStep(0);
    playSound('scan');
    
    const interval = setInterval(() => {
      setScanStep(prev => {
        if (prev < 3) playSound('scan');
        return prev < 3 ? prev + 1 : prev;
      });
    }, 2500);

    const payload = inputMode === 'address' 
      ? { contract_address: address, chain_id: chainId, ecosystem } 
      : { source_code: sourceCode, chain_id: chainId, ecosystem };

    try {
      // ── Step 1: Run AI Analysis (backend) ──────────────────────────────────
      const res = await fetch(`${API_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Scanning failed.";
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = errorText || `Server error (${res.status})`;
        }
        throw new Error(errorMessage);
      }

      const data: ScanResponse = await res.json();

      // ── Step 2: Sign & submit tx from the FRONTEND ────
      if (chainId === 'solana' && userAddress) {
        setScanStep(3); // Show "Finalizing..."
        toast.loading("⚡ Approve transaction in Phantom...", { id: "solana-sign" });
        try {
          const auditHash = data.hash_key || `audit_${Date.now()}`;
          const programId = address || "source_code_audit";
          const riskLevel = data.vulnerabilities.length === 0 ? "LOW"
            : data.vulnerabilities.some(v => v.severity === "High") ? "HIGH"
            : data.vulnerabilities.some(v => v.severity === "Medium") ? "MEDIUM" : "LOW";
          const vulnCount = data.vulnerabilities.length;

          const txHash = await submitSolanaProof({
            callerPublicKey: userAddress,
            auditHash,
            programId,
            riskLevel,
            vulnCount,
          });

          // Attach the on-chain proof to the result locally
          data.audit_tx_hash = txHash;
          data.solana_explorer_url = `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
          
          // Update the backend DB with the new tx hash
          try {
            await fetch(`${API_URL}/update_audit_tx`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hash_key: auditHash,
                audit_tx_hash: txHash,
                solana_explorer_url: data.solana_explorer_url
              })
            });
          } catch (e) {
            console.error("Failed to update audit tx hash on backend:", e);
          }
          data.audit_chain = "solana";

          toast.dismiss("solana-sign");
          toast.success("✅ Audit proof anchored on Solana Devnet!", { duration: 5000 });
        } catch (solanaErr: any) {
          toast.dismiss("solana-sign");
          // Handle user rejection gracefully
          const msg: string = solanaErr?.message || "";
          if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) {
            toast.error("Transaction rejected. Audit result saved locally.", { duration: 4000 });
          } else {
            toast.error("Transaction failed (Need Devnet SOL?). Saved off-chain!", { duration: 5000 });
          }
          // Continue without on-chain proof — still show AI report
        }
      } else if (chainId === 'stellar' && userAddress) {
        setScanStep(3); // Show "Finalizing..."
        toast.loading("⚡ Approve transaction in Freighter (Gas fee is 100% sponsored!)...", { id: "soroban-sign" });
        try {
          const auditHash = data.hash_key || `audit_${Date.now()}`;
          const programId = address || "source_code_audit";
          const riskLevel = data.vulnerabilities.length === 0 ? "LOW"
            : data.vulnerabilities.some(v => v.severity === "High") ? "HIGH"
            : data.vulnerabilities.some(v => v.severity === "Medium") ? "MEDIUM" : "LOW";
          const vulnCount = data.vulnerabilities.length;

          const txHash = await submitSorobanProof({
            callerPublicKey: userAddress,
            auditHash,
            programId,
            riskLevel,
            vulnCount,
          });

          // Attach the on-chain proof to the result locally
          data.audit_tx_hash = txHash;
          data.stellar_explorer_url = `https://stellar.expert/explorer/testnet/tx/${txHash}`;
          
          // Update the backend DB with the new tx hash
          try {
            await fetch(`${API_URL}/update_audit_tx`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hash_key: auditHash,
                audit_tx_hash: txHash,
                stellar_explorer_url: data.stellar_explorer_url
              })
            });
          } catch (e) {
            console.error("Failed to update audit tx hash on backend:", e);
          }
          data.audit_chain = "stellar";
          data.stellar_explorer_url = `https://stellar.expert/explorer/testnet/tx/${txHash}`;
          data.soroban_contract_id = SOROBAN_CONTRACT_ID;

          toast.dismiss("soroban-sign");
          toast.success("✅ Audit proof anchored on Stellar Testnet!", { duration: 5000 });
        } catch (sorobanErr: any) {
          toast.dismiss("soroban-sign");
          // Handle user rejection gracefully
          const msg: string = sorobanErr?.message || "";
          if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) {
            toast.error("Transaction rejected. Audit result saved locally.", { duration: 4000 });
          } else if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("balance")) {
            toast.error("Insufficient XLM balance. Fund your Freighter wallet and retry.", { duration: 5000 });
          } else {
            toast.error("Soroban signing error: " + msg.slice(0, 100), { duration: 5000 });
          }
          // Continue without on-chain proof — still show AI report
        }
      }

      setResult(data);
      
      if (data.vulnerabilities.length > 0) {
        playSound('alert');
        toast.error("Vulnerabilities detected!");
      } else {
        playSound('success');
        toast.success("Security analysis complete, contract is secure!");
      }
      
      // Save history locally
      try {
        const saved = localStorage.getItem('web3guard_history') || '[]';
        const historyArray = JSON.parse(saved);
        const newEntry = { ...data, timestamp: new Date().toISOString() };
        const deduplicated = historyArray.filter((item: any) => item.address !== data.address || !data.address);
        const newHistory = [newEntry, ...deduplicated].slice(0, 10);
        localStorage.setItem('web3guard_history', JSON.stringify(newHistory));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      
    } catch (err: any) {
      playSound('error');
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const handleGenerateSecureCode = async () => {
    if (!result || (!sourceCode && !address)) return;
    setIsGenerating(true);
    setSecureContract(null);
    
    // We send whichever input the user originally provided
    const payload = inputMode === 'address' 
      ? { contract_address: address, chain_id: chainId, ecosystem } 
      : { source_code: sourceCode, chain_id: chainId, ecosystem };
      
    try {
      const response = await fetch(`${API_URL}/secure_contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        setSecureContract(data.secure_code);
      } else {
        const errData = await response.json();
        const errStr = errData.detail || "Failed to generate secure contract";
        if (errStr.includes("429") || errStr.toLowerCase().includes("quota")) {
          toast.error("Gemini AI Quota Exceeded! Please configure a premium API key.", { duration: 6000 });
        } else {
          toast.error("AI Remediation Error: " + errStr.slice(0, 100));
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reach AI Backend");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleMintBadge = async () => {
    if (!result || !userAddress) {
      toast.error("Connect your wallet first to mint an audit badge!");
      return;
    }
    if (walletChain === "solana") {
      toast.error("Audit Badges are only available on Ethereum (Sepolia). Please switch to the Solidity ecosystem and connect your EVM wallet to mint.", { duration: 5000 });
      return;
    }
    setIsMinting(true);
    setMintResult(null);
    try {
      const highestSeverity = result.vulnerabilities.length === 0 ? "SECURE"
        : result.vulnerabilities.some(v => v.severity === "High") ? "HIGH"
        : result.vulnerabilities.some(v => v.severity === "Medium") ? "MEDIUM" : "LOW";

      const res = await fetch(`${API_URL}/mint_badge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: userAddress,
          contract_audited: result.address || "Raw Source Code",
          vulns_found: result.vulnerabilities.length,
          severity: highestSeverity
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Minting failed");
      }
      const data = await res.json();
      setMintResult(data);
      playSound('success');
      toast.success("Audit Badge NFT Minted! 🎖️");
    } catch (err: any) {
      playSound('error');
      toast.error(err.message || "Failed to mint badge");
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full">
      <Toaster position="bottom-center" toastOptions={{
        style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      }} />
      {/* Main UI Overlay */}
      <div className="relative z-10 w-full min-h-screen flex flex-col justify-center px-6 md:px-24 pt-32 pb-20 pointer-events-none">
        <div className="max-w-6xl w-full mx-auto pointer-events-auto">
          
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-24 relative"
          >
            <div className="flex items-center gap-3 mb-6 absolute -top-12 left-2 md:-left-12">
              <span className="text-brutal-orange text-6xl font-serif mt-4">*</span>
              <span className="uppercase tracking-[0.2em] text-xs font-bold text-brutal-text leading-tight max-w-[200px]">
                We are rethinking how smart contract communication happens.
              </span>
            </div>
            <h1 className="text-[100px] md:text-[160px] lg:text-[220px] font-medium tracking-tighter leading-[0.8] text-brutal-text lowercase relative z-10">
              web3<br/>
              guard
            </h1>
            
            <div className="absolute top-1/2 right-0 hidden lg:block transform rotate-90 origin-right z-0">
              <span className="text-xs tracking-widest uppercase text-brutal-text/40">Scroll to discover</span>
            </div>
          </motion.div>

          {/* Interactive Search Area */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="w-full max-w-3xl"
          >
            {/* Ecosystem Selection */}
            <div className="flex flex-col gap-4 mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="text-xs tracking-widest text-brutal-text/60 uppercase font-bold">1. Select Target Ecosystem:</span>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setEcosystem('Solidity'); setChainId('1'); setInputMode(null); }}
                  className={`py-8 px-6 border-4 flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
                    ecosystem === 'Solidity' 
                    ? 'border-brutal-orange bg-brutal-orange/5 scale-105 z-10' 
                    : 'border-brutal-text/20 hover:border-brutal-text/50 opacity-60'
                  }`}
                >
                  <span className="text-xl md:text-3xl font-bold tracking-tighter uppercase lowercase">[ Solidity ]</span>
                  <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-mono text-center">EVM / Ethereum / Polygon</p>
                </button>
                <button
                  onClick={() => { setEcosystem('Rust'); setChainId(''); setInputMode('code'); }}
                  className={`py-8 px-6 border-4 flex flex-col items-center justify-center gap-4 transition-all duration-300 ${
                    ecosystem === 'Rust' 
                    ? 'border-brutal-orange bg-brutal-orange/5 scale-105 z-10' 
                    : 'border-brutal-text/20 hover:border-brutal-text/50 opacity-60'
                  }`}
                >
                  <span className="text-xl md:text-3xl font-bold tracking-tighter uppercase lowercase">[ RUST ]</span>
                  <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-mono text-center">Solana / Stellar / NEAR</p>
                </button>
              </div>
            </div>

            {/* Zoomable Network Display */}
            <motion.div 
               whileHover={{ scale: 1.02 }}
               className="mb-10 w-full overflow-hidden border-2 border-brutal-text/10 bg-[#0a0a0a] p-4 md:p-8 relative cursor-crosshair group"
            >
              <div className="flex flex-wrap items-center justify-center gap-4 relative z-10 py-6 scale-95 group-hover:scale-[1.15] transition-transform duration-700 ease-out origin-center">
                {ecosystem === 'Solidity' ? (
                  <>
                    {[
                      { id: '1', name: 'Ethereum', color: '#627EEA', logo: 'ethereum' },
                      { id: '42161', name: 'Arbitrum', color: '#28A0F0', logo: 'arbitrum' },
                      { id: '56', name: 'BSC', color: '#F3BA2F', logo: 'smartchain' },
                      { id: '137', name: 'Polygon', color: '#8247E5', logo: 'polygon' }
                    ].map((net) => {
                      const isActive = chainId === net.id;
                      const isLight = net.id === '56';
                      return (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => setChainId(net.id)}
                          style={{
                            borderColor: isActive ? net.color : 'rgba(255,255,255,0.15)',
                            backgroundColor: isActive ? net.color : 'transparent',
                            color: isActive ? (isLight ? '#000' : '#fff') : 'rgba(255,255,255,0.5)',
                            boxShadow: isActive ? `6px 6px 0 0 rgba(${parseInt(net.color.slice(1,3), 16)},${parseInt(net.color.slice(3,5), 16)},${parseInt(net.color.slice(5,7), 16)},0.4)` : 'none'
                          }}
                          className={`flex items-center gap-3 px-6 py-3 border-2 font-mono text-sm transition-all duration-300 ${isActive ? 'font-bold scale-105' : 'hover:border-white/40 hover:opacity-100 hover:scale-100 opacity-80'}`}
                        >
                          <img 
                            src={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${net.logo}/info/logo.png`} 
                            alt={net.name} 
                            style={{ filter: isActive ? 'none' : 'grayscale(1)' }}
                            className={`w-5 h-5 object-contain transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          {net.name}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {[
                      { id: 'solana', name: 'Solana', color: '#14F195', logo: 'solana' },
                      { id: 'stellar', name: 'Stellar', color: '#08B5E5', logo: 'stellar' },
                      { id: 'near', name: 'NEAR', color: '#FFFFFF', logo: 'near' },
                      { id: 'polkadot', name: 'Polkadot', color: '#E6007A', logo: 'polkadot' }
                    ].map((net) => {
                      const isActive = chainId === net.id;
                      const isLight = net.id === 'near' || net.id === 'solana';
                      return (
                        <button
                          key={net.id}
                          type="button"
                          onClick={() => setChainId(net.id)}
                          style={{
                            borderColor: isActive ? net.color : 'rgba(255,255,255,0.15)',
                            backgroundColor: isActive ? net.color : 'transparent',
                            color: isActive ? (isLight ? '#000' : '#fff') : 'rgba(255,255,255,0.5)',
                            boxShadow: isActive ? `6px 6px 0 0 rgba(${parseInt(net.color.slice(1,3), 16)},${parseInt(net.color.slice(3,5), 16)},${parseInt(net.color.slice(5,7), 16)},0.4)` : 'none'
                          }}
                          className={`flex items-center gap-3 px-6 py-3 border-2 font-mono text-sm transition-all duration-300 ${isActive ? 'font-bold scale-105' : 'hover:border-white/40 hover:opacity-100 hover:scale-100 opacity-80'}`}
                        >
                          <img 
                            src={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${net.logo}/info/logo.png`} 
                            alt={net.name} 
                            style={{ filter: isActive ? 'none' : 'grayscale(1)' }}
                            className={`w-5 h-5 object-contain transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          {net.name}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </motion.div>

            {/* Toggle Input Mode */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <span className="text-xs tracking-widest text-brutal-text/60 uppercase font-bold shrink-0">2. Input Method:</span>
              <div className="flex items-center gap-6 border-b-2 border-brutal-text pb-4 w-full">
                {ecosystem === 'Solidity' && (
                  <button 
                    onClick={() => setInputMode('address')}
                    className={`flex items-center gap-2 text-sm tracking-[0.2em] uppercase transition-all ${
                      inputMode === 'address' 
                      ? 'text-brutal-orange font-bold' 
                      : 'text-brutal-text/40 hover:text-brutal-text'
                    }`}
                  >
                    <Link className="w-4 h-4" />
                    [ Address ]
                  </button>
                )}
                <button 
                  onClick={() => setInputMode('code')}
                  className={`flex items-center gap-2 text-sm tracking-[0.2em] uppercase transition-all ${
                    inputMode === 'code' 
                    ? 'text-brutal-orange font-bold' 
                    : 'text-brutal-text/40 hover:text-brutal-text'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  [ Source ]
                </button>
              </div>

              {inputMode === 'address' && (
                <div className="flex items-center gap-3 animate-in fade-in py-2">
                  <span className="text-brutal-text font-bold text-xs tracking-widest uppercase">Network :</span>
                  <select 
                    value={chainId} 
                    onChange={(e) => setChainId(e.target.value)}
                    className="bg-transparent border-none text-brutal-orange font-bold text-sm tracking-widest outline-none cursor-pointer hover:opacity-80 transition-all appearance-none pr-4 uppercase"
                  >
                    <option value="1">Ethereum</option>
                    <option value="11155111">Sepolia</option>
                    <option value="137">Polygon</option>
                    <option value="56">BSC</option>
                    <option value="42161">Arbitrum</option>
                  </select>
                </div>
              )}            </div>

            <AnimatePresence>
              {inputMode !== null && (
                <motion.form 
                  initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  onSubmit={handleScan} 
                  className="relative group mt-10"
                >
                  <div className="relative flex flex-col gap-6">
                    {inputMode === 'address' ? (
                      <input
                        type="text"
                        placeholder="paste verified contract address *"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className="brutal-input"
                        spellCheck={false}
                      />
                    ) : (
                      <textarea
                        placeholder={`paste raw ${ecosystem.toLowerCase()} code here *`}
                        value={sourceCode}
                        onChange={(e) => setSourceCode(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        rows={6}
                        className="w-full bg-transparent border-b-4 border-brutal-text px-0 py-4 outline-none text-2xl font-mono tracking-tight text-brutal-text placeholder:text-brutal-text/30 focus:border-brutal-orange transition-colors resize-y rounded-none appearance-none"
                        spellCheck={false}
                      />
                    )}
                    
                    <div className="w-full max-w-[280px] mt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="brutal-btn w-full"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              className="w-4 h-4 border-2 border-brutal-bg border-t-transparent rounded-full flex-shrink-0"
                            />
                            <span>{scanSteps[scanStep]}</span>
                          </div>
                        ) : (
                          "Commence Audit"
                        )}
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Results Area */}
          <AnimatePresence>
            {result && (
              <motion.div
                id="audit-report-content"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="mt-32 border-t-4 border-brutal-text pt-16 relative"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
                  <div>
                    <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-brutal-text lowercase mb-4">audit <br/> report *</h2>
                    <p className="text-brutal-text/60 font-mono text-sm tracking-widest bg-brutal-text/5 inline-block px-4 py-2">{result.address}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-6">
                      {result.audit_tx_hash && (
                        <a 
                          href={
                            result.audit_chain === 'solana'
                              ? (result.solana_explorer_url || `https://explorer.solana.com/tx/${result.audit_tx_hash}?cluster=devnet`)
                              : result.audit_chain === 'stellar'
                              ? (result.stellar_explorer_url || `https://stellar.expert/explorer/testnet/tx/${result.audit_tx_hash}`)
                              : `https://sepolia.etherscan.io/tx/${result.audit_tx_hash}`
                          } 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 px-6 py-3 border-2 text-xs tracking-[0.2em] font-bold uppercase w-max transition-all ${
                            result.audit_chain === 'solana'
                              ? 'border-[#9945FF] bg-[#9945FF] text-white hover:bg-transparent hover:text-[#9945FF]'
                              : result.audit_chain === 'stellar'
                              ? 'border-[#08B5E5] bg-[#08B5E5] text-white hover:bg-transparent hover:text-[#08B5E5]'
                              : 'border-brutal-text bg-brutal-text text-brutal-bg hover:bg-transparent hover:text-brutal-text'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          {result.audit_chain === 'solana' ? 'solana verified' : result.audit_chain === 'stellar' ? 'stellar verified' : 'blockchain verified'}
                        </a>
                      )}
                      
                      <button
                        onClick={handleDownloadPDF}
                        className="inline-flex items-center gap-2 px-6 py-3 border-2 border-brutal-text text-brutal-text hover:bg-brutal-text hover:text-brutal-bg transition-all text-xs tracking-[0.2em] font-bold uppercase"
                      >
                        <Download className="w-4 h-4" />
                        export pdf
                      </button>

                      {result.hash_key && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/audit/${result.hash_key}`);
                            toast.success("Shareable link copied to clipboard!");
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3 border-2 border-brutal-orange text-brutal-orange hover:bg-brutal-orange hover:text-brutal-bg transition-all text-xs tracking-[0.2em] font-bold uppercase"
                        >
                          <Link className="w-4 h-4" />
                          share link
                        </button>
                      )}

                      {/* NFT Badge Mint Button */}
                      <button
                        onClick={handleMintBadge}
                        disabled={isMinting || !!mintResult || (walletChain as string) === "solana" || (walletChain as string) === "stellar"}
                        className={`inline-flex items-center gap-2 px-6 py-3 border-2 transition-all text-xs tracking-[0.2em] font-bold uppercase ${
                          mintResult 
                            ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10 cursor-default'
                            : (walletChain as string) === "solana" || (walletChain as string) === "stellar"
                            ? 'border-[#10B981]/30 text-[#10B981]/80 cursor-default'
                            : 'border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-brutal-bg'
                        } ${isMinting ? 'opacity-60 cursor-wait' : ''}`}
                      >
                        {isMinting ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                            minting...
                          </>
                        ) : mintResult ? (
                          <>
                            <Award className="w-4 h-4" />
                            badge minted ✓
                          </>
                        ) : (walletChain as string) === "solana" || (walletChain as string) === "stellar" ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                            <span className="text-[#10B981]">stored on chain (native)</span>
                          </>
                        ) : (
                          <>
                            <Award className="w-4 h-4" />
                            mint audit badge
                          </>
                        )}
                      </button>
                    </div>

                    {/* Mint Result Card */}
                    {mintResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-6 border-2 border-purple-500/30 bg-purple-500/5"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Award className="w-6 h-6 text-purple-400" />
                          <span className="text-sm uppercase tracking-[0.2em] font-bold text-purple-400">soulbound nft minted</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                          <div>
                            <span className="text-brutal-text/50 text-xs tracking-widest">TOKEN ID</span>
                            <p className="text-brutal-text text-2xl font-bold">#{mintResult.token_id}</p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <a href={`https://sepolia.etherscan.io/tx/${mintResult.tx_hash}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 border border-brutal-text/30 text-brutal-text/70 hover:text-brutal-text hover:border-brutal-text transition-all text-xs tracking-wider uppercase">
                              view tx ↗
                            </a>
                            {mintResult.etherscan_nft_url && (
                              <a href={mintResult.etherscan_nft_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 border border-purple-500/50 text-purple-400 hover:bg-purple-500 hover:text-white transition-all text-xs tracking-wider uppercase">
                                view nft ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  {result.vulnerabilities.length === 0 ? (
                    <div className="flex items-center gap-3 px-8 py-4 border-2 border-[#10B981] bg-[#10B981]/10 text-[#10B981]">
                      <ShieldCheck className="w-6 h-6" />
                      <span className="text-sm tracking-[0.2em] font-bold uppercase">secure</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-8 py-4 border-2 border-brutal-orange bg-brutal-orange/10 text-brutal-orange">
                      <ShieldAlert className="w-6 h-6" />
                      <span className="text-sm tracking-[0.2em] font-bold uppercase">vulnerable</span>
                    </div>
                  )}
                </div>

                {result.vulnerabilities.length === 0 ? (
                  <div className="w-full aspect-[21/9] flex items-center justify-center border-4 border-brutal-text bg-transparent relative">
                     <span className="absolute -top-6 -left-4 text-7xl text-[#10B981] font-serif">*</span>
                    <p className="text-brutal-text font-medium text-2xl tracking-tighter">contract isolated. no severe exploits discovered.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 border-l-4 border-brutal-text pl-4 md:pl-10">
                    {result.vulnerabilities.map((vuln, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * idx }}
                        key={idx} 
                        className="group flex flex-col p-8 md:p-12 border-2 border-brutal-text hover:bg-brutal-text hover:text-brutal-bg transition-all duration-300"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between mb-8">
                          <div className="flex-1">
                            <div className="flex items-center gap-6 mb-6">
                              <span className={`px-4 py-2 text-xs uppercase tracking-[0.2em] font-bold border-2 ${
                                vuln.severity === 'High' ? 'border-brutal-orange text-brutal-orange' : 
                                vuln.severity === 'Medium' ? 'border-yellow-600 text-yellow-600' : 
                                'border-blue-600 text-blue-600'
                              } group-hover:border-brutal-bg group-hover:text-brutal-bg`}>
                                {vuln.severity} Risk
                              </span>
                              <h3 className="text-3xl md:text-5xl font-medium tracking-tighter lowercase">{vuln.type}</h3>
                            </div>
                            <p className="font-medium leading-relaxed max-w-3xl text-lg opacity-80 group-hover:opacity-100">
                              {vuln.description}
                            </p>
                          </div>
                          {vuln.line_number && (
                            <div className="mt-8 md:mt-0 flex flex-col md:items-end pb-4 border-b-2 border-brutal-text/20 md:border-b-0 md:pl-8 md:border-l-2 group-hover:border-brutal-bg/30">
                              <span className="text-xs uppercase tracking-[0.2em] mb-2 font-bold opacity-50">Line Num</span>
                              <span className="text-6xl font-bold font-mono">.{vuln.line_number}</span>
                            </div>
                          )}
                        </div>

                        {/* AI Remediation Engine Display */}
                        {vuln.remediation && (
                          <div className="mt-8 p-6 lg:p-10 border-2 border-brutal-text bg-brutal-bg text-brutal-text relative group-hover:border-brutal-bg group-hover:translate-x-4 transition-transform duration-300">
                            <div className="absolute top-4 right-4 text-brutal-orange text-4xl font-serif">*</div>
                            <div className="flex items-center gap-3 mb-6 text-brutal-orange">
                              <Sparkles className="w-5 h-5" />
                              <span className="text-sm uppercase tracking-[0.2em] font-bold">Untold AI Remediation</span>
                            </div>
                            <div className="prose prose-p:text-brutal-text prose-headings:text-brutal-text max-w-none font-medium text-base prose-pre:bg-brutal-text prose-pre:text-brutal-bg prose-pre:border-2 prose-pre:border-brutal-text prose-pre:rounded-none leading-relaxed whitespace-pre-wrap">
                              {vuln.remediation}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
                
                {/* Full Contract Auto-Remediation Button */}
                {result.vulnerabilities.length > 0 && (
                  <div className="mt-20 flex flex-col items-center border-t-4 border-brutal-text pt-20">
                    <div className="w-full max-w-2xl text-center mb-8">
                      <h3 className="text-4xl md:text-6xl font-bold tracking-tighter text-brutal-text lowercase mb-4">re-engineer <br/> contract *</h3>
                      <p className="text-sm font-bold tracking-[0.2em] uppercase text-brutal-text/70 mb-10 max-w-md mx-auto">Deploy the untold AI protocol to structurally patch all vulnerabilities.</p>
                      
                      <button
                        onClick={handleGenerateSecureCode}
                        disabled={isGenerating}
                        className="brutal-btn w-full text-lg py-5"
                      >
                        {isGenerating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-brutal-bg border-t-transparent rounded-full animate-spin" />
                            re-engineering...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            execute remediation
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Secure Contract Display */}
                    {secureContract && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 w-full p-8 md:p-12 border-4 border-brutal-text bg-brutal-text text-brutal-bg shadow-[16px_16px_0px_0px_rgba(255,69,34,1)] relative overflow-hidden"
                      >
                        <div className="flex items-center gap-4 mb-8 border-b-2 border-brutal-bg/20 pb-6">
                          <ShieldCheck className="w-10 h-10 text-brutal-orange" />
                          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter lowercase">secured <br/> architecture *</h2>
                        </div>
                        <div className="prose max-w-none font-mono text-[13px] md:text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto text-left text-brutal-bg/90">
                          <pre><code className="block text-left">{secureContract}</code></pre>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
                
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
      
      {/* History Sidebar */}
      <HistorySidebar onSelectReport={(report) => {
        setResult(report);
        setInputMode(report.address ? 'address' : 'code');
        setAddress(report.address || '');
        setSourceCode(report.address ? '' : '/* Loaded from history */');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }} />

      {/* AI Security Copilot Chatbot */}
      <Chatbot 
        sourceCode={result ? (sourceCode || address) : ""} 
        vulnerabilities={result ? result.vulnerabilities : []}
        secureCode={result ? secureContract : null}
        hasContext={!!result}
      />
    </main>
  );
}
