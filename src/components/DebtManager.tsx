import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Wallet, Plus, Search, Calendar, User as UserIcon, ArrowRight, Trash2, CheckCircle2, AlertCircle, Clock, ChevronRight, X, DollarSign, Calculator, Info, Check, ShieldCheck, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { Debt, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function DebtManager() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'payable' as 'payable' | 'receivable',
    contactName: '',
    totalAmount: '',
    dueDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'debts'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'debts'));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      const amount = Number(formData.totalAmount);
      const data = {
        userId: auth.currentUser.uid,
        type: formData.type,
        contactName: formData.contactName,
        totalAmount: amount,
        remainingAmount: amount,
        dueDate: formData.dueDate,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'debts'), data);
      setIsModalOpen(false);
      setFormData({ type: 'payable', contactName: '', totalAmount: '', dueDate: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'debts');
    }
  };

  const markPaid = async (debt: Debt) => {
    if (!auth.currentUser) return;
    if (!confirm('Konfirmasi pelunasan hutang/piutang ini?')) return;
    try {
      // 1. Create Transaction for the payment
      const transactionData = {
        userId: auth.currentUser.uid,
        type: debt.type === 'payable' ? 'expense' : 'income',
        category: debt.type === 'payable' ? 'Pelunasan Hutang' : 'Penerimaan Piutang',
        amount: debt.remainingAmount,
        description: `Pelunasan ${debt.type === 'payable' ? 'HUTANG' : 'PIUTANG'} dari: ${debt.contactName}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        paymentMethod: 'cash'
      };
      
      await addDoc(collection(db, 'transactions'), transactionData);

      // 2. Update Debt status
      await updateDoc(doc(db, 'debts', debt.id), {
        status: 'paid',
        remainingAmount: 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'debts');
    }
  };

  const deleteDebtRecord = async (id: string) => {
     if (!confirm('Hapus catatan ini?')) return;
     try {
       await deleteDoc(doc(db, 'debts', id));
     } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, 'debts');
     }
  }

  const filteredDebts = debts.filter(d => 
    d.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPayable = debts.filter(d => d.type === 'payable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);
  const totalReceivable = debts.filter(d => d.type === 'receivable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);

  return (
    <div className="space-y-12">
      {/* Top Briefing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-8 md:p-10 bg-[#1e293b] rounded-[2.5rem] md:rounded-[3rem] text-white relative overflow-hidden group border border-slate-700">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400">
                     <TrendingDown className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Hutang (Usaha Keluar)</p>
               </div>
               <h3 className="text-3xl md:text-5xl font-black font-display tracking-tighter text-rose-400">{formatCurrency(totalPayable)}</h3>
               <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-4 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Berdasarkan jatuh tempo terdekat
               </p>
            </div>
            <div className="absolute -right-8 -bottom-10 w-40 h-40 bg-rose-600/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
         </div>

         <div className="p-8 md:p-10 bg-white/60 backdrop-blur-md rounded-[2.5rem] md:rounded-[3rem] border border-white shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                     <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Piutang (Tabungan Masuk)</p>
               </div>
               <h3 className="text-3xl md:text-5xl font-black font-display tracking-tighter text-emerald-600">{formatCurrency(totalReceivable)}</h3>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Estimasi likuiditas lancar
               </p>
            </div>
            <div className="absolute -right-8 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 relative group">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-violet-500 transition-colors" />
           <input 
             type="text" 
             placeholder="Cari nama kontak..."
             className="w-full pl-16 pr-6 py-4 md:py-5 bg-white border-2 border-slate-50 focus:border-violet-100 rounded-3xl outline-none transition-all font-bold text-sm shadow-xl shadow-slate-100/30"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-4 md:py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-100 hover:bg-slate-900 transition-all shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Tambah Catatan
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] md:rounded-[3.5rem] border border-white shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
               <tr className="border-b border-indigo-50/50">
                 <th className="px-8 py-7 text-[10px] font-black uppercase tracking-widest text-slate-400">Jenis & Kontak</th>
                 <th className="px-8 py-7 text-[10px] font-black uppercase tracking-widest text-slate-400">Jatuh Tempo</th>
                 <th className="px-8 py-7 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                 <th className="px-8 py-7 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Sisa Nominal</th>
                 <th className="px-8 py-7 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Aksi Pelunasan</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
               {loading ? (
                 <tr><td colSpan={5} className="px-8 py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Sinkronisasi Kredit...</td></tr>
               ) : filteredDebts.length > 0 ? (
                 filteredDebts.map((d) => (
                    <tr key={d.id} className="group hover:bg-white transition-all">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <div className={cn(
                               "w-10 h-10 rounded-xl flex items-center justify-center",
                               d.type === 'payable' ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                             )}>
                                {d.type === 'payable' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900">{d.contactName}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{d.type === 'payable' ? 'Hutang Usaha' : 'Piutang Tunai'}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                             <Calendar className="w-3.5 h-3.5 text-slate-300" />
                             <span className="text-[11px] font-bold text-slate-500">{new Date(d.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <span className={cn(
                             "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center w-fit gap-1.5 shadow-sm border",
                             d.status === 'paid' ? "bg-indigo-500 text-white border-indigo-200" : "bg-white text-slate-400 border-slate-100"
                          )}>
                             {d.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                             {d.status === 'paid' ? 'LUNAS' : 'MENUNGGU'}
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className={cn(
                            "text-sm font-black font-mono",
                            d.status === 'paid' ? "line-through text-slate-300" : d.type === 'payable' ? "text-rose-500" : "text-emerald-600"
                          )}>{formatCurrency(d.remainingAmount)}</p>
                       </td>
                       <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-2">
                             {d.status !== 'paid' && (
                                <button 
                                  onClick={() => markPaid(d)}
                                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-sm"
                                >
                                   Lunasi <ArrowRight className="w-3 h-3" />
                                </button>
                             )}
                             <button 
                               onClick={() => deleteDebtRecord(d.id)}
                               className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                             >
                               <Trash2 className="w-4.5 h-4.5" />
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))
               ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center opacity-10">
                       <Wallet className="w-20 h-20 mb-4" />
                       <p className="text-xl font-black uppercase tracking-widest">Catatan Bersih</p>
                    </div>
                  </td>
                </tr>
               )}
             </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl p-10 overflow-hidden">
               <div className="mb-10">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter font-display">Baru: Catatan Kredit</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hutang ke vendor atau Piutang pelanggan</p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    {(['payable', 'receivable'] as const).map(type => (
                       <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({...formData, type})}
                          className={cn(
                             "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3",
                             formData.type === type ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-50 grayscale opacity-40 hover:grayscale-0"
                          )}
                       >
                          <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                             type === 'payable' ? "bg-rose-500" : "bg-emerald-500"
                          )}>
                             {type === 'payable' ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest">{type === 'payable' ? 'Saya Berhutang' : 'Piutang Masuk'}</p>
                       </button>
                    ))}
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Kontak / Entitas</label>
                       <div className="relative">
                          <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            required type="text" placeholder="Bapak Budi / Vendor A"
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                            value={formData.contactName}
                            onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Nominal</label>
                          <div className="relative">
                             <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                             <input 
                               required type="number" placeholder="0"
                               className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-black text-sm"
                               value={formData.totalAmount}
                               onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Jatuh Tempo</label>
                          <div className="relative">
                             <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                             <input 
                               required type="date"
                               className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-black text-sm h-[56px]"
                               value={formData.dueDate}
                               onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 <button 
                  type="submit"
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-100 hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 mt-4"
                 >
                   Simpan Catatan Kredit
                 </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
