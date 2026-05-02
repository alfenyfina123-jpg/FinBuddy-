import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Sparkles, MessageSquare, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiResponse } from '../services/geminiService';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function BusinessAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Halo! Saya asisten FinBuddy Anda. Apa yang bisa saya bantu untuk bisnis Anda hari ini?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Gather some context about the business
      let businessContext = '';
      if (auth.currentUser) {
        try {
          const transSnap = await getDocs(query(
            collection(db, 'transactions'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('date', 'desc'),
            limit(20)
          ));
          const lastTrans = transSnap.docs.map(d => d.data() as Transaction);
          
          const prodSnap = await getDocs(query(
            collection(db, 'products'),
            where('userId', '==', auth.currentUser.uid),
            limit(20)
          ));
          const prods = prodSnap.docs.map(d => d.data() as Product);

          businessContext = `
            Context Bisnis Saat Ini:
            - Jumlah Transaksi Terakhir: ${lastTrans.length}
            - Contoh Produk: ${prods.slice(0, 3).map(p => p.name).join(', ')}
            - Ringkasan Terakhir: ${lastTrans.slice(0, 5).map(t => `${t.description}: ${formatCurrency(t.amount)}`).join('; ')}
          `;
        } catch (ctxError) {
          console.warn("Failed to gather business context:", ctxError);
        }
      }

      const prompt = `
        Anda adalah FinBuddy AI, asisten keuangan cerdas untuk bisnis UMKM.
        Berikan saran profesional dan ringkas dalam Bahasa Indonesia.
        Gunakan format Markdown jika diperlukan.
        
        ${businessContext}
        
        Chat History Sebelumnya:
        ${messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}
        
        User's Query: ${input}
      `;

      const aiText = await getGeminiResponse(prompt) || "Maaf, saya sedang mengalami kendala teknis.";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessage = error.message || 'Gagal menghubungi asisten.';
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${errorMessage}\n\nPastikan koneksi internet stabil dan API Key sudah dikonfigurasi dengan benar di server.` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-100/50 overflow-hidden relative">
      {/* Header */}
      <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Asisten Cerdas</h3>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3 fill-current" /> AI Assistant Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
           <p className="text-[10px] font-black text-slate-400">Gemini Pro 3.1</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                m.role === 'user' ? "bg-slate-900 text-white" : "bg-indigo-600 text-white"
              )}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "p-5 rounded-3xl shadow-sm",
                m.role === 'user' 
                  ? "bg-slate-900 text-white rounded-tr-none" 
                  : "bg-white border border-slate-50 text-slate-700 rounded-tl-none font-medium"
              )}>
                <div className="markdown-body text-sm leading-relaxed">
                   <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white border border-slate-50 p-5 rounded-3xl rounded-tl-none flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-8 border-t border-slate-50 bg-white shrink-0">
        <form onSubmit={handleSend} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan sesuatu tentang pertumbuhan bisnis Anda..."
            className="w-full pl-6 pr-16 py-5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-3xl focus:bg-white outline-none transition-all font-bold text-sm shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:scale-[1.05] active:scale-[0.95] transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:scale-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Saran Pertanyaan:</p>
           {['Cara naikkan profit?', 'Analisis stok saya', 'Tips bayar pajak'].map(s => (
             <button 
                key={s} 
                onClick={() => setInput(s)}
                className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[9px] font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-100"
             >
               {s}
             </button>
           ))}
        </div>
      </div>
    </div>
  );
}
