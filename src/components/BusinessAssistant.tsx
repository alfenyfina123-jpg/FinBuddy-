import { useState, useRef, useEffect, FormEvent } from 'react';
import { Send, Bot, User, Sparkles, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function BusinessAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      content: 'Halo! Saya Asisten Bisnis AI Anda. Saya bisa membantu Anda menganalisis keuangan, strategi penjualan, atau menjawab pertanyaan seputar usaha Anda. Ada yang bisa saya bantu hari ini?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialQuery = localStorage.getItem('ai_assistant_initial_query');
    if (initialQuery) {
      localStorage.removeItem('ai_assistant_initial_query');
      submitMessage(initialQuery);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const submitMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // 1. Fetch relevant business data context
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', auth.currentUser?.uid),
        orderBy('date', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const recentTransactions = snapshot.docs.map(doc => doc.data() as Transaction);
      
      const context = `
        Identitas Usaha: ${auth.currentUser?.displayName}
        Data 20 Transaksi Terakhir:
        ${recentTransactions.map(t => `- ${t.date}: ${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${formatCurrency(t.amount)} (${t.category}: ${t.description}) ${t.customerName ? `Pelanggan: ${t.customerName}` : ''}`).join('\n')}
      `;

      // 2. Call Gemini
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `Anda adalah "Asisten Bisnis FinBuddy", asisten AI yang cerdas, profesional, dan empatik untuk para pengusaha modern. 
          Tugas Anda adalah membantu mereka memahami keuangan, memberikan saran strategi bisnis, dan menjawab pertanyaan operasional.
          Gunakan bahasa Indonesia yang ramah namun berwibawa.
          Berikut adalah konteks bisnis pengguna saat ini: ${context}.
          Jika ditanya tentang data keuangan, gunakan konteks di atas. Jika data tidak ada, sampaikan dengan jujur.
          Berikan solusi yang praktis dan mudah dimengerti.`,
        }
      });

      const aiText = response.text || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini.';
      setMessages(prev => [...prev, { role: 'model', content: aiText }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Terjadi kesalahan sistem. Pastikan koneksi internet Anda stabil atau coba lagi nanti.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white ring-4 ring-indigo-50">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Asisten Bisnis AI</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sistem Pintar Aktif</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages([{ role: 'model', content: 'Riwayat chat telah dibersihkan. Apa yang ingin Anda diskusikan?' }])}
          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
          title="Hapus Chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex gap-4 max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                m.role === 'model' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600"
              )}>
                {m.role === 'model' ? <Sparkles className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                m.role === 'model' 
                  ? "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100" 
                  : "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100"
              )}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-4 max-w-[80%]">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-slate-50 border-t border-slate-100">
        <form onSubmit={handleSend} className="relative">
          <input 
            type="text" 
            placeholder="Tanyakan sesuatu tentang bisnis Anda..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="w-full pl-6 pr-20 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all text-sm font-medium"
          />
          <button 
            disabled={!input.trim() || loading}
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-indigo-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center gap-2 mt-3 px-2">
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Didukung oleh Gemini 3 Intelligence</p>
        </div>
      </div>
    </div>
  );
}
