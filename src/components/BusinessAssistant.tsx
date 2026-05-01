import { useState, useRef, useEffect, FormEvent } from 'react';
import { Send, Bot, User, Sparkles, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

const RECOMMENDED_QUESTIONS = [
  "Bagaimana kesehatan keuangan saya hari ini?",
  "Beri saya 3 ide peningkatan profit minggu ini.",
  "Apakah ada pengeluaran yang mencurigakan?",
  "Apa strategi terbaik untuk stok inventori saya?",
  "Analisis arus kas saya untuk 7 hari ke depan."
];

export default function BusinessAssistant() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const pendingPrompt = localStorage.getItem('ai_pending_prompt');
    if (pendingPrompt && !loading) {
      localStorage.removeItem('ai_pending_prompt');
      processPrompt(pendingPrompt);
    }
  }, []);

  const processPrompt = async (userMessage: string) => {
    if (!userMessage.trim() || !auth.currentUser) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Get recent transactions for context
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('date', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const transContext = snap.docs.map(doc => {
        const d = doc.data() as Transaction;
        return `${d.date}: ${d.type === 'income' ? 'Masuk' : 'Keluar'} Rp${d.amount} - ${d.description}`;
      }).join('\n');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      // Create conversation history string
      const chatHistory = messages.slice(-6).map(m => 
        `${m.role === 'user' ? 'User' : 'FinBuddy AI'}: ${m.content}`
      ).join('\n\n');

      const prompt = `
        Anda adalah FinBuddy AI, asisten bisnis profesional dan konsultan keuangan untuk UMKM Indonesia.
        
        DATA TRANSAKSI TERKINI:
        ${transContext}

        RIWAYAT PERCAKAPAN:
        ${chatHistory}

        PERTANYAAN TERBARU USER: ${userMessage}
        
        Aturan Jawaban:
        1. Anda harus konsisten dengan konteks percakapan sebelumnya.
        2. Gunakan format Markdown yang rapi (bold, bullet points, headers).
        3. Berikan jawaban yang taktis, ramah, dan solutif dalam Bahasa Indonesia profesional.
        4. Fokus pada efisiensi arus kas, pertumbuhan bisnis, dan langkah konkret yang bisa diambil hari ini.
        5. Jika ada data transaksi yang mencurigakan atau pengeluaran besar, highlight dengan jelas.
        6. Akhiri dengan satu pertanyaan follow-up untuk memancing diskusi strategis lebih lanjut.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const responseText = response.text || 'Maaf, saya tidak dapat memberikan saran saat ini.';
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, saya sedang mengalami kendala koneksi dengan otak AI saya. Silakan coba sesaat lagi.' }]);
    } finally {
      setLoading(false);
    }
  };

  const generateResponse = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    await processPrompt(msg);
  };

  return (
    <div className="flex flex-col h-[700px] bg-white/60 backdrop-blur-md rounded-[3rem] border border-white shadow-2xl relative overflow-hidden">
      <div className="p-8 md:p-10 border-b border-slate-50 flex items-center justify-between bg-white/40 backdrop-blur-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Bot className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Asisten FinBuddy</h3>
            <div className="flex items-center gap-2 mt-1">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active & Thinking</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages([])} 
          className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          title="Bersihkan Percakapan"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 md:p-10 space-y-8 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-indigo-400" />
             </div>
             <p className="text-xl font-black text-slate-900 tracking-tighter uppercase font-display">Tanya Apapun Tentang Bisnis Anda</p>
             <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] max-w-xs leading-relaxed">AI akan menganalisis histori transaksi Anda untuk memberikan jawaban spesifik.</p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={cn(
                "flex flex-col max-w-[85%]",
                m.role === 'user' ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "p-5 md:p-6 rounded-[2rem] text-sm font-medium leading-relaxed shadow-sm",
                m.role === 'user' ? "bg-slate-900 text-white rounded-tr-none" : "bg-white border border-slate-50 text-slate-700 rounded-tl-none"
              )}>
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <div className="markdown-body">
                    <Markdown>{m.content}</Markdown>
                  </div>
                )}
              </div>
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-2 px-2">
                {m.role === 'user' ? 'Pertanyaan Anda' : 'Respon FinBuddy AI'}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex flex-col items-start max-w-[80%]">
             <div className="p-6 bg-white border border-slate-50 rounded-[2rem] rounded-tl-none flex items-center gap-3">
               <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic animate-pulse">Menghitung Strategi...</p>
             </div>
          </div>
        )}

        {!loading && messages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 py-4"
          >
            {RECOMMENDED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => processPrompt(q)}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-100/50 shadow-sm"
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="p-8 md:p-10 bg-white/40 backdrop-blur-lg border-t border-slate-50 sticky bottom-0 z-10 shrink-0">
        <form onSubmit={generateResponse} className="relative group">
          <input 
            type="text" 
            placeholder="Bagaimana cara meningkatkan profit bulan ini?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="w-full pl-8 pr-16 py-5 bg-white border-2 border-slate-50 focus:border-indigo-100 rounded-[1.5rem] md:rounded-3xl outline-none transition-all font-bold text-sm shadow-xl shadow-slate-100/50 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white flex items-center justify-center rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-indigo-200 cursor-pointer"
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
