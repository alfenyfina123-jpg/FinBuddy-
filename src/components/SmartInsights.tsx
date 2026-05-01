import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Target, Zap, Loader2, RefreshCw, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

interface InsightMessage {
  title: string;
  type: 'action' | 'warning' | 'opportunity';
  content: string;
  impact: string;
}

export default function SmartInsights({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [report, setReport] = useState<InsightMessage[] | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('date', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const transContext = snap.docs.map(doc => {
        const d = doc.data() as Transaction;
        return `${d.date}: ${d.type === 'income' ? 'IN' : 'OUT'} ${d.amount} - ${d.category} - ${d.description}`;
      }).join('\n');

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      const prompt = `Analisis data keuangan UMKM berikut dan berikan 3 poin wawasan strategis dalam format JSON array.
      Data Transaksi:
      ${transContext}

      Output harus berupa JSON array STRICT dengan interface ini:
      Array<{ title: string, type: 'action' | 'warning' | 'opportunity', content: string, impact: string }>
      
      Bahasa: Indonesia Profesional. Jangan berikan teks lain selain JSON.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const text = result.text || '[]';
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']') + 1;
      const jsonStr = jsonStart !== -1 ? text.substring(jsonStart, jsonEnd) : '[]';
      setReport(JSON.parse(jsonStr));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="bg-[#1e1b4b] p-10 md:p-14 rounded-[3rem] relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
         <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/20 blur-[100px] rounded-full pointer-events-none" />
         
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
               <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                    <Sparkles className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.4em]">Proprietary AI v.3.0</span>
               </div>
               <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter font-display leading-tight mb-4">Wawasan Bisnis Otomatis</h3>
               <p className="text-indigo-200/60 font-bold text-lg leading-relaxed uppercase tracking-widest text-xs">AI akan membedah histori transaksi Anda untuk menemukan peluang tersembunyi.</p>
            </div>
            
            <button 
              onClick={generateInsights}
              disabled={loading}
              className="px-10 py-5 bg-white text-indigo-950 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center gap-3 disabled:opacity-50 group cursor-pointer"
            >
              {loading ? (
                 <>
                   <RefreshCw className="w-5 h-5 animate-spin" />
                   Sedang Berpikir...
                 </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                   Generate Analitik
                </>
              )}
            </button>
         </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
           {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-[2.5rem]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {report?.map((section, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={idx}
              className={cn(
                "p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-xl flex flex-col justify-between group h-full",
                section.type === 'action' ? "bg-indigo-50 border-indigo-100" : 
                section.type === 'warning' ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
              )}
            >
              <div>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg",
                  section.type === 'action' ? "bg-indigo-600 shadow-indigo-100" : 
                  section.type === 'warning' ? "bg-rose-600 shadow-rose-100" : "bg-emerald-600 shadow-emerald-100"
                )}>
                  {section.type === 'action' ? <Target className="w-6 h-6" /> : 
                   section.type === 'warning' ? <AlertCircle className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                </div>
                <h4 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-display mb-3">{section.title}</h4>
                <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">{section.content}</p>
              </div>

              <div className="pt-6 border-t border-slate-900/5 mt-auto">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Estimasi Dampak</p>
                <div className="flex items-center gap-2 mb-6">
                   <div className={cn(
                     "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                     section.type === 'action' ? "bg-indigo-100 text-indigo-700" : 
                     section.type === 'warning' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                   )}>
                     {section.impact}
                   </div>
                </div>
                <button 
                  onClick={() => {
                    const prompt = `Saya ingin tahu lebih detail tentang wawasan ini: "${section.title}". 
                    
Wawasan: ${section.content}
Dampak: ${section.impact}

Apa rekomendasi tindakan langkah-demi-langkah yang harus saya ambil?`;
                    localStorage.setItem('ai_pending_prompt', prompt);
                    setActiveTab('aiAssistant');
                  }}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2",
                    section.type === 'action' ? "bg-indigo-600 text-white hover:bg-slate-900" : 
                    section.type === 'warning' ? "bg-rose-600 text-white hover:bg-slate-900" : "bg-emerald-600 text-white hover:bg-slate-900"
                  )}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {section.type === 'action' ? 'Jalankan Aksi Ini' : 'Konsultasi Detail'}
                </button>
              </div>
            </motion.div>
          ))}
          {!report && !loading && (
             <div className="col-span-full py-20 text-center">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Klik tombol di atas untuk memulai analisis</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
