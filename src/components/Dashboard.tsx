import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Wallet, ShoppingBag, Bell, ReceiptText, Calculator, QrCode, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, Debt } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const dq = query(collection(db, 'debts'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeDebts = onSnapshot(dq, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'debts');
    });

    return () => {
      unsubscribeTrans();
      unsubscribeDebts();
    };
  }, []);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netProfit = totalIncome - totalExpense;
  const pphTax = totalIncome * 0.005;

  const totalReceivable = debts.filter(d => d.type === 'receivable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);
  const totalPayable = debts.filter(d => d.type === 'payable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);

  if (loading) return (
    <div className="animate-pulse space-y-8">
      <div className="h-20 bg-slate-100 rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-[2rem]" />)}
      </div>
      <div className="h-40 bg-slate-100 rounded-[2.5rem]" />
    </div>
  );

  return (
    <div className="space-y-12 pb-20 relative">
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-indigo-200/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-emerald-200/10 blur-[120px] rounded-full" />

      {/* Brand Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider">Live Insight</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-[1.1] mb-2 font-display">Ikhtisar Bisnis</h1>
          <p className="text-slate-500 font-medium text-base md:text-lg">Wujudkan pertumbuhan dengan data yang akurat.</p>
        </div>
        <button 
          onClick={() => setActiveTab('transactions')}
          className="flex items-center justify-center gap-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-[10px] md:text-[11px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl md:shadow-2xl shadow-indigo-200 group w-full md:w-auto"
        >
          <ReceiptText className="w-5 h-5 text-indigo-200 group-hover:rotate-12 transition-transform" />
          Input Transaksi Baru
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <SummaryCard 
          label="Total Pemasukan" 
          value={totalIncome} 
          icon={TrendingUp} 
          color="text-emerald-600"
          accentColor="bg-emerald-500"
          bg="bg-emerald-50"
        />
        <SummaryCard 
          label="Total Pengeluaran" 
          value={totalExpense} 
          icon={TrendingDown} 
          color="text-rose-600"
          accentColor="bg-rose-500"
          bg="bg-rose-50"
        />
        <SummaryCard 
          label="Estimasi Laba" 
          value={netProfit} 
          icon={Wallet} 
          color={netProfit >= 0 ? "text-indigo-600" : "text-rose-600"}
          accentColor={netProfit >= 0 ? "bg-indigo-500" : "bg-rose-500"}
          bg="bg-indigo-50"
        />
        <SummaryCard 
          label="Beban Pajak PPh" 
          value={pphTax} 
          icon={Calculator} 
          color="text-amber-600"
          accentColor="bg-amber-500"
          bg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-white/60 backdrop-blur-md p-6 md:p-8 lg:p-10 rounded-[2rem] md:rounded-[3rem] border border-white shadow-xl shadow-slate-100/50 cursor-pointer hover:bg-white hover:scale-[1.01] transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 md:mb-3">Piutang Pelanggan</p>
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter font-display">{formatCurrency(totalReceivable)}</h3>
              <p className="text-emerald-600 text-[10px] md:text-xs font-bold mt-2 md:mt-3 flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Asset Likuid
              </p>
            </div>
            <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-xl md:rounded-[2rem] flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-6 h-6 md:w-8 md:h-8 stroke-[2.5]" />
            </div>
          </div>
        </div>
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-white/60 backdrop-blur-md p-6 md:p-8 lg:p-10 rounded-[2rem] md:rounded-[3rem] border border-white shadow-xl shadow-slate-100/50 cursor-pointer hover:bg-white hover:scale-[1.01] transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 md:mb-3">Hutang Vendor</p>
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter font-display">{formatCurrency(totalPayable)}</h3>
              <p className="text-rose-600 text-[10px] md:text-xs font-bold mt-2 md:mt-3 flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Kewajiban Segera
              </p>
            </div>
            <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 rounded-xl md:rounded-[2rem] flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <ArrowDownRight className="w-6 h-6 md:w-8 md:h-8 stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Alert */}
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "p-6 md:p-8 lg:p-10 rounded-[2rem] md:rounded-[3.5rem] relative overflow-hidden group border-2",
          netProfit >= 0 ? "bg-emerald-50 border-emerald-100/50" : "bg-rose-50 border-rose-100/50"
        )}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
            <div className={cn(
              "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg",
              netProfit >= 0 ? "bg-emerald-600 shadow-emerald-200" : "bg-rose-600 shadow-rose-200"
            )}>
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" />
            </div>
            <h3 className={cn(
              "text-xl md:text-2xl lg:text-3xl font-black tracking-tighter font-display",
              netProfit >= 0 ? "text-emerald-950" : "text-rose-950"
            )}>
              {netProfit >= 0 ? 'Analisis Strategis: Performa Positif' : 'Analisis Strategis: Peringatan Likuiditas'}
            </h3>
          </div>
          <p className={cn(
            "text-sm md:text-base lg:text-lg font-bold leading-relaxed max-w-4xl opacity-80",
            netProfit >= 0 ? "text-emerald-900" : "text-rose-900"
          )}>
            {netProfit >= 0 
              ? 'Arus kas Anda menunjukkan tren pertumbuhan yang sehat. Rasio profitabilitas berada di atas rata-rata sektor bisnis sejenis. Pertimbangkan untuk mereinvestasi laba pada produk dengan margin tinggi.' 
              : 'Margin laba bersih Anda sedang menyempit. Data menunjukkan rasio pengeluaran operasional meningkat 15% dibanding periode lalu. Optimasi biaya pengadaan (COGS) diperlukan segera.'
            }
          </p>
        </div>
        <div className={cn(
          "absolute -right-16 -bottom-16 w-48 h-48 md:w-64 md:h-64 rounded-full blur-[80px] md:blur-[100px] opacity-30 md:opacity-40 group-hover:scale-110 transition-transform duration-700",
          netProfit >= 0 ? "bg-emerald-400" : "bg-rose-400"
        )} />
      </motion.div>

      {/* Recent Transactions Section */}
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-end justify-between px-2 md:px-4">
          <div>
            <h3 className="text-[10px] md:text-xs lg:text-sm font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Riwayat Operasional</h3>
            <h4 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter font-display">Aktivitas Terakhir</h4>
          </div>
          <button 
            onClick={() => setActiveTab('transactions')}
            className="text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 flex items-center gap-2 group p-2"
          >
            Lihat Semua <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>

        {transactions.length > 0 ? (
          <div className="bg-white/40 backdrop-blur-xl rounded-[1.5rem] md:rounded-[3rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {transactions.slice(0, 5).map((t, i) => (
                <div key={t.id || i} className="p-5 md:p-8 flex items-center justify-between hover:bg-white/80 transition-all cursor-pointer">
                  <div className="flex items-center gap-3 md:gap-6">
                    <div className={cn(
                      "w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                      t.type === 'income' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" : "bg-rose-50 text-rose-600 shadow-rose-100"
                    )}>
                      {t.type === 'income' ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" /> : <TrendingDown className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-lg font-black text-slate-900 leading-tight mb-1.5 md:mb-2 truncate pr-2">{t.description}</p>
                      <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
                        <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
                          {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
                          {t.category}
                        </span>
                        {t.paymentMethod && (
                          <span className={cn(
                            "text-[8px] md:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-1 rounded-md flex items-center gap-1 md:gap-1.5",
                            t.paymentMethod === 'qris' ? "bg-violet-50 text-violet-500" : 
                            t.paymentMethod === 'credit' ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500"
                          )}>
                            {t.paymentMethod === 'qris' ? <QrCode className="w-2.5 h-2.5 md:w-3 md:h-3" /> : 
                             t.paymentMethod === 'credit' ? <CreditCard className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <Banknote className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                            {t.paymentMethod}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className={cn(
                      "text-base md:text-2xl font-black tracking-tight",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/40 backdrop-blur-xl p-12 md:p-24 rounded-[2rem] md:rounded-[4rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-[1.5rem] md:rounded-3xl flex items-center justify-center text-slate-200 mb-6 md:mb-8">
              <ShoppingBag className="w-8 h-8 md:w-10 md:h-10 stroke-[1.5]" />
            </div>
            <h5 className="text-slate-900 font-black text-lg md:text-xl mb-2">Mulai Pencatatan Anda</h5>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[11px] max-w-xs px-4">Tekan tombol input di atas untuk menyusun riwayat keuangan Anda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, bg, accentColor }: any) {
  return (
    <div className="bg-white/60 backdrop-blur-md p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-white shadow-xl shadow-slate-100/50 relative overflow-hidden group hover:bg-white hover:scale-[1.02] transition-all">
      <div className="relative z-10 flex flex-col gap-4 md:gap-6">
        <div className={cn("w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg", bg, color)}>
          <Icon className="w-5 h-5 md:w-7 md:h-7 stroke-[2.5]" />
        </div>
        <div>
          <p className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1.5 md:mb-2">{label}</p>
          <p className={cn("text-2xl md:text-3xl lg:text-4xl font-black tracking-tighter font-display leading-none", color)}>
            {formatCurrency(value)}
          </p>
        </div>
      </div>
      <div className={cn("absolute -right-8 -bottom-8 w-24 h-24 md:w-32 md:h-32 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 blur-2xl", accentColor)} />
    </div>
  );
}



