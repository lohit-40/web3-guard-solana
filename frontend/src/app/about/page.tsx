"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Cpu, Code2, ArrowRight } from "lucide-react";

export default function About() {
  return (
    <main className="relative min-h-screen w-full">
      <div className="relative z-10 w-full min-h-screen flex flex-col px-6 md:px-24 pt-40 pb-20 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto w-full">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-16 border-b-4 border-brutal-text pb-12"
          >
            <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-brutal-text lowercase mb-6">
              about <br/> web3 | guard *
            </h1>
            <p className="text-lg md:text-xl text-brutal-text font-bold leading-relaxed max-w-2xl uppercase tracking-[0.2em]">
              An advanced, AI-powered smart contract vulnerability scanner built for next-generation blockchain security.
            </p>
          </motion.div>

          <div className="grid gap-8">
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="p-8 md:p-12 border-4 border-brutal-text bg-brutal-bg hover:bg-brutal-text hover:text-brutal-bg transition-colors group shadow-[12px_12px_0px_0px_rgba(28,28,28,1)]"
            >
              <div className="flex items-center gap-6 mb-6 text-brutal-text group-hover:text-brutal-bg">
                <div className="p-4 bg-brutal-text border-2 border-brutal-text group-hover:bg-brutal-bg group-hover:border-brutal-bg transition-colors">
                  <Cpu className="w-8 h-8 text-brutal-bg group-hover:text-brutal-text" />
                </div>
                <h2 className="text-3xl font-bold tracking-tighter lowercase">Gemini AI Engine</h2>
              </div>
              <p className="text-brutal-text/80 group-hover:text-brutal-bg/90 leading-relaxed font-medium text-lg">
                Unlike traditional static analyzers that rely on rigid regex rules, Web3 Guard uses a fine-tuned Gemini 2.5 LLM to completely understand the architectural context of your Solidity code, detecting complex, multi-line vulnerabilities like reentrancy and access control flaws with human-level reasoning.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="p-8 md:p-12 border-4 border-brutal-text bg-brutal-bg hover:bg-brutal-text hover:text-brutal-bg transition-colors group shadow-[12px_12px_0px_0px_rgba(28,28,28,1)]"
            >
              <div className="flex items-center gap-6 mb-6 text-brutal-text group-hover:text-brutal-bg">
                <div className="p-4 bg-brutal-text border-2 border-brutal-text group-hover:bg-brutal-bg group-hover:border-brutal-bg transition-colors">
                  <Code2 className="w-8 h-8 text-brutal-bg group-hover:text-brutal-text" />
                </div>
                <h2 className="text-3xl font-bold tracking-tighter lowercase">Automated Remediation</h2>
              </div>
              <p className="text-brutal-text/80 group-hover:text-brutal-bg/90 leading-relaxed font-medium text-lg">
                Identifying a bug is only half the battle. Our AI engine natively rewrites your deployed code into secure implementations using industry standards (like the Checks-Effects-Interactions pattern), seamlessly displayed in the main dashboard.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="p-8 md:p-12 border-4 border-brutal-text bg-brutal-bg hover:bg-brutal-text hover:text-brutal-bg transition-colors group shadow-[12px_12px_0px_0px_rgba(28,28,28,1)]"
            >
              <div className="flex items-center gap-6 mb-6 text-brutal-text group-hover:text-brutal-bg">
                <div className="p-4 bg-brutal-text border-2 border-brutal-text group-hover:bg-brutal-bg group-hover:border-brutal-bg transition-colors">
                  <ShieldCheck className="w-8 h-8 text-brutal-bg group-hover:text-brutal-text" />
                </div>
                <h2 className="text-3xl font-bold tracking-tighter lowercase">Proof of Audit</h2>
              </div>
              <p className="text-brutal-text/80 group-hover:text-brutal-bg/90 leading-relaxed font-medium text-lg">
                Trust is verified on-chain. Every completed vulnerability scan generates a cryptographic SHA-256 hash that is autonomously pushed to a custom `ProofOfAudit.sol` smart contract on the Ethereum Sepolia network, letting users explicitly prove their contract was audited.
              </p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-16 flex items-center justify-between border-t-4 border-brutal-text pt-8 flex-wrap gap-6"
          >
            <div>
              <p className="text-brutal-text font-bold text-sm uppercase tracking-[0.2em] mb-3">Final Year Project</p>
              <div className="flex items-center gap-4">
                <a href="https://x.com/LohitMishr_a" target="_blank" rel="noopener noreferrer" className="px-4 py-2 border-2 border-brutal-text hover:bg-brutal-orange hover:text-brutal-bg hover:border-brutal-orange transition-colors font-bold uppercase tracking-widest text-xs">
                  [x]
                </a>
                <a href="https://www.linkedin.com/in/lohit-mishra-840640200/" target="_blank" rel="noopener noreferrer" className="px-4 py-2 border-2 border-brutal-text hover:bg-brutal-orange hover:text-brutal-bg hover:border-brutal-orange transition-colors font-bold uppercase tracking-widest text-xs">
                  [in]
                </a>
                <a href="https://github.com/lohit-40" target="_blank" rel="noopener noreferrer" className="px-4 py-2 border-2 border-brutal-text hover:bg-brutal-orange hover:text-brutal-bg hover:border-brutal-orange transition-colors font-bold uppercase tracking-widest text-xs">
                  [git]
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 text-brutal-text font-bold text-sm uppercase tracking-[0.2em] hover:text-brutal-orange transition-colors">
              Powered by Next.js & FastAPI <ArrowRight className="w-5 h-5" />
            </div>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
