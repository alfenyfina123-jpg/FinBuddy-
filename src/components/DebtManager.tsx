import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Search, Banknote, Calendar, User, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Debt, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function DebtManager() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'payable' | 'receivable'>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'debts'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'debts');
    });
  }, []);

  const handleMarkAsPaid = async (debt: Debt) => {
    try {
      setLoading(true);
      // 1. Update status hutang
      await updateDoc(doc(db, 'debts', debt.id), {
        status: 'paid',
        remainingAmount: 0,
        updatedAt: serverTimestamp()
      });

      // 2. Catat transaksi otomatis
      await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser?.uid,
        amount: debt.remainingAmount,
        type: debt.type === 'receivable' ? 'income' : 'expense',
        description: `Pelunasan ${debt.type === 'receivable' ? 'Piutang' : 'Hutang'}: ${debt.contactName}`,
        category: debt.type === 'receivable' ? 'Pelunasan Piutang' : 'Pelunasan Hutang',
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        createdAt: serverTimestamp(),
        referenceId: debt.id
      });
      
      setConfirmingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `debts/${debt.id}`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = debts.filter(d => {
    const matchesSearch = d.contactName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || d.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalReceivable = debts.filter(d => d.type === 'receivable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);
  const totalPayable = debts.filter(d => d.type === 'payable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);

  return (
    <div className="space-y-12 relative">
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-amber-200/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-white/60 backdrop-blur-md p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white shadow-xl shadow-emerald-100/50 flex items-center justify-between group hover:bg-white transition-all">
          <div>
            <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2 md:mb-3">Piutang Pelanggan</p>
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalReceivable)}</h3>
            <p className="text-emerald-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mt-2 md:mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Asset Berjalan
            </p>
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-xl md:rounded-[2rem] flex items-center justify-center text-emerald-600 shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
            <ArrowUpRight className="w-6 h-6 md:w-8 md:h-8 stroke-[2.5]" />
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white shadow-xl shadow-rose-100/50 flex items-center justify-between group hover:bg-white transition-all">
          <div>
            <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2 md:mb-3">Hutang Operasional</p>
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalPayable)}</h3>
            <p className="text-rose-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mt-2 md:mt-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Kewajiban Lancar
            </p>
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 bg-rose-50 rounded-xl md:rounded-[2rem] flex items-center justify-center text-rose-600 shadow-lg shadow-rose-100 group-hover:scale-110 transition-transform">
            <ArrowDownRight className="w-6 h-6 md:w-8 md:h-8 stroke-[2.5]" />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch justify-between">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari nama kontak..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 md:pl-16 pr-6 py-4 md:py-5 text-xs md:text-sm bg-white/60 backdrop-blur-md border border-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg md:shadow-xl shadow-slate-200/40 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 font-bold"
          />
        </div>
        
        <div className="flex bg-white/40 backdrop-blur-md p-1 md:p-1.5 rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-lg shadow-slate-200/20 overflow-x-auto no-scrollbar">
          {(['all', 'receivable', 'payable'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-4 md:px-8 py-2.5 md:py-3.5 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-[1.5rem] transition-all whitespace-nowrap",
                activeFilter === f ? "bg-slate-900 text-white shadow-xl shadow-slate-200 scale-105" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {f === 'all' ? 'Seluruh Data' : f === 'receivable' ? 'Piutang' : 'Hutang'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        <AnimatePresence>
          {filtered.map((d) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-white bg-white/60 backdrop-blur-md shadow-xl shadow-slate-200/40 flex flex-col relative overflow-hidden group transition-all",
                d.status === 'paid' && "opacity-60 grayscale bg-slate-50/50"
              )}
            >
              <div className="flex items-start justify-between mb-6 md:mb-8">
                <div className={cn(
                  "w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg",
                  d.type === 'receivable' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" : "bg-rose-50 text-rose-600 shadow-rose-100"
                )}>
                  {d.type === 'receivable' ? <ArrowUpRight className="w-6 h-6 md:w-7 md:h-7 stroke-[2.5]" /> : <ArrowDownRight className="w-6 h-6 md:w-7 md:h-7 stroke-[2.5]" />}
                </div>
                <div className={cn(
                  "px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] shadow-sm",
                  d.status === 'paid' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                )}>
                  {d.status === 'paid' ? 'Settled' : 'Pending'}
                </div>
              </div>

              <div className="mb-6 md:mb-8">
                <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1.5 md:mb-2 leading-none">
                  Identitas Entitas
                </p>
                <h4 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight line-clamp-1">{d.contactName}</h4>
              </div>

              <div className="space-y-4 mb-8 md:mb-10">
                <div className="bg-white/80 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-50 shadow-inner">
                  <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-2 block">Outstanding Amount</span>
                  <p className="text-2xl md:text-3xl font-black text-slate-950 tracking-tighter leading-none">{formatCurrency(d.remainingAmount)}</p>
                </div>
                <div className="flex items-center gap-2 md:gap-3 px-3">
                  <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Limit: {new Date(d.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {d.status !== 'paid' && (
                <div className="mt-auto space-y-3">
                  {confirmingId === d.id ? (
                    <div className="flex gap-2">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsPaid(d);
                        }}
                        disabled={loading}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg"
                      >
                        Ya, Lunas
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingId(null);
                        }}
                        className="px-6 py-4 bg-slate-100 text-slate-500 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingId(d.id);
                      }}
                      className="relative z-10 w-full py-4 md:py-5 bg-slate-900 text-white rounded-[1.2rem] md:rounded-[1.5rem] text-[10px] md:text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 flex items-center justify-center gap-2 md:gap-3"
                    >
                      <CheckCircle2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                      Konfirmasi Pelunasan
                    </button>
                  )}
                </div>
              )}
              {d.status === 'paid' && (
                <div className="relative z-10 mt-auto py-4 md:py-5 flex items-center justify-center gap-2 md:gap-3 bg-emerald-50 rounded-[1.2rem] md:rounded-[1.5rem]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-[10px] md:text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em]">Data Terarsip Lunas</p>
                </div>
              )}
              
              <div className={cn(
                "absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-[60px] opacity-10 transition-transform duration-1000 group-hover:scale-150 pointer-events-none",
                d.type === 'receivable' ? "bg-emerald-400" : "bg-rose-400"
              )} />
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <div className="flex flex-col items-center justify-center opacity-40">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl mb-6 flex items-center justify-center text-slate-300">
                 <Banknote className="w-10 h-10" />
               </div>
               <p className="text-xs font-black uppercase tracking-[0.2em]">Riwayat Kredit Kosong</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
