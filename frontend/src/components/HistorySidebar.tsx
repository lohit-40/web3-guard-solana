"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, X, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";

interface HistorySidebarProps {
  onSelectReport: (report: any) => void;
}

export default function HistorySidebar({ onSelectReport }: HistorySidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = () => {
    const saved = localStorage.getItem('web3guard_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 left-6 w-16 h-16 flex items-center justify-center transition-all ${isOpen ? 'scale-0' : 'scale-100'}`}
        style={{ backgroundColor: '#1C1C1C', color: '#F2F0EB', border: '2px solid #1C1C1C', boxShadow: '6px 6px 0px 0px rgba(28,28,28,1)', zIndex: 99999 }}
        title="Audit History"
      >
        <History className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* FULL OPAQUE BACKDROP */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0"
              style={{ backgroundColor: '#F2F0EB', zIndex: 99999 }}
            />
            {/* Sidebar Panel */}
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-full max-w-sm flex flex-col"
              style={{ backgroundColor: '#F2F0EB', borderRight: '4px solid #1C1C1C', boxShadow: '20px 0px 0px 0px rgba(255,69,34,1)', zIndex: 100000 }}
            >
              {/* Header */}
              <div className="p-8 flex items-center justify-between" style={{ backgroundColor: '#1C1C1C', borderBottom: '4px solid #1C1C1C' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: '#FF4522', border: '2px solid #F2F0EB' }}>
                    <History className="w-5 h-5" style={{ color: '#F2F0EB' }} />
                  </div>
                  <h2 className="font-bold tracking-[0.2em] uppercase text-xl" style={{ color: '#F2F0EB' }}>History</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 transition-colors" style={{ backgroundColor: '#F2F0EB', color: '#1C1C1C', border: '2px solid #F2F0EB' }}>
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundColor: '#F2F0EB' }}>
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48" style={{ color: '#1C1C1C', border: '2px dashed rgba(28,28,28,0.3)' }}>
                    <History className="w-10 h-10 opacity-40 mb-4" />
                    <p className="font-bold tracking-[0.2em] uppercase text-sm">Empty Archive</p>
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => {
                        onSelectReport(item);
                        setIsOpen(false);
                      }}
                      className="p-6 transition-all group cursor-pointer hover:translate-y-1 hover:translate-x-1"
                      style={{ backgroundColor: '#F2F0EB', color: '#1C1C1C', border: '2px solid #1C1C1C', boxShadow: '4px 4px 0px 0px rgba(28,28,28,1)' }}
                    >
                      <div className="flex justify-between items-start mb-4 pb-3" style={{ borderBottom: '2px solid rgba(28,28,28,0.1)' }}>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        {item.vulnerabilities?.length > 0 ? (
                          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold" style={{ color: '#FF4522' }}>
                            <AlertTriangle className="w-4 h-4" />
                            {item.vulnerabilities.length} Flaws
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold" style={{ color: '#10B981' }}>
                            <CheckCircle className="w-4 h-4" />
                            Clean
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold font-mono truncate max-w-[85%]">
                          {item.address || "Raw Source Code"}
                        </p>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
