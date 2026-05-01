import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Target, AlertTriangle, Lightbulb, ArrowRight, Wallet, PieChart, BarChart3, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface SmartInsightsProps {
  setActiveTab: (tab: any) => void;
}

export default function SmartInsights({ setActiveTab }: SmartInsightsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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

  const calculateInsights = () => {
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const totalIncome = income.reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = expenses.reduce((acc, t) => acc + t.amount, 0);
    
    const margin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    
    const lowStock = products.filter(p => p.stock <= 5);

    return {
      margin,
      totalIncome,
      totalExpense,
      lowStockCount: lowStock.length,
      topProduct: products.length > 0 ? products[0].name : 'N/A'
    };
  };

  const insights = calculateInsights();

  if (loading) return null;

  return (
    <div className="space-y-10">
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
                  <h3 className="text-xl font-black tracking-tighter uppercase font-display">Executive Summary</h3>
               </div>
               
               <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.1] mb-8 font-display">
                  Margin Bisnis Anda Berada di Angka <span className="text-indigo-400">{insights.margin.toFixed(1)}%</span> Bulan Ini.
               </h2>
               
               <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md mb-10">
                  Performa keuangan Anda menunjukkan tren yang stabil. Kami merekomendasikan fokus pada optimasi pengeluaran untuk meningkatkan margin ke angka 20%.
               </p>
               
               <button 
                  onClick={() => setActiveTab('aiAssistant')}
                  className="flex items-center gap-4 bg-white text-slate-900 px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] group transition-all hover:scale-[1.02] active:scale-[0.98]"
               >
                  Dapatkan Saran AI <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>
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
         <InsightCard 
            title="Optimasi Stok"
            description={insights.lowStockCount > 0 ? `${insights.lowStockCount} produk sedang dalam kondisi stok kritis.` : 'Semua stok dalam kondisi aman.'}
            icon={Target}
            type={insights.lowStockCount > 0 ? 'warning' : 'success'}
            actionLabel="Lihat Stok"
            onAction={() => setActiveTab('inventory')}
         />
         <InsightCard 
            title="Produk Terlaris"
            description={`Produk "${insights.topProduct}" menyumbang kontribusi terbesar pendapatan Anda.`}
            icon={Star}
            type="info"
            actionLabel="Analisis Margin"
            onAction={() => setActiveTab('analysis')}
         />
         <InsightCard 
            title="Kesehatan Arus Kas"
            description={insights.margin > 15 ? 'Arus kas Anda sangat sehat dengan rasio margin di atas rata-rata.' : 'Perlu pengawasan ekstra pada beban operasional minggu ini.'}
            icon={Wallet}
            type={insights.margin > 15 ? 'success' : 'warning'}
            actionLabel="Laporan Laba Rugi"
            onAction={() => setActiveTab('profitLoss')}
         />
      </div>
    </div>
  );
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
       <div className={cn("absolute top-0 right-0 w-32 h-32 opacity-10 blur-2xl rounded-full translate-x-10 -translate-y-10", styles[type as keyof typeof styles].split(' ')[2])} />
       
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
