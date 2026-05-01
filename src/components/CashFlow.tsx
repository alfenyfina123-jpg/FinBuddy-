import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, orderBy } from 'firebase/firestore';
import { RefreshCw, Download, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function CashFlow() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, []);

  const totalIn = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const netCashFlow = totalIn - totalOut;

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(auth.currentUser?.displayName?.toUpperCase() || 'FINBUDDY AI', 105, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('LAPORAN ARUS KAS', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodEndingValue = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Periode yang berakhir pada ${periodEndingValue}`, 105, 38, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.text(`Wajib Pajak: ${auth.currentUser?.displayName || auth.currentUser?.email}`, 14, 60);

    autoTable(doc, {
      startY: 60,
      head: [['KETERANGAN AKTIVITAS', 'MASUK (IN)', 'KELUAR (OUT)', 'NET CASH FLOW']],
      body: [[
        'Aktivitas Operasional & Penjualan',
        formatCurrency(totalIn),
        formatCurrency(totalOut),
        { content: formatCurrency(netCashFlow), styles: { fontStyle: 'bold', textColor: netCashFlow >= 0 ? [5, 150, 105] : [244, 63, 94] } }
      ]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10, cellPadding: 6 },
    });
    
    doc.save(`CashFlow_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Menghitung Aliran Kas...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-100 ring-4 ring-emerald-50">
             <RefreshCw className="w-7 h-7 stroke-[2]" />
           </div>
           <div>
             <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter font-display leading-none">Cash Flow Statement</h3>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Laporan Pergerakan Kas Masuk dan Keluar</p>
           </div>
        </div>
        <button 
          onClick={downloadPDF}
          className="px-8 py-4 bg-white border-2 border-slate-50 text-slate-500 hover:text-emerald-600 hover:border-emerald-100 rounded-3xl shadow-sm transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] group"
        >
          <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
          Unduh Laporan Kas
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] border border-white shadow-2xl p-10 md:p-16 space-y-14 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 relative z-10">
           <CashItem label="Arus Kas Masuk (Inflow)" amount={totalIn} type="in" />
           <CashItem label="Arus Kas Keluar (Outflow)" amount={totalOut} type="out" />
        </div>
        <div className="pt-12 border-t-2 border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Positioning Bulanan</p>
              <h4 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter font-display">Kenaikan/Penurunan Kas Netto</h4>
           </div>
           <p className={cn(
             "text-4xl md:text-5xl font-black font-display tracking-tighter leading-none",
             netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"
           )}>{formatCurrency(netCashFlow)}</p>
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-100/20 blur-[100px] rounded-full" />
      </div>
    </div>
  );
}

function CashItem({ label, amount, type }: any) {
  return (
    <div className="p-8 bg-white/50 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-4 mb-4">
        <div className={cn(
          "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg",
          type === 'in' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" : "bg-rose-50 text-rose-500 shadow-rose-100"
        )}>
          {type === 'in' ? <ArrowUpRight className="w-6 h-6 stroke-[2.5]" /> : <ArrowDownRight className="w-6 h-6 stroke-[2.5]" />}
        </div>
        <div>
          <p className="text-sm font-black text-slate-900 tracking-tight">{label}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Operasional Bisnis</p>
        </div>
      </div>
      <p className={cn(
        "text-2xl md:text-3xl font-black font-mono tracking-tighter",
        type === 'out' ? "text-rose-500" : "text-emerald-600"
      )}>{type === 'out' ? `(${formatCurrency(amount)})` : formatCurrency(amount)}</p>
    </div>
  );
}
