import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, limit } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Wallet, ShoppingBag, Bell, ReceiptText, Calculator, QrCode, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Sparkles, Package, CheckCircle2, ClipboardCheck, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, Debt } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxChecklist, setTaxChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!auth.currentUser) return;

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      // Client-side filtering
      const filtered = allData.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
      });
      setTransactions(filtered);
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

    const pq = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid), limit(5));
    const unsubscribeProds = onSnapshot(pq, (snapshot) => {
      setProducts(snapshot.docs.map(doc => doc.data()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const tq = onSnapshot(doc(db, 'taxChecklist', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setTaxChecklist(snap.data());
    }, (error) => handleFirestoreError(error, OperationType.GET, 'taxChecklist'));

    return () => {
      unsubscribeTrans();
      unsubscribeDebts();
      unsubscribeProds();
      tq();
    };
  }, [selectedMonth, selectedYear]);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.23, 1, 0.32, 1]
      } 
    }
  } as any;

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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 relative"
    >
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-indigo-200/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 left-0 -z-10 w-96 h-96 bg-emerald-200/10 blur-[120px] rounded-full" />

      {/* Period Selection Bar */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white shadow-xl">
         <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Periode Operasional</h3>
         </div>
         <div className="flex gap-2">
            <select 
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
               className="px-6 py-3 bg-white/50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all cursor-pointer"
            >
               {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
               ))}
            </select>
            <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(Number(e.target.value))}
               className="px-6 py-3 bg-white/50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all cursor-pointer"
            >
               {[2023, 2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
               ))}
            </select>
         </div>
      </motion.div>

      {/* Brand Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
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
      </motion.div>
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Total Revenue" 
          value={totalIncome} 
          icon={TrendingUp} 
          color="text-emerald-600"
          accentColor="bg-emerald-500"
          bg="bg-emerald-50"
          description="Arus Kas Masuk Operasional"
        />
        <SummaryCard 
          label="Operational OPEX" 
          value={totalExpense} 
          icon={TrendingDown} 
          color="text-rose-600"
          accentColor="bg-rose-500"
          bg="bg-rose-50"
          description="Beban Pokok & Biaya Umum"
        />
        <SummaryCard 
          label="EBITDA / Net Profit" 
          value={netProfit} 
          icon={Wallet} 
          color={netProfit >= 0 ? "text-indigo-600" : "text-rose-600"}
          accentColor={netProfit >= 0 ? "bg-indigo-500" : "bg-rose-500"}
          bg="bg-indigo-50"
          description="Laba Bersih Sebelum Pajak"
        />
        <SummaryCard 
          label="Estimated UMKM Tax" 
          value={pphTax} 
          icon={Calculator} 
          color="text-amber-600"
          accentColor="bg-amber-500"
          bg="bg-amber-50"
          description="PPh Final UMKM (0.5%)"
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-white/70 backdrop-blur-2xl p-8 md:p-12 rounded-[3.5rem] border border-white shadow-2xl cursor-pointer hover:bg-white hover:scale-[1.01] transition-all group overflow-hidden relative"
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Account Receivable</p>
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter font-display leading-none">{formatCurrency(totalReceivable)}</h3>
              <div className="flex items-center gap-3 mt-6">
                 <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100" />)}
                 </div>
                 <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest leading-none">Piutang Aktif</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 group-hover:rotate-12 transition-all">
              <ArrowUpRight className="w-10 h-10 stroke-[2.5]" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/20 blur-[60px] rounded-full" />
        </div>
        
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl cursor-pointer hover:bg-slate-800 hover:scale-[1.01] transition-all group overflow-hidden relative text-white"
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Account Payable</p>
              <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter font-display leading-none">{formatCurrency(totalPayable)}</h3>
              <div className="flex items-center gap-3 mt-6">
                 <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest leading-none">Kewajiban Vendor</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-rose-500 group-hover:-rotate-12 transition-all">
              <ArrowDownRight className="w-10 h-10 stroke-[2.5]" />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full" />
        </div>
      </motion.div>

      {/* Checklist & Operations Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        <div className="space-y-6 md:space-y-8">
           <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <ClipboardCheck className="w-4 h-4" /> Checklist Pajak UMKM
              </h4>
              <button onClick={() => setActiveTab('tax')} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline">Kelola Kepatuhan</button>
           </div>
           <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-xl p-8 md:p-10 space-y-6">
              <ComplianceRow label="SSE Pajak (MAP 411128)" done={taxChecklist?.step1} />
              <ComplianceRow label="Setoran PPh (Deadline 15)" done={taxChecklist?.step2} />
              <ComplianceRow label="Lapor SPT (Deadline 20)" done={taxChecklist?.step3} />
           </div>
        </div>

        <div className="space-y-6 md:space-y-8">
           <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Package className="w-4 h-4" /> Monitoring Stok Kritis
              </h4>
              <button onClick={() => setActiveTab('inventory')} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:underline">Lihat Inventori</button>
           </div>
           <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-xl p-8 md:p-10 space-y-6">
              {products.length > 0 ? products.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", p.stock < 5 ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400")}>
                         <ShoppingBag className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-black text-slate-900">{p.name}</p>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase px-2 py-0.5 rounded-full", p.stock < 5 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500")}>Stok: {p.stock}</span>
                   </div>
                </div>
              )) : (
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-4">Belum ada data stok</p>
              )}
           </div>
        </div>
      </motion.div>

      {/* Intelligence Alert */}
      <motion.div 
        variants={itemVariants}
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
      <motion.div variants={itemVariants} className="space-y-6 md:space-y-8">
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
      </motion.div>
    </motion.div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, bg, accentColor, description }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-2xl relative overflow-hidden group hover:bg-white hover:scale-[1.02] transition-all">
      <div className="relative z-10 flex flex-col gap-5 text-left">
        <div className={cn("w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-md transition-transform group-hover:scale-110", bg, color)}>
          <Icon className="w-6 h-6 stroke-[2.5]" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.20em] mb-1">{label}</p>
          <p className={cn("text-2xl md:text-3xl font-black tracking-tighter font-display leading-none mb-2", color)}>
            {formatCurrency(value)}
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400/80 leading-none">{description}</p>
        </div>
      </div>
      <div className={cn("absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700 blur-2xl", accentColor)} />
    </div>
  );
}

function ComplianceRow({ label, done }: { label: string, done: boolean }) {
  return (
    <div className="flex items-center justify-between group">
       <div className="flex items-center gap-3">
          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300")}>
             <CheckCircle2 className="w-3 h-3 stroke-[3]" />
          </div>
          <p className={cn("text-xs font-black tracking-tight", done ? "text-emerald-700" : "text-slate-900")}>{label}</p>
       </div>
       <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded", done ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-400")}>
          {done ? 'Selesai' : 'Perlu Tindakan'}
       </span>
    </div>
  );
}
