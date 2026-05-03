import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BookOpen, Download, Calendar, ArrowRight, Printer, Search, Filter, Hash, MoreHorizontal } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, UserProfile } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function GeneralJournal() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        // Fallback to createdAt if dates are same
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
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

  const getDoubleEntries = (t: Transaction) => {
    const entries = [];
    const date = t.date;
    const ref = t.id.slice(-6).toUpperCase();

    if (t.type === 'income') {
      // 1. Debit Cash (Asset +)
      entries.push({
        date,
        ref,
        account: 'Kas / Bank (Asset)',
        description: t.description || t.category,
        debit: t.amount,
        credit: 0,
        isCreditRow: false
      });
      // 2. Credit Revenue/Account (Equity + or Asset -)
      let creditAccount = `Pendapatan: ${t.category}`;
      if (t.category.toLowerCase().includes('piutang')) {
        creditAccount = 'Piutang Usaha (Asset -)';
      }
      entries.push({
        date,
        ref,
        account: creditAccount,
        description: '', // Sub-description often empty for second line
        debit: 0,
        credit: t.amount,
        isCreditRow: true
      });
    } else {
      // 1. Debit Expense/Asset/Liability (Equity - or Asset + or Liability -)
      let debitAccount = `Beban: ${t.category}`;
      if (t.category.toLowerCase().includes('utang')) {
        debitAccount = 'Utang Usaha (Liabilitas -)';
      } else if (t.category.toLowerCase().includes('pajak')) {
        debitAccount = 'Beban Pajak';
      } else if (['peralatan', 'mesin', 'kendaraan', 'inventori', 'stok'].some(k => t.category.toLowerCase().includes(k))) {
        debitAccount = `${t.category} (Asset +)`;
      }

      entries.push({
        date,
        ref,
        account: debitAccount,
        description: t.description || t.category,
        debit: t.amount,
        credit: 0,
        isCreditRow: false
      });
      // 2. Credit Cash (Asset -)
      entries.push({
        date,
        ref,
        account: 'Kas / Bank (Asset -)',
        description: '',
        debit: 0,
        credit: t.amount,
        isCreditRow: true
      });
    }
    return entries;
  };

  const filtered = transactions.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allEntries = filtered.flatMap(t => getDoubleEntries(t));

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Premium Dashboard style PDF
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(profile?.businessName?.toUpperCase() || auth.currentUser?.displayName?.toUpperCase() || 'FINBUDDY', 105, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('JURNAL UMUM (DOUBLE-ENTRY)', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodValue = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    doc.text(`Periode: ${periodValue}`, 105, 38, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.text(`ID Entitas: ${auth.currentUser?.uid.substring(0, 12)}`, 14, 60);

    autoTable(doc, {
      startY: 70,
      head: [['Post Date', 'Ref', 'Account & Description', 'Debit (DR)', 'Credit (CR)']],
      body: allEntries.map(e => [
        e.date,
        e.ref,
        e.isCreditRow ? `      ${e.account}` : e.account + (e.description ? `\n      ${e.description}` : ''),
        e.debit > 0 ? formatCurrency(e.debit) : '-',
        e.credit > 0 ? formatCurrency(e.credit) : '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 3, font: 'helvetica' },
      columnStyles: { 
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
    });

    const totalIn = allEntries.reduce((a, b) => a + b.debit, 0);
    const totalOut = allEntries.reduce((a, b) => a + b.credit, 0);

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 10, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE TOTAL', 20, finalY + 6.5);
    doc.text(formatCurrency(totalIn), 140, finalY + 6.5, { align: 'right' });
    doc.text(formatCurrency(totalOut), 190, finalY + 6.5, { align: 'right' });

    doc.save(`FinBuddy_Journal_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center gap-6">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Syncing Operational Logs...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Period Selection Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100">
         <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilih Masa Jurnal</h3>
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

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 px-2">
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded text-[9px] font-black uppercase tracking-wider">Accounting Standard</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-wider">Audited v2.0</span>
           </div>
           <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-200 ring-8 ring-slate-50">
                <BookOpen className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter font-display leading-[0.9]">
                  {profile?.businessName || 'General Journal'}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-3">Rangkuman Kronologis Transaksi Bisnis</p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative group w-full sm:w-80">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Lookup entri jurnal..."
                className="w-full pl-13 pr-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] outline-none text-xs font-bold focus:ring-8 focus:ring-slate-50 transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <button 
             onClick={downloadPDF}
             className="px-10 py-5 bg-slate-900 text-white hover:bg-slate-800 rounded-[1.5rem] shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] shrink-0"
           >
             <Download className="w-4 h-4 text-rose-400" />
             Ekspor PDF
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-50 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/5 border-b border-white">
                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Date/Time</th>
                <th className="px-10 py-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Reference & Entity Description</th>
                <th className="px-10 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Debit (Assets +)</th>
                <th className="px-10 py-8 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Credit (Equity +)</th>
                <th className="px-8 py-8 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {allEntries.map((e, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.005 }}
                  key={`${e.ref}-${idx}`} 
                  className={cn(
                    "group hover:bg-slate-50 transition-colors",
                    e.isCreditRow ? "bg-slate-50/30" : ""
                  )}
                >
                  <td className="px-10 py-5">
                    {!e.isCreditRow && (
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                          {new Date(e.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                          {new Date(e.date).getFullYear()}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-10 py-5">
                    <div className="space-y-1">
                       <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-[13px] font-bold transition-colors",
                            e.isCreditRow ? "pl-8 text-slate-500 italic" : "text-slate-900 group-hover:text-indigo-600"
                          )}>
                            {e.account}
                          </span>
                          {!e.isCreditRow && (
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                               <Hash className="w-2.5 h-2.5" /> {e.ref}
                            </span>
                          )}
                       </div>
                       {!e.isCreditRow && e.description && (
                         <p className="text-[10px] text-slate-400 pl-4 border-l-2 border-slate-100 italic">{e.description}</p>
                       )}
                    </div>
                  </td>
                  <td className="px-10 py-5 text-right">
                    {e.debit > 0 ? (
                       <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{formatCurrency(e.debit)}</span>
                    ) : (
                       <span className="text-slate-200">—</span>
                    )}
                  </td>
                  <td className="px-10 py-5 text-right">
                    {e.credit > 0 ? (
                       <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{formatCurrency(e.credit)}</span>
                    ) : (
                       <span className="text-slate-200">—</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                     {!e.isCreditRow && (
                       <button className="p-2 text-slate-200 hover:text-slate-400 transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                       </button>
                     )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
               <tr className="bg-slate-50/50">
                  <td colSpan={2} className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Grand Summary (Balanced Journal)</td>
                  <td className="px-10 py-8 text-right text-lg font-black text-slate-950 font-display tracking-tight">
                     {formatCurrency(allEntries.reduce((a, b) => a + b.debit, 0))}
                  </td>
                  <td className="px-10 py-8 text-right text-lg font-black text-slate-950 font-display tracking-tight">
                     {formatCurrency(allEntries.reduce((a, b) => a + b.credit, 0))}
                  </td>
                  <td></td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
