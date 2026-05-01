import React, { useState, useEffect } from 'react';
import { ShoppingBag, TrendingUp, TrendingDown, Package, DollarSign, Calculator, ChevronRight, AlertCircle, Sparkles, Filter, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Transaction } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function MarginAnalysis() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const pq = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeProd = onSnapshot(pq, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });

    const tq = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeTrans = onSnapshot(tq, (snapshot) => {
       setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    return () => {
      unsubscribeProd();
      unsubscribeTrans();
    };
  }, []);

  const calculateContribution = (productName: string) => {
     const sales = transactions.filter(t => t.type === 'income' && t.productName === productName);
     const totalSalesValue = sales.reduce((acc, t) => acc + t.amount, 0);
     const totalSalesAll = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
     return totalSalesValue > 0 ? (totalSalesValue / totalSalesAll) * 100 : 0;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="bg-indigo-600 rounded-[3rem] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
         <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
            <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[120%] rounded-full bg-white blur-[100px]" />
         </div>
         
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
               <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full mb-8 border border-white/10">
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Wawasan Margin Produk</p>
               </div>
               <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight font-display mb-6">Optimalkan Laba per Barang.</h3>
               <p className="text-indigo-100 font-medium leading-relaxed max-w-sm">Evaluasi profitabilitas setiap produk untuk menentukan strategi harga yang lebih baik.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col items-center text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-2">Avg. Margin</p>
                  <p className="text-3xl font-black font-display tracking-tight">
                     {products.length > 0 ? Math.round(products.reduce((acc, p) => acc + ((p.price - p.hpp) / p.price) * 100, 0) / products.length) : 0}%
                  </p>
               </div>
               <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col items-center text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-2">Total SKU</p>
                  <p className="text-3xl font-black font-display tracking-tight">{products.length}</p>
               </div>
            </div>
         </div>
      </div>

      {/* Filter & Table Area */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
           <div className="flex-1 relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari produk atau kategori..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 md:py-4.5 bg-white border-2 border-slate-50 focus:border-indigo-100 rounded-2xl md:rounded-3xl outline-none transition-all font-bold text-sm shadow-md"
              />
           </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3.5rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="border-b border-slate-50">
                       <th className="px-8 py-8 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Produk & Kategori</th>
                       <th className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">HPP</th>
                       <th className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Jual</th>
                       <th className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Profit/Unit</th>
                       <th className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Margin</th>
                       <th className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Kontribusi</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                       <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Data...</td></tr>
                    ) : filteredProducts.map(p => {
                       const profit = p.price - p.hpp;
                       const margin = (profit / p.price) * 100;
                       const contribution = calculateContribution(p.name);
                       return (
                          <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                             <td className="px-8 py-7">
                                <p className="font-black text-slate-900 tracking-tight">{p.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{p.category}</p>
                             </td>
                             <td className="px-8 py-7 text-right">
                                <p className="text-sm font-bold text-slate-400 font-mono">{formatCurrency(p.hpp)}</p>
                             </td>
                             <td className="px-8 py-7 text-right">
                                <p className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(p.price)}</p>
                             </td>
                             <td className="px-8 py-7 text-right">
                                <p className="text-sm font-black text-emerald-600 font-mono">+{formatCurrency(profit)}</p>
                             </td>
                             <td className="px-8 py-7 text-right">
                                <div className={cn(
                                   "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black",
                                   margin >= 30 ? "bg-emerald-50 text-emerald-600" : margin >= 15 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                )}>
                                   {margin >= 30 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                   {margin.toFixed(1)}%
                                </div>
                             </td>
                             <td className="px-8 py-7 text-right">
                                <div className="space-y-1.5">
                                   <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                                      <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${contribution}%` }}
                                         className="h-full bg-indigo-500" 
                                      />
                                   </div>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{contribution.toFixed(1)}% Penjualan</p>
                                </div>
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
