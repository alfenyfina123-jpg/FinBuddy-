import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, Calendar, ArrowUpRight, ArrowDownRight, Printer, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function ProfitLossReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      // Client-side filtering for month/year
      const filtered = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
      });
      setTransactions(filtered);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
    return () => unsubscribe();
  }, [selectedMonth, selectedYear]);

  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((a: number, b: Transaction) => a + b.amount, 0);
  const totalHpp = transactions.filter(t => t.type === 'income').reduce((a: number, b: Transaction) => a + (b.hpp || 0), 0);
  const grossProfit = totalRevenue - totalHpp;
  
  // Categorized expenses
  const expensesByCategory = transactions
    .filter(t => t.type === 'expense' && t.category !== 'Belanja Stok')
    .reduce((acc: Record<string, number>, t: Transaction) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const operationalExpenses: number = (Object.values(expensesByCategory) as number[]).reduce((a: number, b: number) => a + b, 0);
  const netProfit = grossProfit - operationalExpenses;

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
    doc.text('LAPORAN LABA RUGI', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const currentPeriod = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    doc.text(`Periode: ${currentPeriod}`, 105, 38, { align: 'center' });
    
    doc.setTextColor(100, 100, 100);
    doc.text(`Wajib Pajak: ${auth.currentUser?.displayName || auth.currentUser?.email}`, 14, 60);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 66);

    autoTable(doc, {
      startY: 70,
      head: [['URAIAN LAPORAN KEUANGAN', 'NOMINAL (IDR)']],
      body: [
        [{ content: 'PENDAPATAN USAHA (REVENUE)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, { content: formatCurrency(totalRevenue), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } }],
        ['Penjualan Kotor', formatCurrency(totalRevenue)],
        ['Potongan/Retur', '-'],
        [{ content: 'HARGA POKOK PENJUALAN (COGS)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, { content: `(${formatCurrency(totalHpp)})`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } }],
        ['Beban Pokok Penjualan', formatCurrency(totalHpp)],
        [{ content: 'LABA KOTOR (GROSS PROFIT)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrency(grossProfit), styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } }],
        [{ content: 'BEBAN OPERASIONAL (OPEX)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, { content: `(${formatCurrency(operationalExpenses as number)})`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } }],
        ...Object.entries(expensesByCategory).map(([cat, val]) => [cat, formatCurrency(val as number)]),
        [{ content: 'LABA BERSIH (NET INCOME)', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: formatCurrency(netProfit), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 1: { halign: 'right' } },
    });

    doc.save(`ProfitLoss_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Menghitung Data Laba Rugi...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Period Selection Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100">
         <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilih Periode Laporan</h3>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-slate-900 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-100 ring-4 ring-indigo-50">
             <FileText className="w-7 h-7 stroke-[2]" />
           </div>
           <div>
             <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter font-display leading-none">Profit & Loss</h3>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Laporan Ikhtisar Laba Rugi Periode Berjalan</p>
           </div>
        </div>
        <button 
          onClick={downloadPDF}
          className="px-8 py-4 bg-white border-2 border-slate-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 rounded-3xl shadow-sm transition-all flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] group"
        >
          <Download className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
          Unduh Laporan Resmi
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] border border-white shadow-2xl overflow-hidden p-8 md:p-12 space-y-12">
            
            {/* Revenue Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Pendapatan Usaha</h4>
                 <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-3">
                 <PLItem label="Total Penjualan Barang" value={totalRevenue} />
                 <PLItem label="Pendapatan Jasa Lainnya" value={0} />
              </div>
            </div>

            {/* HPP Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Harga Pokok Penjualan</h4>
                 <TrendingDown className="w-4 h-4 text-rose-500" />
              </div>
              <div className="space-y-3">
                 <PLItem label="Beban Pokok Penjualan (COGS)" value={totalHpp} type="out" />
                 <div className="h-px bg-slate-50 mx-4" />
                 <PLItem label="Laba Kotor Usaha" value={grossProfit} highlight />
              </div>
            </div>

            {/* Expenses Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Beban Operasional</h4>
              </div>
              <div className="space-y-3">
                 {Object.entries(expensesByCategory).length > 0 ? Object.entries(expensesByCategory).map(([cat, val]) => (
                   <PLItem key={cat} label={cat} value={val} type="out" />
                 )) : (
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-4 bg-slate-50/50 rounded-2xl">Belum ada rincian beban</p>
                 )}
                 <div className="h-px bg-slate-50 mx-4" />
                 <PLItem label="Total Beban Operasional" value={operationalExpenses} type="out" />
              </div>
            </div>

            {/* Final Net Profit */}
            <div className="pt-12 border-t-2 border-slate-100">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50 p-8 rounded-[2.5rem]">
                  <div>
                    <h5 className="text-2xl font-black text-slate-900 tracking-tighter font-display">Laba Bersih Usaha</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sisa Hasil Usaha (SHU)</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-4xl md:text-5xl font-black font-display tracking-tighter leading-none mb-1",
                      netProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>{formatCurrency(netProfit)}</p>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      netProfit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      Margin: {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Sidebar Analysis */}
        <div className="space-y-8">
           <div className="bg-slate-900 rounded-[3rem] p-8 md:p-10 shadow-2xl text-white relative overflow-hidden">
              <div className="relative z-10 space-y-8">
                 <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wawasan Pajak</h4>
                 </div>
                 <div className="space-y-4">
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PPh Final 0.5% (PP 55)</p>
                       <p className="text-2xl font-black font-display tracking-tighter text-indigo-300">{formatCurrency(totalRevenue * 0.005)}</p>
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 leading-relaxed">Estimasi setoran pajak berdasarkan peredaran bruto periode ini.</p>
                 </div>
                 <button onClick={() => window.scrollTo(0, 0)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Lihat Detail Pajak</button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full" />
           </div>

           <div className="bg-white rounded-[3rem] border border-slate-50 p-8 md:p-10 shadow-xl space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4" /> History Bulanan
              </h4>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Bulan Ini</span>
                    <span className="text-xs font-black text-emerald-500">Normal</span>
                 </div>
                 <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full w-[65%]" />
                 </div>
                 <p className="text-[10px] text-slate-400 font-medium">Berdasarkan data 30 hari terakhir.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function PLItem({ label, value, type = 'in', highlight = false }: any) {
  return (
    <div className={cn(
      "flex items-center justify-between p-5 rounded-[1.5rem] transition-all group",
      highlight ? "bg-indigo-50/70 shadow-sm border border-indigo-100/50" : "hover:bg-slate-50/50 border border-transparent"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
          type === 'in' ? "bg-emerald-50 text-emerald-500" : type === 'out' ? "bg-rose-50 text-rose-500" : "bg-indigo-100 text-indigo-600"
        )}>
          {type === 'in' ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> : <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />}
        </div>
        <div>
          <p className={cn("text-sm font-black tracking-tight", highlight ? "text-indigo-950" : "text-slate-700")}>{label}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Entri Ledger</p>
        </div>
      </div>
      <p className={cn(
        "text-base font-black font-mono tracking-tight",
        type === 'out' ? "text-rose-500" : highlight ? "text-indigo-600 text-lg" : "text-slate-900"
      )}>{type === 'out' ? `(${formatCurrency(value)})` : formatCurrency(value)}</p>
    </div>
  );
}
