import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Calculator, AlertCircle, FileText, CheckCircle2, TrendingUp, Info, ChevronRight, Download, Send, Calendar, ShieldCheck, Sparkles, Clock, QrCode, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ComplianceChecklist {
  step1: boolean;
  step2: boolean;
  step3: boolean;
  updatedAt: any;
}

export default function TaxReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ComplianceChecklist>({ step1: false, step2: false, step3: false, updatedAt: null });

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'income')
    );

    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubscribeCheck = onSnapshot(doc(db, 'taxChecklist', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setChecklist(snap.data() as ComplianceChecklist);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'taxChecklist'));

    return () => {
      unsubscribeTrans();
      unsubscribeCheck();
    };
  }, []);

  const toggleStep = async (step: keyof Omit<ComplianceChecklist, 'updatedAt'>) => {
    if (!auth.currentUser) return;
    try {
      const newChecklist = { ...checklist, [step]: !checklist[step], updatedAt: serverTimestamp() };
      await setDoc(doc(db, 'taxChecklist', auth.currentUser.uid), newChecklist);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'taxChecklist');
    }
  };

  const totalBruto = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  const taxAmount = totalBruto * 0.005; // PPh Final UMKM 0.5%
  const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Laporan Estimasi Pajak PPh Final', 14, 20);
    doc.setFontSize(10);
    doc.text(`Wajib Pajak: ${auth.currentUser?.displayName || auth.currentUser?.email}`, 14, 30);
    doc.text(`Periode: ${currentMonth}`, 14, 36);
    
    doc.setFontSize(12);
    doc.text(`Total Peredaran Bruto: ${formatCurrency(totalBruto)}`, 14, 50);
    doc.text(`Tarif PPh Final UMKM: 0,5%`, 14, 58);
    doc.text(`Total Pajak Terutang: ${formatCurrency(taxAmount)}`, 14, 66);
    
    doc.save(`LaporanPajak_${currentMonth.replace(' ', '_')}.pdf`);
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Menghitung Estimasi Pajak...</div>;

  return (
    <div className="space-y-12">
      {/* Hero Tax Card */}
      <div className="bg-slate-900 rounded-[3rem] p-8 md:p-14 text-white relative overflow-hidden ring-1 ring-white/10 group">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
         <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/20 blur-[120px] rounded-full pointer-events-none" />
         
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:items-center">
            <div className="space-y-8">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 border border-indigo-400/30">
                    <Calculator className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight font-display">Estimasi PPh Final 0,5%</h3>
                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Sesuai PP No. 55 Tahun 2022</p>
                  </div>
               </div>

               <div className="space-y-10">
                  <div className="relative p-8 md:p-10 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 group-hover:bg-white/10 transition-colors">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Total Peredaran Bruto ({currentMonth})</p>
                     <h4 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter font-display">{formatCurrency(totalBruto)}</h4>
                     
                     <div className="mt-8 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                              <TrendingUp className="w-4 h-4" />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Peredaran Lancar</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                              <Calendar className="w-4 h-4" />
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Update Harian</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                     <button 
                      onClick={downloadPDF}
                      className="flex-1 px-8 py-5 bg-white text-slate-900 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center justify-center gap-3 group"
                     >
                        <Download className="w-4 h-4 text-indigo-500 group-hover:-translate-y-1 transition-transform" />
                        Download Laporan
                     </button>
                     <button className="flex-1 px-8 py-5 bg-indigo-600 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-900/40 hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-3">
                        <Send className="w-4 h-4" />
                        Kirim ke Konsultan
                     </button>
                  </div>
               </div>
            </div>

            <div className="p-10 md:p-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-[3rem] md:rounded-[4rem] shadow-2xl relative overflow-hidden group/tax">
               <div className="relative z-10 text-center">
                  <p className="text-[11px] md:text-sm font-black text-indigo-100 uppercase tracking-[0.5em] mb-4">Besaran Pajak Terutang</p>
                  <h4 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter font-display drop-shadow-2xl">{formatCurrency(taxAmount)}</h4>
                  <div className="mt-8 pt-8 border-t border-white/20">
                     <p className="text-[11px] md:text-sm font-bold text-white/70 leading-relaxed mb-6">
                        Pajak Terutang dihitung dari jumlah Peredaran Bruto dikalikan tarif PPh Final UMKM (0,5%).
                     </p>
                     <div className="flex bg-white/20 backdrop-blur-xl p-5 md:p-6 rounded-[2rem] border border-white/30 items-center justify-center gap-4">
                        <QrCode className="w-8 h-8 text-white" />
                        <div className="text-left">
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Kode Billing Pajak</p>
                           <p className="text-lg font-black text-white tracking-widest font-mono">MAP: 411128 KJS: 420</p>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover/tax:scale-150 transition-transform duration-1000" />
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
         {/* Checklist Section */}
         <div className="xl:col-span-2 space-y-8">
            <div className="flex items-center gap-3 mb-2 px-2">
               <ShieldCheck className="w-6 h-6 text-indigo-600" />
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter font-display">Checklist Kepatuhan</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
               <ComplianceStep 
                 num="01"
                 title="Selesaikan Kode Billing"
                 desc="Gunakan fitur SSE Pajak dengan kode MAP 411128 dan KJS 420 melalui DJP Online."
                 checked={checklist.step1}
                 onToggle={() => toggleStep('step1')}
               />
               <ComplianceStep 
                 num="02"
                 title="Pembayaran (Deadline)"
                 desc="Lakukan setoran ke Kas Negara paling lambat 15/06/2026 melalui Bank Persepsi."
                 checked={checklist.step2}
                 onToggle={() => toggleStep('step2')}
               />
               <ComplianceStep 
                 num="03"
                 title="Pelaporan SPT Masa"
                 desc="Input data pembayaran ke SPT Masa PPh Final UMKM paling lambat 20/06/2026."
                 checked={checklist.step3}
                 onToggle={() => toggleStep('step3')}
               />
            </div>

            <div className="bg-white/60 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl flex items-start gap-5">
               <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shrink-0 shadow-sm shadow-amber-100/50">
                  <Info className="w-6 h-6" />
               </div>
               <div className="space-y-4">
                  <p className="text-sm font-black text-slate-900 tracking-tight leading-relaxed">Peredaran Bruto Tidak Kena Pajak</p>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-widest opacity-80">
                    Sesuai UU HPP, jika peredaran bruto kumulatif Anda dalam 1 tahun pajak masih di bawah <span className="text-indigo-600 font-black">Rp 500juta</span>, maka Anda tidak dikenai PPh Final 0,5% untuk nominal tersebut.
                  </p>
               </div>
            </div>
         </div>

         {/* Regulation Side Area */}
         <div className="space-y-6">
            <div className="p-8 md:p-10 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Regulasi Terkait</h4>
               <div className="space-y-6">
                  <RegulationLink 
                     title="PP RI No. 55 Tahun 2022"
                     author="Peraturan Pemerintah"
                     desc="Tentang penyesuaian tarif & ambang batas pajak UMKM di Indonesia."
                  />
                  <div className="h-px bg-slate-100" />
                  <RegulationLink 
                     title="Tutorial DJP Online"
                     author="E-Filing Portal"
                     desc="Panduan langkah demi langkah pengisian SPT masa secara daring."
                  />
               </div>
            </div>

            <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] text-white relative overflow-hidden group">
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 relative z-10">Total Transaksi Dianalisis</p>
               <h5 className="text-3xl font-black text-white tracking-tighter relative z-10 font-display">{transactions.length} Entri</h5>
               <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-24 h-24 stroke-[1]" />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function ComplianceStep({ num, title, desc, checked, onToggle }: { num: string, title: string, desc: string, checked: boolean, onToggle: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onToggle}
      className={cn(
        "p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden group h-full flex flex-col",
        checked ? "bg-emerald-50 border-emerald-100" : "bg-white border-slate-50"
      )}
    >
      <div className="flex items-center justify-between mb-6">
         <span className={cn(
           "text-[11px] font-black tracking-[0.25em] font-display",
           checked ? "text-emerald-400" : "text-slate-200"
         )}>{num}</span>
         <div className={cn(
           "w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-md",
           checked ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-slate-50 text-slate-300 shadow-slate-100"
         )}>
           <Check className="w-5 h-5 stroke-[3]" />
         </div>
      </div>
      <h5 className={cn(
         "text-base font-black tracking-tight mb-3 transition-colors pr-4",
         checked ? "text-emerald-900" : "text-slate-900"
      )}>{title}</h5>
      <p className={cn(
        "text-[10px] font-bold leading-[1.6] uppercase tracking-widest opacity-60",
        checked ? "text-emerald-700" : "text-slate-400"
      )}>{desc}</p>
      
      {checked && (
         <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-emerald-100/50 rounded-full blur-xl" />
      )}
    </motion.div>
  );
}

function RegulationLink({ title, author, desc }: any) {
   return (
      <div className="group cursor-pointer">
         <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{title}</p>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 translate-x-0 group-hover:translate-x-1 transition-all" />
         </div>
         <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">{author}</p>
         <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest opacity-60">{desc}</p>
      </div>
   );
}
