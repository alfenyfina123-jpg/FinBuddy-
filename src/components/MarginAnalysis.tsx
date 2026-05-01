import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShoppingBag, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function MarginAnalysis() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'income')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, []);

  const productAnalysis = transactions.reduce((acc: any, t) => {
    const productName = t.productName || 'Tanpa Nama Produk';
    if (!acc[productName]) {
      acc[productName] = {
        name: productName,
        revenue: 0,
        totalHpp: 0,
        count: 0
      };
    }
    acc[productName].revenue += t.amount;
    acc[productName].totalHpp += (t.hpp || 0);
    acc[productName].count += 1;
    return acc;
  }, {});

  const analysisList = Object.values(productAnalysis).map((p: any) => ({
    ...p,
    margin: p.revenue - p.totalHpp,
    marginPercent: p.revenue > 0 ? ((p.revenue - p.totalHpp) / p.revenue) * 100 : 0
  })).sort((a, b) => b.margin - a.margin);

  const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Menganalisis Profitabilitas...</div>;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/60 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] border border-white shadow-xl">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Percent className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Proporsi Margin Per Produk</h3>
           </div>
           
           <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={analysisList.slice(0, 8)}
                   cx="50%"
                   cy="50%"
                   innerRadius={80}
                   outerRadius={120}
                   paddingAngle={4}
                   dataKey="margin"
                   nameKey="name"
                 >
                   {analysisList.map((_, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(v: any) => formatCurrency(v)}
                 />
                 <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px', fontWeight: 'bold', textTransform: 'uppercase' }} />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-[#1e293b] p-8 md:p-10 rounded-[2.5rem] text-white">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight font-display">Produk Terlaris (Leaderboard)</h3>
           </div>

           <div className="space-y-6">
              {analysisList.slice(0, 5).map((p, i) => (
                <div key={p.name} className="flex items-center gap-6 group">
                   <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center font-black text-xs text-white/40">0{i+1}</div>
                   <div className="flex-1">
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-sm font-black tracking-tight">{p.name}</p>
                        <p className="text-[10px] font-bold text-white/40 uppercase">{p.count} Transaksi</p>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" 
                           style={{ width: `${(p.revenue / analysisList[0].revenue) * 100}%` }}
                         />
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-50">
           <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Detail Profitabilitas Produk</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Produk</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Vol. Terjual</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Total Omzet</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Profit Kotor</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Persentase Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {analysisList.map((p) => (
                <tr key={p.name} className="hover:bg-white transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <ShoppingBag className="w-4 h-4" />
                       </div>
                       <span className="text-sm font-black text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600">{p.count} Unit</td>
                  <td className="px-8 py-5 text-sm font-black text-slate-900">{formatCurrency(p.revenue)}</td>
                  <td className="px-8 py-5 text-sm font-black text-emerald-600">+{formatCurrency(p.margin)}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                       <div className="flex-1 h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            p.marginPercent >= 20 ? "bg-emerald-500" : "bg-rose-500"
                          )} 
                          style={{ width: `${Math.min(100, Math.max(0, p.marginPercent))}%` }} 
                          />
                       </div>
                       <span className={cn(
                         "text-xs font-black tracking-tight",
                         p.marginPercent >= 20 ? "text-emerald-600" : "text-rose-500"
                       )}>{p.marginPercent.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
