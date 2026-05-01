import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Target, Zap, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

interface InsightSection {
  title: string;
  content: string;
  type: 'neutral' | 'positive' | 'negative' | 'action';
}

export default function SmartInsights({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<InsightSection[] | null>(null);

  const handleConsultation = (title: string, content: string) => {
    // We can store the initial question in localStorage to be picked up by the Assistant
    localStorage.setItem('ai_assistant_initial_query', `Saya ingin berkonsultasi mengenai hasil analisis: "${title}"\n\nDetail: ${content}\n\nApa saran Anda mengenai poin ini?`);
    setActiveTab('aiAssistant');
  };

  const performAnalysis = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      // 1. Fetch transactions for the current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', auth.currentUser.uid),
        where('date', '>=', firstDay),
        orderBy('date', 'desc')
      );
      
      const snap = await getDocs(q);
      const transactions = snap.docs.map(doc => doc.data() as Transaction);

      const income = transactions.filter(t => t.type === 'income');
      const expense = transactions.filter(t => t.type === 'expense');
      const totalIncome = income.reduce((a, b) => a + b.amount, 0);
      const totalExpense = expense.reduce((a, b) => a + b.amount, 0);

      const dataStr = transactions.map(t => `${t.date}: ${t.type} ${t.amount} (${t.category})`).join('\n');

      // 2. Call Gemini for Analysis
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analisis data berikut untuk bulan ini:
        Total Pemasukan: ${totalIncome}
        Total Pengeluaran: ${totalExpense}
        Daftar Transaksi:
        ${dataStr}
        
        Keluarkan 4 section utama: ringkasan performa, highlight positif, titik kritis, dan rencana aksi strategis.`,
        config: {
          systemInstruction: `Anda adalah Analis Bisnis Senior AI. Tugas Anda adalah melakukan bedah keuangan bulanan untuk bisnis pengguna.
          Berikan report dalam format JSON (array of objects) dengan field: title, content, type (neutral|positive|negative|action).
          Fokus pada: Tren pendapatan, Efisiensi biaya, dan Rekomendasi konkret ke depan.
          Gunakan bahasa yang tajam, akurat, dan memotivasi.`,
          responseMimeType: "application/json",
        }
      });

      const text = response.text || '[]';
      // Clean potential markdown code blocks
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        setReport(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse AI response:', cleaned);
        setReport([{
          title: 'Analisis Gagal',
          content: 'Maaf, AI tidak dapat menghasilkan format data yang valid saat ini. Silakan coba lagi.',
          type: 'negative'
        }]);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performAnalysis();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group">
        <div className="relative z-10 lg:w-2/3">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <Sparkles className="w-3 h-3" />
            AI Intelligence Suite
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-4 leading-[1.1]">Analitik Cerdas & Strategi Bisnis</h2>
          <p className="text-slate-400 font-medium text-lg leading-relaxed">
            AI kami memproses setiap transaksi untuk menemukan peluang yang tersembunyi. Dapatkan laporan strategis dalam hitungan detik.
          </p>
          <button 
            disabled={loading}
            onClick={performAnalysis}
            className="mt-8 flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Jalankan Ulang Analisis
          </button>
        </div>
        <div className="absolute top-0 right-0 w-1/3 h-full overflow-hidden opacity-20 pointer-events-none">
           <Zap className="w-full h-full text-indigo-500 translate-x-1/4 -translate-y-1/4 stroke-[0.1]" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-[2rem]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {report?.map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "p-8 rounded-[2.5rem] border flex flex-col shadow-sm",
                section.type === 'positive' && "bg-emerald-50/50 border-emerald-100",
                section.type === 'negative' && "bg-rose-50/50 border-rose-100",
                section.type === 'action' && "bg-indigo-50/50 border-indigo-100",
                section.type === 'neutral' && "bg-white border-slate-100"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                  section.type === 'positive' && "bg-emerald-500",
                  section.type === 'negative' && "bg-rose-500",
                  section.type === 'action' && "bg-indigo-500",
                  section.type === 'neutral' && "bg-slate-500"
                )}>
                  {section.type === 'positive' && <TrendingUp className="w-5 h-5" />}
                  {section.type === 'negative' && <TrendingDown className="w-5 h-5" />}
                  {section.type === 'action' && <Target className="w-5 h-5" />}
                  {section.type === 'neutral' && <AlertCircle className="w-5 h-5" />}
                </div>
                <h3 className="font-black text-slate-900 tracking-tight">{section.title}</h3>
              </div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed flex-1">
                {section.content}
              </p>
              <div className="mt-6 pt-6 border-t border-slate-100/50">
                <button 
                  onClick={() => handleConsultation(section.title, section.content)}
                  className={cn(
                    "flex items-center gap-3 text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-xl border transition-all shadow-sm active:scale-95 cursor-pointer bg-white",
                    section.type === 'action' 
                      ? "text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600" 
                      : "text-slate-600 border-slate-100 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
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
