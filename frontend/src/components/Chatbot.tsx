"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = "/api";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface ChatbotProps {
  sourceCode: string;
  vulnerabilities: any[];
  secureCode: string | null;
  hasContext?: boolean;
}

export default function Chatbot({ sourceCode, vulnerabilities, secureCode, hasContext = false }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "model", text: "Yo! I'm your Web3 Security AI. Ready to dive deep into the matrix? Drop a contract for a full audit, or hit me up with any smart contract security questions. Let's keep those funds SAFU! 🚀" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasContext) {
      setMessages(prev => {
        const hasAuditMsg = prev.some(m => m.text.includes("Audit complete"));
        if (!hasAuditMsg) {
          return [...prev, { role: "model", text: "Audit complete! I now have full context of the uploaded smart contract and any vulnerabilities. Ask me anything about the results!" }];
        }
        return prev;
      });
    }
  }, [hasContext]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput("");
    
    const newHistory = [...messages, { role: "user" as const, text: userMessage }];
    setMessages(newHistory);
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(1).map(m => ({ role: m.role, text: m.text }));
      
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: historyPayload,
          vulnerabilities: vulnerabilities,
          source_code: sourceCode,
          secure_code: secureCode
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([...newHistory, { role: "model", text: data.reply }]);
      } else {
        setMessages([...newHistory, { role: "model", text: "Sorry, I encountered an error communicating with the AI core." }]);
      }
    } catch (e) {
      setMessages([...newHistory, { role: "model", text: "Network error occurred." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 flex items-center justify-center transition-all ${isOpen ? 'scale-0' : 'scale-100'}`}
        style={{ backgroundColor: '#1C1C1C', color: '#F2F0EB', border: '2px solid #1C1C1C', boxShadow: '6px 6px 0px 0px rgba(28,28,28,1)', zIndex: 99999 }}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[85vh] flex flex-col overflow-hidden"
            style={{ backgroundColor: '#F2F0EB', border: '4px solid #1C1C1C', boxShadow: '12px 12px 0px 0px rgba(255,69,34,1)', zIndex: 100000 }}
          >
            {/* Header */}
            <div className="p-5 flex items-center justify-between" style={{ backgroundColor: '#1C1C1C', borderBottom: '4px solid #1C1C1C' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: '#FF4522', border: '2px solid #F2F0EB' }}>
                  <Bot className="w-5 h-5" style={{ color: '#F2F0EB' }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-[0.2em] uppercase" style={{ color: '#F2F0EB' }}>Security Copilot</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 animate-pulse" style={{ backgroundColor: '#10B981', border: '1px solid #F2F0EB' }}></div>
                    <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'rgba(242,240,235,0.8)' }}>Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 transition-colors" style={{ backgroundColor: '#F2F0EB', color: '#1C1C1C', border: '2px solid #F2F0EB' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6" style={{ backgroundColor: '#F2F0EB' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className="max-w-[85%] p-4 text-[13px] font-mono leading-relaxed whitespace-pre-wrap"
                    style={msg.role === 'user' 
                      ? { backgroundColor: '#1C1C1C', color: '#F2F0EB', border: '2px solid #1C1C1C', boxShadow: '4px 4px 0px 0px rgba(255,69,34,1)' }
                      : { backgroundColor: '#F2F0EB', color: '#1C1C1C', border: '2px solid #1C1C1C', boxShadow: '4px 4px 0px 0px rgba(28,28,28,1)' }
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="p-4 flex items-center gap-2" style={{ backgroundColor: '#F2F0EB', border: '2px solid #1C1C1C', boxShadow: '4px 4px 0px 0px rgba(28,28,28,1)' }}>
                    <div className="w-2 h-2 animate-pulse" style={{ backgroundColor: '#1C1C1C' }}></div>
                    <div className="w-2 h-2 animate-pulse" style={{ backgroundColor: '#1C1C1C', animationDelay: '-0.15s' }}></div>
                    <div className="w-2 h-2 animate-pulse" style={{ backgroundColor: '#1C1C1C', animationDelay: '-0.3s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4" style={{ backgroundColor: '#1C1C1C', borderTop: '4px solid #1C1C1C' }}>
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ASK IN NATIVE TONGUE..."
                  className="flex-1 px-4 py-3 text-sm font-bold tracking-[0.1em] focus:outline-none transition-colors uppercase"
                  style={{ backgroundColor: '#F2F0EB', color: '#1C1C1C', border: '2px solid #F2F0EB' }}
                />
                <button 
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-12 h-12 flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: '#FF4522', color: '#F2F0EB', border: '2px solid #F2F0EB' }}
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
