import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { RefreshCw, Download, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function CashFlow() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [businessName, setBusinessName] = useState('Bisnis Saya');

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  useEffect(() => {
    if (!auth.currentUser) return;

    // Get business name using doc lookup
    const profileRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setBusinessName(snap.data().businessName || 'Bisnis Saya');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    const q = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTransactions();
    };
  }, []);

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const cashIn = filtered.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const cashOut = filtered.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const netCashFlow = cashIn - cashOut;

  // Beginning Balance (Cash flows before this month)
  const begBalanceTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() < selectedYear || (d.getFullYear() === selectedYear && d.getMonth() < selectedMonth);
  });
  const beginningBalance = begBalanceTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
  const endingBalance = beginningBalance + netCashFlow;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const periodStr = `${lastDay} ${months[selectedMonth]} ${selectedYear}`;

    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('LAPORAN ARUS KAS', 105, 24, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Untuk Periode yang Berakhir pada ${periodStr}`, 105, 30, { align: 'center' });
    doc.line(20, 35, 190, 35);

    autoTable(doc, {
      startY: 45,
      head: [['Aktivitas Operasional', 'Nilai']],
      body: [
        ['Saldo Awal Kas', formatCurrency(beginningBalance)],
        ['Arus Kas Masuk (Penerimaan)', formatCurrency(cashIn)],
        ['Arus Kas Keluar (Pengeluaran)', `(${formatCurrency(cashOut)})`],
        [{ content: 'Kenaikan/(Penurunan) Kas Bersih', styles: { fontStyle: 'bold' } }, { content: formatCurrency(netCashFlow), styles: { fontStyle: 'bold' } }],
        [{ content: 'Saldo Akhir Kas', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: formatCurrency(endingBalance), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]
      ],
      theme: 'plain',
    });

    doc.save(`Arus_Kas_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-3xl" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Calendar className="text-slate-400 w-5 h-5" />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="text-xs font-black uppercase tracking-widest bg-slate-50 rounded-xl px-4 py-2 outline-none">
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="text-xs font-black uppercase tracking-widest bg-slate-50 rounded-xl px-4 py-2 outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={exportToPDF} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer shadow-lg shadow-slate-200">
          <Download className="w-4 h-4" /> Ekspor PDF
        </button>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <RefreshCw className="w-8 h-8 text-indigo-600" />
        </div>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-10">Ringkasan Arus Kas</h3>
        
        <div className="w-full max-w-2xl space-y-6">
          <FlowItem label="Saldo Awal Bulan" amount={beginningBalance} />
          <FlowItem label="Total Kas Masuk (+)" amount={cashIn} type="in" />
          <FlowItem label="Total Kas Keluar (-)" amount={cashOut} type="out" />
          <div className="pt-8 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
            <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Saldo Akhir Kas</p>
            <p className="text-3xl font-black text-indigo-600 tracking-tighter">{formatCurrency(endingBalance)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowItem({ label, amount, type }: any) {
  return (
    <div className="flex justify-between items-center py-4 px-6 bg-slate-50 rounded-2xl">
      <div className="flex items-center gap-3">
        {type === 'in' && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
        {type === 'out' && <ArrowDownRight className="w-4 h-4 text-rose-500" />}
        <p className="text-xs font-bold text-slate-600">{label}</p>
      </div>
      <p className={cn(
        "text-sm font-black font-mono",
        type === 'in' ? "text-emerald-600" : type === 'out' ? "text-rose-500" : "text-slate-900"
      )}>{type === 'out' ? `(${formatCurrency(amount)})` : formatCurrency(amount)}</p>
    </div>
  );
}
