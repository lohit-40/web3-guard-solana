"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, FileCode2, ArrowLeft, Sparkles, Link as LinkIcon, Download } from "lucide-react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  audit_chain?: string;
  solana_explorer_url?: string;
  stellar_explorer_url?: string;
  soroban_contract_id?: string;
  soroban_proof_id?: number;
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

  const handleDownloadPDF = () => {
    if (!result) return;
    const content = `WEB3 GUARD - SECURITY AUDIT REPORT
Target: ${result.address}
Status: ${result.vulnerabilities.length === 0 ? "SECURE" : "VULNERABLE"}
Date: ${new Date().toUTCString()}

${result.vulnerabilities.length} Alerts Found:
${result.vulnerabilities.map(v => `- [${v.severity}] ${v.type} (Line ${v.line_number || "N/A"})\n  ${v.description}`).join('\n\n')}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${result.address.slice(0, 8)}.txt`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#1C1C1C] flex items-center justify-center p-6 font-mono">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1C1C1C] tracking-[0.2em] text-sm uppercase font-bold">Initializing Report...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#1C1C1C] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border-4 border-[#1C1C1C] shadow-[8px_8px_0px_0px_rgba(28,28,28,1)] p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-[#FF4522] mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-bold mb-4 tracking-tighter lowercase">Audit Not Found</h2>
          <p className="text-[#1C1C1C]/60 text-sm mb-8 font-mono">{error}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1C1C1C] text-white text-sm font-bold tracking-[0.2em] uppercase hover:bg-[#FF4522] transition-colors">
            <ArrowLeft className="w-4 h-4" /> run new scan
          </Link>
        </div>
      </div>
    );
  }

  const isSecure = result.vulnerabilities.length === 0;
  const hasValidTxHash = result.audit_tx_hash && result.audit_tx_hash !== 'pending_user_signature';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1C1C1C] selection:bg-[#FF4522]/30 font-sans relative overflow-hidden flex flex-col items-center">
      <Toaster 
        toastOptions={{
          style: {
            borderRadius: '0',
            background: '#1C1C1C',
            color: '#FAFAFA',
            border: '2px solid #1C1C1C',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '0.1em'
          },
        }} 
      />

      {/* Decorative brutalist elements */}
      <div className="absolute top-0 right-0 w-64 h-64 border-l-4 border-b-4 border-[#1C1C1C] opacity-5 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 border-t-4 border-r-4 border-[#1C1C1C] opacity-5 pointer-events-none" />
      
      <main className="w-full max-w-[1400px] mx-auto px-4 md:px-8 xl:px-16 py-12 md:py-24 relative z-10 flex flex-col items-center">
        
        {/* Navigation */}
        <div className="w-full max-w-4xl mb-16 flex justify-start">
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#1C1C1C] text-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#FAFAFA] transition-all text-xs tracking-[0.2em] font-bold uppercase">
            <ArrowLeft className="w-4 h-4" /> run new scan
          </Link>
        </div>

        <div className="w-full max-w-4xl relative">
          {/* Brutalist Report Output */}
          <div className="border-t-4 border-[#1C1C1C] pt-16 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
              <div>
                <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-[#1C1C1C] lowercase mb-4">audit <br/> report *</h2>
                <p className="text-[#1C1C1C]/60 font-mono text-sm tracking-widest bg-[#1C1C1C]/5 inline-block px-4 py-2 break-all">{result.address}</p>
                
                <div className="flex flex-wrap items-center gap-4 mt-6">
                  {hasValidTxHash && (
                    <a 
                      href={
                        result.audit_chain === 'solana'
                          ? (result.solana_explorer_url || \`https://explorer.solana.com/tx/\${result.audit_tx_hash}?cluster=devnet\`)
                          : result.audit_chain === 'stellar'
                          ? (result.stellar_explorer_url || \`https://stellar.expert/explorer/testnet/tx/\${result.audit_tx_hash}\`)
                          : \`https://sepolia.etherscan.io/tx/\${result.audit_tx_hash}\`
                      } 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={\`inline-flex items-center gap-2 px-6 py-3 border-2 text-xs tracking-[0.2em] font-bold uppercase w-max transition-all \${
                        result.audit_chain === 'solana'
                          ? 'border-[#9945FF] bg-[#9945FF] text-white hover:bg-transparent hover:text-[#9945FF]'
                          : result.audit_chain === 'stellar'
                          ? 'border-[#08B5E5] bg-[#08B5E5] text-white hover:bg-transparent hover:text-[#08B5E5]'
                          : 'border-[#1C1C1C] bg-[#1C1C1C] text-[#FAFAFA] hover:bg-transparent hover:text-[#1C1C1C]'
                      }\`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {result.audit_chain === 'solana' ? 'solana verified' : result.audit_chain === 'stellar' ? 'stellar verified' : 'blockchain verified'}
                    </a>
                  )}
                  
                  <button
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#1C1C1C] text-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#FAFAFA] transition-all text-xs tracking-[0.2em] font-bold uppercase"
                  >
                    <Download className="w-4 h-4" />
                    export txt
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Shareable link copied to clipboard!");
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#FF4522] text-[#FF4522] hover:bg-[#FF4522] hover:text-[#FAFAFA] transition-all text-xs tracking-[0.2em] font-bold uppercase"
                  >
                    <LinkIcon className="w-4 h-4" />
                    copy link
                  </button>

                  {!hasValidTxHash && (
                    <div className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#10B981]/30 text-[#10B981]/80 cursor-default transition-all text-xs tracking-[0.2em] font-bold uppercase bg-[#10B981]/5">
                      <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                      <span className="text-[#10B981]">stored on chain (native)</span>
                    </div>
                  )}
                </div>
              </div>
              
              {result.vulnerabilities.length === 0 ? (
                <div className="flex items-center gap-3 px-8 py-4 border-2 border-[#10B981] bg-[#10B981]/10 text-[#10B981]">
                  <ShieldCheck className="w-6 h-6" />
                  <span className="text-sm tracking-[0.2em] font-bold uppercase">secure</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-8 py-4 border-2 border-[#FF4522] bg-[#FF4522]/10 text-[#FF4522]">
                  <ShieldAlert className="w-6 h-6" />
                  <span className="text-sm tracking-[0.2em] font-bold uppercase">vulnerable</span>
                </div>
              )}
            </div>

            {result.vulnerabilities.length === 0 ? (
              <div className="w-full aspect-[21/9] flex items-center justify-center border-4 border-[#1C1C1C] bg-transparent relative">
                 <span className="absolute -top-6 -left-4 text-7xl text-[#10B981] font-serif">*</span>
                <p className="text-[#1C1C1C] font-medium text-2xl tracking-tighter">contract isolated. no severe exploits discovered.</p>
              </div>
            ) : (
              <div className="grid gap-6 border-l-4 border-[#1C1C1C] pl-4 md:pl-10">
                {result.vulnerabilities.map((vuln, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    key={idx} 
                    className="group flex flex-col p-8 md:p-12 border-2 border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#FAFAFA] transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between mb-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-6 mb-6">
                          <span className={\`px-4 py-2 text-xs uppercase tracking-[0.2em] font-bold border-2 \${
                            vuln.severity === 'High' ? 'border-[#FF4522] text-[#FF4522]' : 
                            vuln.severity === 'Medium' ? 'border-yellow-600 text-yellow-600' : 
                            'border-blue-600 text-blue-600'
                          } group-hover:border-[#FAFAFA] group-hover:text-[#FAFAFA]\`}>
                            {vuln.severity} Risk
                          </span>
                          <h3 className="text-3xl md:text-5xl font-medium tracking-tighter lowercase">{vuln.type}</h3>
                        </div>
                        <p className="font-medium leading-relaxed max-w-3xl text-lg opacity-80 group-hover:opacity-100">
                          {vuln.description}
                        </p>
                      </div>
                      {vuln.line_number && (
                        <div className="mt-8 md:mt-0 flex flex-col md:items-end pb-4 border-b-2 border-[#1C1C1C]/20 md:border-b-0 md:pl-8 md:border-l-2 group-hover:border-[#FAFAFA]/30">
                          <span className="text-xs uppercase tracking-[0.2em] mb-2 font-bold opacity-50">Line Num</span>
                          <span className="text-6xl font-bold font-mono">.{vuln.line_number}</span>
                        </div>
                      )}
                    </div>

                    {/* AI Remediation Engine Display */}
                    {vuln.remediation && (
                      <div className="mt-8 p-6 lg:p-10 border-2 border-[#1C1C1C] bg-[#FAFAFA] text-[#1C1C1C] relative group-hover:border-[#FAFAFA] group-hover:translate-x-4 transition-transform duration-300">
                        <div className="absolute top-4 right-4 text-[#FF4522] text-4xl font-serif">*</div>
                        <div className="flex items-center gap-3 mb-6 text-[#FF4522]">
                          <Sparkles className="w-5 h-5" />
                          <span className="text-sm uppercase tracking-[0.2em] font-bold">Untold AI Remediation</span>
                        </div>
                        <div className="prose prose-p:text-[#1C1C1C] prose-headings:text-[#1C1C1C] max-w-none font-medium text-base prose-pre:bg-[#1C1C1C] prose-pre:text-[#FAFAFA] prose-pre:border-2 prose-pre:border-[#1C1C1C] prose-pre:rounded-none leading-relaxed whitespace-pre-wrap">
                          {vuln.remediation}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
