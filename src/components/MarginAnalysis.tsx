import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShoppingBag, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

interface ProductStats {
  name: string;
  totalSales: number;
  totalHPP: number;
  margin: number;
  marginPercent: number;
}

export default function MarginAnalysis() {
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'income')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => doc.data() as Transaction);
      
      const statsMap = new Map<string, { sales: number; hpp: number }>();
      
      transactions.forEach(t => {
        if (!t.productName) return;
        const existing = statsMap.get(t.productName) || { sales: 0, hpp: 0 };
        statsMap.set(t.productName, {
          sales: existing.sales + t.amount,
          hpp: existing.hpp + (t.hpp || 0)
        });
      });

      const stats: ProductStats[] = Array.from(statsMap.entries()).map(([name, data]) => {
        const margin = data.sales - data.hpp;
        const marginPercent = data.sales > 0 ? (margin / data.sales) * 100 : 0;
        return {
          name,
          totalSales: data.sales,
          totalHPP: data.hpp,
          margin,
          marginPercent
        };
      }).sort((a, b) => b.margin - a.margin);

      setProductStats(stats);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) return <div className="space-y-8 animate-pulse">
    <div className="h-64 bg-gray-100 rounded-3xl" />
    <div className="h-96 bg-gray-100 rounded-3xl" />
  </div>;

  if (productStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-dashed border-gray-200">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-sm font-semibold text-brand-primary">Belum ada data produk</h3>
        <p className="text-xs text-brand-secondary mt-2 text-center max-w-xs">
          Tambahkan transaksi pemasukan dengan menyebutkan nama produk dan HPP untuk melihat analisis margin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
      <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Chart View Bento */}
        <div className="md:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-3 mb-10 uppercase tracking-widest">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4 stroke-[3]" />
            </div>
            Distribusi Penjualan
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="totalSales"
                >
                  {productStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} transitionDuration={1000} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 p-4 shadow-2xl rounded-2xl border border-slate-800 text-xs text-white">
                          <p className="font-black mb-1 uppercase tracking-wider">{data.name}</p>
                          <p className="text-slate-400 font-bold">{formatCurrency(data.totalSales)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-6 justify-center mt-6">
            {productStats.slice(0, 4).map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Highlight Stats Bento Dark */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-slate-900/40 h-full flex flex-col">
            <div className="relative z-10 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mb-6">
                <ShoppingBag className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-2">Penjualan Terlaris</h3>
              <h4 className="text-3xl font-black tracking-tighter mb-8 leading-tight">{productStats[0].name}</h4>
              
              <div className="space-y-6 pt-6 border-t border-slate-800">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Keuntungan</p>
                    <p className="text-2xl font-black text-emerald-400 tracking-tight">{formatCurrency(productStats[0].margin)}</p>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-black">
                    {productStats[0].marginPercent.toFixed(1)}%
                  </div>
                </div>
                
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      <span>Profit Margin</span>
                      <span>Target 60%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${productStats[0].marginPercent}%` }}
                        className="h-full bg-emerald-500 rounded-full" 
                      />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Table Bento */}
      <div className="md:col-span-12 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Analisis Profitabilitas Produk</h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Live Data</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Produk</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Penjualan</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total HPP</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Margin Bersih</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Profit %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {productStats.map((p, i) => (
                <tr key={p.name} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-white transition-colors">
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-900 tracking-tight">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <p className="text-sm font-black text-slate-900">{formatCurrency(p.totalSales)}</p>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <p className="text-xs font-bold text-slate-400 font-mono">{formatCurrency(p.totalHPP)}</p>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <p className="text-sm font-black text-indigo-600 tracking-tight">{formatCurrency(p.margin)}</p>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center justify-center gap-4">
                       <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden lg:block">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(p.marginPercent, 100)}%` }}
                            className={cn(
                              "h-full rounded-full",
                              p.marginPercent >= 50 ? "bg-emerald-500" : p.marginPercent >= 20 ? "bg-amber-400" : "bg-rose-400"
                            )} 
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
