import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Scale, Download, Calendar, ShieldCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function BalanceSheet() {
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

  // For a basic MSME app, Neraca reflects total cash accumulated as Assets
  const upToDateTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() < selectedYear || (d.getFullYear() === selectedYear && d.getMonth() <= selectedMonth);
  });

  const totalIncome = upToDateTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const totalExpense = upToDateTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const cashBalance = totalIncome - totalExpense;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const periodStr = `${lastDay} ${months[selectedMonth]} ${selectedYear}`;

    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('NERACA (POSISI KEUANGAN)', 105, 24, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Per Tanggal ${periodStr}`, 105, 30, { align: 'center' });
    doc.line(20, 35, 190, 35);

    autoTable(doc, {
      startY: 45,
      head: [['AKTIVA (ASET)', 'Jumlah', 'PASIVA (LIABILITAS & EKUITAS)', 'Jumlah']],
      body: [
        ['Kas dan Setara Kas', formatCurrency(cashBalance), 'Utang Usaha', 'Rp 0'],
        ['Piutang', 'Rp 0', 'Ekuitas (Modal)', formatCurrency(cashBalance)],
        ['Persediaan', '-', 'Laba Ditahan', '-'],
        [{ content: 'TOTAL AKTIVA', styles: { fontStyle: 'bold' } }, { content: formatCurrency(cashBalance), styles: { fontStyle: 'bold' } }, { content: 'TOTAL PASIVA', styles: { fontStyle: 'bold' } }, { content: formatCurrency(cashBalance), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'grid',
    });

    doc.save(`Neraca_${months[selectedMonth]}_${selectedYear}.pdf`);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Assets Bento */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Aktiva (Aset)</h3>
            <div className="space-y-6">
              <BalanceItem label="Kas dan Setara Kas" amount={cashBalance} sub="Likuiditas Utama" />
              <BalanceItem label="Piutang Usaha" amount={0} sub="Estimasi Tertagih" />
              <div className="pt-6 border-t border-slate-100 mt-6 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Aktiva</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(cashBalance)}</p>
                </div>
                <Scale className="w-10 h-10 text-emerald-500 opacity-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Pasiva Bento */}
        <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Pasiva (Liabilitas & Ekuitas)</h3>
            <div className="space-y-6">
              <BalanceItem label="Kewajiban / Utang" amount={0} sub="Total Tagihan" dark />
              <BalanceItem label="Modal Pemilik" amount={cashBalance} sub="Net Equity" dark />
              <div className="pt-6 border-t border-slate-800 mt-6 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Pasiva</p>
                  <p className="text-4xl font-black text-white tracking-tight">{formatCurrency(cashBalance)}</p>
                </div>
                <ShieldCheck className="w-10 h-10 text-indigo-400 opacity-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceItem({ label, amount, sub, dark }: any) {
  return (
    <div className={cn("flex justify-between items-center p-4 rounded-2xl", dark ? "bg-slate-800/50" : "bg-slate-50")}>
      <div>
        <p className={cn("text-xs font-bold", dark ? "text-slate-300" : "text-slate-700")}>{label}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{sub}</p>
      </div>
      <p className={cn("text-sm font-black", dark ? "text-white" : "text-slate-900")}>{formatCurrency(amount)}</p>
    </div>
  );
}
