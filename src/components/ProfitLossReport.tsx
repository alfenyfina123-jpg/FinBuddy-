import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { FileText, Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function ProfitLossReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [businessName, setBusinessName] = useState('Bisnis Saya');

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    if (!auth.currentUser) return;

    // Get business name using doc lookup (more efficient and direct)
    const profileRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setBusinessName(snap.data().businessName || 'Bisnis Saya');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTransactions();
    };
  }, [selectedMonth, selectedYear]);

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const totalIncome = filtered
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = filtered
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const periodString = `${lastDayOfMonth} ${months[selectedMonth]} ${selectedYear}`;

    // Header
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('LAPORAN LABA RUGI', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Untuk Periode yang Berakhir pada ${periodString}`, 105, 32, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    // Summary Content
    doc.setFontSize(12);
    doc.text('RINGKASAN', 20, 50);
    
    autoTable(doc, {
      startY: 55,
      head: [['Keterangan', 'Jumlah']],
      body: [
        ['Total Pendapatan (Pemasukan)', formatCurrency(totalIncome)],
        ['Total Beban (Pengeluaran)', formatCurrency(totalExpense)],
        [{ content: 'Laba (Rugi) Bersih', styles: { fontStyle: 'bold' } }, { content: formatCurrency(netProfit), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'plain',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [240, 240, 240] }
    });

    // Detailed Table
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('RINCIAN TRANSAKSI', 20, finalY);

    const tableData = filtered.map(t => [
      t.date,
      t.category,
      t.description,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      formatCurrency(t.amount)
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Tanggal', 'Kategori', 'Deskripsi', 'Jenis', 'Nominal']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // Brand indigo
    });

    doc.save(`Laporan_Laba_Rugi_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  if (loading) return <div className="animate-pulse space-y-6">
    <div className="h-48 bg-gray-100 rounded-3xl" />
    <div className="h-96 bg-gray-100 rounded-3xl" />
  </div>;

  return (
    <div className="space-y-8">
      {/* Search/Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Calendar className="text-slate-400 w-5 h-5" />
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="text-sm font-black uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 outline-none cursor-pointer text-slate-600"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="text-sm font-black uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 outline-none cursor-pointer text-slate-600"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button 
          onClick={exportToPDF}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Ekspor PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* P&L Main Visual */}
        <div className="md:col-span-8 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Laporan Laba Rugi</h3>
            <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tight">Kinerja Finansial</h2>
            
            <div className="space-y-6">
              <PLItem label="Total Pemasukan" amount={totalIncome} icon={TrendingUp} color="emerald" />
              <PLItem label="Total Pengeluaran" amount={totalExpense} icon={TrendingDown} color="rose" />
              <div className="pt-6 border-t border-slate-100 mt-6">
                 <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Laba (Rugi) Bersih</p>
                      <p className={cn(
                        "text-5xl font-black tracking-tighter leading-none",
                        netProfit >= 0 ? "text-emerald-600" : "text-rose-500"
                      )}>{formatCurrency(netProfit)}</p>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest",
                      netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {netProfit >= 0 ? 'Surplus' : 'Defisit'}
                    </div>
                 </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Info Column */}
        <div className="md:col-span-4 space-y-6">
           <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
              <FileText className="w-8 h-8 text-indigo-400 mb-4" />
              <h4 className="text-sm font-black uppercase tracking-widest mb-3">Panduan Laporan</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Laporan ini merangkum seluruh transaksi kas yang dicatat dalam periode terpilih. Gunakan laporan ini untuk mengevaluasi efisiensi operasional usaha Anda.
              </p>
           </div>
           
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Periode Aktif</p>
              <p className="text-xl font-black text-slate-900">{months[selectedMonth]} {selectedYear}</p>
           </div>
        </div>
      </div>
    </div>
  );
}

function PLItem({ label, amount, icon: Icon, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          <Icon className="w-5 h-5 stroke-[3]" />
        </div>
        <p className="text-sm font-bold text-slate-700">{label}</p>
      </div>
      <p className={cn(
        "text-lg font-black tracking-tight",
        color === 'emerald' ? "text-slate-900" : "text-rose-500"
      )}>{formatCurrency(amount)}</p>
    </div>
  );
}
