import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Target, AlertTriangle, Lightbulb, ArrowRight, Wallet, PieChart, BarChart3, Star, Loader2, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getGeminiResponse } from '../services/geminiService';

interface InsightData {
  summary: string;
  recommendation: string;
  cards: {
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info' | 'danger';
    icon: string;
    action: string;
    tab: string;
  }[];
}

interface SmartInsightsProps {
  setActiveTab: (tab: any) => void;
}

export default function SmartInsights({ setActiveTab }: SmartInsightsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<InsightData | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const tUnsub = onSnapshot(query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    ), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    });

    const pUnsub = onSnapshot(query(
      collection(db, 'products'),
      where('userId', '==', auth.currentUser.uid)
    ), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    return () => {
      tUnsub();
      pUnsub();
    };
  }, []);

  useEffect(() => {
    if (!loading && transactions.length > 0) {
      generateAIInsights();
    }
  }, [loading, transactions.length]);

  const generateAIInsights = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    
    try {
      const income = transactions.filter(t => t.type === 'income');
      const expenses = transactions.filter(t => t.type === 'expense');
      const totalIncome = income.reduce((acc, t) => acc + t.amount, 0);
      const totalExpense = expenses.reduce((acc, t) => acc + t.amount, 0);
      const margin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
      
      const prompt = `
        Analisis data keuangan bisnis berikut dan berikan wawasan strategis dalam format JSON.
        
        Data Bisnis:
        - Total Pendapatan: ${totalIncome}
        - Total Pengeluaran: ${totalExpense}
        - Margin Laba: ${margin.toFixed(2)}%
        - Jumlah Produk: ${products.length}
        - Stok Rendah: ${products.filter(p => p.stock <= 5).length} produk
        - 5 Transaksi Terakhir: ${transactions.slice(0, 5).map(t => `${t.description} (${formatCurrency(t.amount)})`).join(', ')}
        
        Output JSON harus memiliki struktur:
        {
          "summary": "Ringkasan eksekutif 1 kalimat tentang kondisi margin saat ini.",
          "recommendation": "Rekomendasi strategis mendalam berdasarkan data (minimal 2-3 kalimat).",
          "cards": [
            {
              "title": "Judul Insight 1",
              "description": "Deskripsi insight spesifik",
              "type": "success|warning|info|danger",
              "icon": "Target|Star|Wallet|PieChart",
              "action": "Label tombol aksi",
              "tab": "inventory|analysis|profitLoss|transactions"
            },
            ... (minimal 3 card)
          ]
        }
        
        Gunakan Bahasa Indonesia yang profesional. Pastikan JSON valid.
      `;

      const response = await getGeminiResponse(prompt);
      const jsonContent = response.replace(/```json|```/g, '').trim();
      try {
        const data = JSON.parse(jsonContent);
        setAiInsight(data);
      } catch (parseError) {
        console.error("JSON Parse error:", parseError, jsonContent);
        // Fallback to basic insights if AI fails to return valid JSON
        setAiInsight({
          summary: `Margin Bisnis Anda Berada di Angka ${stats.margin.toFixed(1)}% Bulan Ini.`,
          recommendation: "Analisis AI sedang mengalami kendala format. Secara umum, performa Anda stabil.",
          cards: [
            { title: "Optimasi Stok", description: "Periksa inventaris Anda secara berkala.", type: "info", icon: "Target", action: "Lihat Stok", tab: "inventory" },
            { title: "Efisiensi Biaya", description: "Coba tinjau pengeluaran bulanan Anda.", type: "warning", icon: "Wallet", action: "Lihat Transaksi", tab: "transactions" },
            { title: "Pertumbuhan", description: "Fokus pada produk dengan margin tertinggi.", type: "success", icon: "TrendingUp", action: "Analisis Margin", tab: "analysis" }
          ]
        });
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
      // Fallback logic could go here
    } finally {
      setAnalyzing(false);
    }
  };

  const calculateBasicStats = () => {
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalIncome = income.reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = expenses.reduce((acc, t) => acc + t.amount, 0);
    const margin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    return { margin, totalIncome, totalExpense };
  };

  const stats = calculateBasicStats();

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-bold animate-pulse">Memuat data keuangan...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <AnimatePresence mode="wait">
        {analyzing && !aiInsight ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-12 md:p-20 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center text-center space-y-6"
          >
            <div className="relative">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                 <BrainCircuit className="w-12 h-12 text-indigo-600 animate-pulse" />
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 border-2 border-indigo-200 border-t-indigo-600 rounded-full"
              />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight font-display mb-2">Menganalisis Performa Bisnis Anda...</h3>
              <p className="text-slate-500 font-medium">FinBuddy AI sedang memproses data transaksi dan stok untuk memberikan wawasan cerdas.</p>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            {/* Hero Insight Card */}
            <div className="relative p-10 md:p-14 bg-slate-900 rounded-[3rem] md:rounded-[4rem] text-white overflow-hidden shadow-2xl shadow-indigo-200">
               <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
                  <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[80%] rounded-full bg-indigo-500 blur-[100px]" />
               </div>
               
               <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                           <Sparkles className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tighter uppercase font-display">Executive Summary</h3>
                          {analyzing && <p className="text-[10px] text-indigo-400 font-black tracking-widest animate-pulse">MEMPERBARUI ANALISIS...</p>}
                        </div>
                     </div>
                     
                     <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.1] mb-8 font-display">
                        {aiInsight?.summary || `Margin Bisnis Anda Berada di Angka ${stats.margin.toFixed(1)}% Bulan Ini.`}
                     </h2>
                     
                     <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md mb-10">
                        {aiInsight?.recommendation || "Performa keuangan Anda menunjukkan tren yang stabil. Tim AI kami menyarankan untuk terus memantau arus kas secara berkala."}
                     </p>
                     
                     <div className="flex flex-wrap gap-4">
                        <button 
                           onClick={() => setActiveTab('aiAssistant')}
                           className="flex items-center gap-4 bg-white text-slate-900 px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] group transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/10"
                        >
                           Tanyakan Lebih Lanjut <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        {!aiInsight && !analyzing && (
                          <button 
                             onClick={generateAIInsights}
                             className="flex items-center gap-4 bg-white/10 backdrop-blur-lg text-white border border-white/10 px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] group transition-all hover:bg-white/20"
                          >
                             Muat Ulang Analisis
                          </button>
                        )}
                     </div>
                  </div>
                  
                  <div className="hidden lg:block h-64 bg-white/5 backdrop-blur-md rounded-[3rem] border border-white/5 p-8 relative">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={transactions.slice(-10).reverse().map(t => ({ name: t.date, val: t.amount }))}>
                            <defs>
                              <linearGradient id="colorValBlue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="val" stroke="#818cf8" strokeWidth={4} fillOpacity={1} fill="url(#colorValBlue)" />
                         </AreaChart>
                      </ResponsiveContainer>
                      <div className="absolute top-8 left-8">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tren Arus Kas Terakhir</p>
                      </div>
                  </div>
               </div>
            </div>

            {/* Insight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
               {aiInsight?.cards ? aiInsight.cards.map((card, idx) => (
                 <InsightCard 
                    key={idx}
                    title={card.title}
                    description={card.description}
                    icon={getIconByName(card.icon)}
                    type={card.type || 'info'}
                    actionLabel={card.action}
                    onAction={() => setActiveTab(card.tab)}
                 />
               )) : (
                 <>
                   <InsightCard 
                      title="Optimasi Stok"
                      description="Semua stok dalam kondisi aman."
                      icon={Target}
                      type="success"
                      actionLabel="Lihat Stok"
                      onAction={() => setActiveTab('inventory')}
                   />
                   <InsightCard 
                      title="Produk Terlaris"
                      description="Analisis produk sedang diproses oleh AI."
                      icon={Star}
                      type="info"
                      actionLabel="Analisis Margin"
                      onAction={() => setActiveTab('analysis')}
                   />
                   <InsightCard 
                      title="Kesehatan Arus Kas"
                      description="Data keuangan Anda sedang diulas secara mendalam."
                      icon={Wallet}
                      type="success"
                      actionLabel="Laporan Laba Rugi"
                      onAction={() => setActiveTab('profitLoss')}
                   />
                 </>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getIconByName(name: string) {
  const icons: Record<string, any> = {
    Target, Star, Wallet, PieChart, BarChart3, TrendingUp, TrendingDown, AlertTriangle, Lightbulb
  };
  return icons[name] || Lightbulb;
}

function InsightCard({ title, description, icon: Icon, type, actionLabel, onAction }: any) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    warning: 'bg-amber-50 border-amber-100 text-amber-600',
    info: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    danger: 'bg-rose-50 border-rose-100 text-rose-600'
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-50 shadow-xl shadow-slate-200/40 flex flex-col justify-between overflow-hidden relative group"
    >
       <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-10 blur-2xl rounded-full translate-x-10 -translate-y-10", styles[type as keyof typeof styles]?.split(' ')[2])} />
       
       <div>
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8", styles[type as keyof typeof styles])}>
             <Icon className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-black text-slate-900 tracking-tight font-display mb-3">{title}</h4>
          <p className="text-slate-500 font-medium leading-relaxed mb-8">{description}</p>
       </div>
       
       <button 
          onClick={onAction}
          className="flex items-center justify-between group/btn text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
       >
          {actionLabel} <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
       </button>
    </motion.div>
  );
}
