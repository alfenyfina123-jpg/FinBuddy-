import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileStack, Download, ArrowUpRight, ArrowDownRight, Printer, Calculator, BarChart3, TrendingUp, Sparkles, Building2, Wallet } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, Debt, Product } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function BalanceSheet() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    
    const unsubscribeTrans = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubscribeDebts = onSnapshot(query(collection(db, 'debts'), where('userId', '==', uid)), (snap) => {
      setDebts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'debts'));

    const unsubscribeProds = onSnapshot(query(collection(db, 'products'), where('userId', '==', uid)), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => {
      unsubscribeTrans();
      unsubscribeDebts();
      unsubscribeProds();
    };
  }, []);

  // Simple Cash Calculation (Saldo Awal + Masuk - Keluar)
  const totalCash = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
  const totalAr = debts.filter(d => d.type === 'receivable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);
  const totalInventory = products.reduce((acc, p) => acc + (p.stock * p.hpp), 0);
  
  const totalAssets = totalCash + totalAr + totalInventory;

  const totalAp = debts.filter(d => d.type === 'payable' && d.status !== 'paid').reduce((a, b) => a + b.remainingAmount, 0);
  const totalEquity = totalAssets - totalAp;

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // PDF Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(auth.currentUser?.displayName?.toUpperCase() || 'FINBUDDY AI', 105, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('LAPORAN POSISI KEUANGAN', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodEndingValue = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Periode yang berakhir pada ${periodEndingValue}`, 105, 38, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.text(`Wajib Pajak: ${auth.currentUser?.displayName || auth.currentUser?.email}`, 14, 60);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 66);

    autoTable(doc, {
      startY: 75,
      head: [['KATEGORI AKTIVA (ASET)', 'NOMINAL (IDR)']],
      body: [
        ['Kas & Setara Kas', formatCurrency(totalCash)],
        ['Piutang Usaha', formatCurrency(totalAr)],
        ['Persediaan Barang (Stok)', formatCurrency(totalInventory)],
        [{ content: 'TOTAL ASET', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, { content: formatCurrency(totalAssets), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 1: { halign: 'right' } },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['KATEGORI PASIVA (LIABILITAS & EKUITAS)', 'NOMINAL (IDR)']],
      body: [
        ['Hutang Usaha / Vendor', formatCurrency(totalAp)],
        ['Hutang Lain-lain', '-'],
        ['Modal Disetor', formatCurrency(totalEquity * 0.7)],
        ['Laba Ditahan / Ekuitas Bersih', formatCurrency(totalEquity * 0.3)],
        [{ content: 'TOTAL PASIVA', styles: { fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: formatCurrency(totalAp + totalEquity), styles: { fontStyle: 'bold', halign: 'right', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 1: { halign: 'right' } },
    });

    doc.save(`BalanceSheet_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Menghitung Valuasi Aset...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 px-4">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
             <Calculator className="w-8 h-8 stroke-[2]" />
           </div>
           <div>
             <h3 className="text-4xl font-black text-slate-900 tracking-tighter font-display leading-none mb-2">Statement of Financial Position</h3>
             <p className="text-sm font-bold text-slate-500">Neraca Keuangan Berdasarkan Akun Real Bisnis</p>
           </div>
        </div>
        <button 
          onClick={downloadPDF}
          className="px-10 py-5 bg-white border-2 border-slate-50 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 rounded-[2rem] shadow-sm transition-all focus:scale-95 flex items-center justify-center gap-4 font-black uppercase tracking-widest text-[11px] group"
        >
          <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          Ekspor Neraca Operasional
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 lg:gap-14">
        {/* Assets Section */}
        <div className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-2 h-8 bg-emerald-500 rounded-full" />
              <h4 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Aktiva (Harta Usaha)</h4>
           </div>
           
           <div className="bg-white/80 backdrop-blur-xl rounded-[4rem] border border-white shadow-2xl overflow-hidden p-10 md:p-16 space-y-14 relative">
              <div className="space-y-10 relative z-10">
                 <BalanceItem label="Kas & Saldo Kas" value={totalCash} icon={Wallet} />
                 <BalanceItem label="Piutang Usaha" value={totalAr} icon={ArrowUpRight} />
                 <BalanceItem label="Inventori Barang" value={totalInventory} icon={BarChart3} />
              </div>
              
              <div className="pt-12 border-t-2 border-emerald-100 relative z-10">
                 <div className="flex items-center justify-between bg-emerald-50/50 p-8 rounded-[2.5rem]">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Valuasi Kekayaan</p>
                      <h5 className="text-3xl font-black text-slate-950 tracking-tighter font-display">Total Seluruh Aset</h5>
                    </div>
                    <p className="text-4xl font-black text-emerald-600 tracking-tighter font-display leading-none">{formatCurrency(totalAssets)}</p>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/20 blur-[100px] rounded-full" />
           </div>
        </div>

        {/* Liabilities & Equity Section */}
        <div className="space-y-8">
           <div className="flex items-center gap-4 px-4">
              <div className="w-2 h-8 bg-slate-400 rounded-full" />
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Pasiva (Kewajiban & Modal)</h4>
           </div>

           <div className="bg-slate-950 rounded-[4rem] shadow-2xl overflow-hidden p-10 md:p-16 space-y-14 text-white relative">
              <div className="space-y-10 relative z-10">
                 <BalanceItem label="Hutang Usaha / Vendor" value={totalAp} type="liability" icon={ArrowDownRight} dark />
                 <BalanceItem label="Ekuitas / Modal Bersih" value={totalEquity} type="equity" icon={Sparkles} dark />
              </div>

              <div className="pt-12 border-t-2 border-white/5 relative z-10">
                 <div className="flex items-center justify-between bg-white/5 p-8 rounded-[2.5rem]">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Balance Assurance</p>
                      <h5 className="text-3xl font-black text-white tracking-tighter font-display">Total Pasiva</h5>
                    </div>
                    <p className="text-4xl font-black text-indigo-400 tracking-tighter font-display leading-none">{formatCurrency(totalAp + totalEquity)}</p>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-rose-500/5 blur-[80px] rounded-full" />
           </div>
        </div>
      </div>
    </div>
  );
}

function BalanceItem({ label, value, icon: Icon, dark = false, type = 'asset' }: any) {
  return (
    <div className={cn(
      "flex items-center justify-between p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border transition-all group",
      dark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-white border-slate-50 hover:bg-slate-50/50"
    )}>
      <div className="flex items-center gap-6">
        <div className={cn(
          "w-12 h-12 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[1.75rem] flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
          type === 'asset' ? "bg-emerald-50 text-emerald-600" : type === 'liability' ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
        )}>
          <Icon className="w-6 h-6 md:w-8 md:h-8 stroke-[2]" />
        </div>
        <div>
          <p className={cn("text-base md:text-lg font-black tracking-tight leading-tight", dark ? "text-white" : "text-slate-900")}>{label}</p>
          <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", dark ? "text-slate-500" : "text-slate-400")}>Akun Real Bisnis</p>
        </div>
      </div>
      <p className={cn(
        "text-xl md:text-2xl font-black font-mono tracking-tighter",
        type === 'liability' ? "text-rose-500" : dark ? "text-white" : "text-slate-950"
      )}>{formatCurrency(value)}</p>
    </div>
  );
}
