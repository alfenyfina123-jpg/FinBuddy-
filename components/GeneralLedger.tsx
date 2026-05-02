import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Book, Download, Calculator, Library, ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown, Layers, Hash, Calendar } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, UserProfile } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function GeneralLedger() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

    const q = query(
      collection(db, 'transactions'), 
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      // Client-side sorting & filtering
      const sorted = [...allTransactions].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return aTime - bTime;
      });

      const filtered = sorted.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
      });
      setTransactions(filtered);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    const unsubscribeProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    return () => {
      unsubscribe();
      unsubscribeProfile();
    };
  }, [selectedMonth, selectedYear]);

  const categorizedTransactions = transactions.reduce((acc: any, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const downloadPDF = (category: string, trans: Transaction[]) => {
    const doc = new jsPDF();
    
    // Corporate Header for Ledger
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.businessName?.toUpperCase() || auth.currentUser?.displayName?.toUpperCase() || 'FINBUDDY AI', 105, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`BUKU BESAR: ${category.toUpperCase()}`, 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodValue = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    doc.text(`Periode: ${periodValue}`, 105, 38, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(`Entity: ${auth.currentUser?.displayName || auth.currentUser?.email}`, 14, 60);
    doc.text(`Run Date: ${new Date().toLocaleString('id-ID')}`, 14, 65);

    let balance = 0;
    const tableData = trans.map(t => {
      const debit = t.type === 'income' ? t.amount : 0;
      const credit = t.type === 'expense' ? t.amount : 0;
      balance += (debit - credit);
      return [
        t.date,
        t.id.substring(0,8).toUpperCase(),
        t.description.toUpperCase(),
        debit ? formatCurrency(debit) : '-',
        credit ? formatCurrency(credit) : '-',
        formatCurrency(balance)
      ];
    });

    autoTable(doc, {
      startY: 70,
      head: [['POST DATE', 'REF', 'ACTIVITY DESCRIPTION', 'DEBIT (DR)', 'CREDIT (CR)', 'BALANCE']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 3 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`Closing Balance for ${category}: ${formatCurrency(balance)}`, 14, finalY);

    doc.save(`Ledger_${category}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-6">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Reconciling Ledger Entries...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-32">
      {/* Period Selection Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100">
         <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilih Periode Buku Besar</h3>
         </div>
         <div className="flex gap-2">
            <select 
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
               className="px-6 py-3 bg-slate-50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all cursor-pointer"
            >
               {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
               ))}
            </select>
            <select 
               value={selectedYear}
               onChange={(e) => setSelectedYear(Number(e.target.value))}
               className="px-6 py-3 bg-slate-50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all cursor-pointer"
            >
               {[2023, 2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
               ))}
            </select>
         </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-2">
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[9px] font-black uppercase tracking-wider">Classification Ledger</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider">ISO-9001 Alignment</span>
           </div>
           <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100 ring-8 ring-indigo-50">
                <Library className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter font-display leading-[0.9]">
                  {profile?.businessName || 'General Ledger'}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">Buku Besar Per Akun & Kategori</p>
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(categorizedTransactions).map(([category, trans]: [string, any]) => {
          let runningBalance = 0;
          const isExpanded = expandedCategories.includes(category);
          
          return (
            <div key={category} className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden group transition-all duration-500 hover:shadow-2xl">
              <div 
                onClick={() => toggleCategory(category)}
                className="p-8 md:p-10 flex items-center justify-between cursor-pointer group-hover:bg-slate-50 transition-colors"
              >
                 <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                       <Layers className="w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="text-2xl font-black text-slate-900 tracking-tight font-display">{category}</h4>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                         Total Transaksi: <span className="text-indigo-600">{trans.length} Records</span>
                       </p>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); downloadPDF(category, trans); }}
                      className="px-6 py-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 rounded-2xl shadow-sm transition-all flex items-center gap-2 font-black uppercase tracking-widest text-[9px] group/btn"
                    >
                      <Download className="w-4 h-4 group-hover/btn:-translate-y-0.5 transition-transform" />
                      PDF
                    </button>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 transition-all duration-500",
                      isExpanded ? "rotate-180 bg-slate-900 text-white" : ""
                    )}>
                       <ChevronDown className="w-5 h-5" />
                    </div>
                 </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-10 py-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Post Date</th>
                            <th className="px-10 py-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Ref ID</th>
                            <th className="px-10 py-6 text-[9px] font-black uppercase tracking-widest text-slate-400">Activity Detail</th>
                            <th className="px-10 py-6 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">DR (Debit)</th>
                            <th className="px-10 py-6 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">CR (Credit)</th>
                            <th className="px-10 py-6 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Net Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                          {trans.map((t: Transaction, idx: number) => {
                            const debit = t.type === 'income' ? t.amount : 0;
                            const credit = t.type === 'expense' ? t.amount : 0;
                            runningBalance += (debit - credit);
                            return (
                              <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-10 py-6">
                                  <p className="text-[12px] font-black text-slate-900 font-mono tracking-tighter">
                                    {new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                  </p>
                                </td>
                                <td className="px-10 py-6">
                                  <div className="flex items-center gap-1.5 text-slate-300">
                                     <Hash className="w-3 h-3" />
                                     <span className="text-[10px] font-black uppercase tracking-tighter">{t.id.slice(-6).toUpperCase()}</span>
                                  </div>
                                </td>
                                <td className="px-10 py-6">
                                  <p className="text-[13px] font-bold text-slate-600 tracking-tight">{t.description}</p>
                                </td>
                                <td className="px-10 py-6 text-right">
                                  {debit > 0 ? (
                                    <span className="text-sm font-black text-emerald-600 font-mono tracking-tighter">+{formatCurrency(debit)}</span>
                                  ) : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-10 py-6 text-right">
                                  {credit > 0 ? (
                                    <span className="text-sm font-black text-rose-500 font-mono tracking-tighter">-{formatCurrency(credit)}</span>
                                  ) : <span className="text-slate-200">—</span>}
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <div className="flex justify-end">
                                      <span className={cn(
                                        "px-4 py-1.5 rounded-xl text-xs font-black font-mono shadow-sm",
                                        runningBalance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                      )}>
                                        {formatCurrency(runningBalance)}
                                      </span>
                                   </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                           <tr className="bg-slate-900">
                              <td colSpan={5} className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Closing Balance Value</td>
                              <td className="px-10 py-8 text-right text-xl font-black text-white font-display tracking-tight">
                                 {formatCurrency(runningBalance)}
                              </td>
                           </tr>
                        </tfoot>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {Object.keys(categorizedTransactions).length === 0 && !loading && (
          <div className="py-32 bg-white rounded-[3rem] border border-slate-50 text-center">
             <div className="flex flex-col items-center justify-center opacity-10">
                <Library className="w-20 h-20 mb-6" />
                <p className="text-2xl font-black uppercase tracking-[0.3em] text-slate-900">No Ledger Data</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
