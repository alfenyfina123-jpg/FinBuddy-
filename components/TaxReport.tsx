import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Calculator, AlertCircle, FileText, CheckCircle2, TrendingUp, Info, ChevronRight, Download, Send, Calendar, ShieldCheck, Sparkles, Clock, QrCode, Check, Building, Printer, UserCheck, ShieldAlert } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, UserProfile } from '../types';
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
  const [allMonthTransactions, setAllMonthTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [checklist, setChecklist] = useState<ComplianceChecklist>({ step1: false, step2: false, step3: false, updatedAt: null });
  const [taxType, setTaxType] = useState<'pph' | 'ppn'>('pph');

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch all transactions for the user to do client-side filtering by month/year
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const allTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      // Filter for selected month and year
      const filtered = allTrans.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
      });

      setAllMonthTransactions(filtered);
      setTransactions(filtered.filter(t => t.type === 'income'));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubscribeCheck = onSnapshot(doc(db, 'taxChecklist', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setChecklist(snap.data() as ComplianceChecklist);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'taxChecklist'));

    const unsubscribeProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    return () => {
      unsubscribeTrans();
      unsubscribeCheck();
      unsubscribeProfile();
    };
  }, [selectedMonth, selectedYear]);

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
  const pphRate = (profile?.pphRate ?? 0.5) / 100;
  const ppnRate = (profile?.ppnRate ?? 11) / 100;
  
  const taxAmount = totalBruto * pphRate;
  const currentPeriod = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // PPN Logic
  const incomeTrans = allMonthTransactions.filter(t => t.type === 'income');
  // Eligible expenses for input tax (exclude salary, transport, etc. generally)
  const expenseTrans = allMonthTransactions.filter(t => t.type === 'expense');
  
  const dppKeluaran = incomeTrans.reduce((acc, curr) => acc + curr.amount, 0);
  const dppMasukan = expenseTrans.reduce((acc, curr) => acc + curr.amount, 0);
  
  const pajakKeluaran = dppKeluaran * ppnRate;
  const pajakMasukan = dppMasukan * ppnRate;
  const ppnTerutang = pajakKeluaran - pajakMasukan;

  // Group transactions by date for the summary table
  const dailySummary = (taxType === 'pph' ? transactions : allMonthTransactions).reduce((acc: any, curr) => {
    const d = curr.date;
    acc[d] = (acc[d] || 0) + (curr.type === 'income' ? curr.amount : -curr.amount);
    return acc;
  }, {});

  const sortedDates = Object.keys(dailySummary).sort((a, b) => b.localeCompare(a));

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header Color Bar
    doc.setFillColor(15, 23, 42); // Blue Slate 900
    doc.rect(0, 0, 210, 45, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(taxType === 'pph' ? 'LAPORAN PAJAK UMKM' : 'ESTIMASI PPN (VAT)', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(taxType === 'pph' ? `REKAPITULASI PEREDARAN BRUTO - TARIF ${profile?.pphRate ?? 0.5}%` : `ESTIMASI PAJAK KELUARAN & MASUKAN (${profile?.ppnRate ?? 11}%)`, 14, 30);
    
    // Reset Text Color
    doc.setTextColor(15, 23, 42);
    
    // Business Info Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.roundedRect(14, 52, 182, 35, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA WAJIB PAJAK', 20, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`NAMA USAHA : ${profile?.businessName || profile?.displayName || 'N/A'}`, 20, 67);
    doc.text(`NPWP       : ${profile?.npwp || 'Belum Diatur'}`, 20, 73);
    doc.text(`MASA PAJAK : ${currentPeriod}`, 20, 79);

    // Summary Box
    doc.setFillColor(taxType === 'pph' ? 79 : 14, taxType === 'pph' ? 70 : 165, taxType === 'pph' ? 229 : 233); // Indigo or Cyan
    doc.roundedRect(140, 59, 50, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(taxType === 'pph' ? `Pajak (${profile?.pphRate ?? 0.5}%)` : 'PPN ESTIMASI', 145, 65);
    doc.setFontSize(12);
    doc.text(formatCurrency(taxType === 'pph' ? taxAmount : ppnTerutang), 145, 75);

    doc.setTextColor(15, 23, 42);

    if (taxType === 'ppn') {
      autoTable(doc, {
        startY: 95,
        head: [['RINCIAN PPN', 'JUMLAH (IDR)']],
        body: [
          ['DASAR PENGENAAN PAJAK (DPP) KELUARAN', formatCurrency(dppKeluaran)],
          [`PAJAK KELUARAN (${profile?.ppnRate ?? 11}%)`, formatCurrency(pajakKeluaran)],
          ['DASAR PENGENAAN PAJAK (DPP) MASUKAN', formatCurrency(dppMasukan)],
          [`PAJAK MASUKAN (${profile?.ppnRate ?? 11}%)`, formatCurrency(pajakMasukan)],
          ['ESTIMASI PPN KURANG/LEBIH BAYAR', formatCurrency(ppnTerutang)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right' } }
      });
    } else {
      const tableData = sortedDates.map(date => [
        new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        formatCurrency(dailySummary[date]).replace('Rp ', '')
      ]);

      autoTable(doc, {
        startY: 95,
        head: [['TANGGAL TRANSAKSI', 'PEREDARAN BRUTO (IDR)']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        columnStyles: { 1: { halign: 'right' } }
      });
    }

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 20, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(taxType === 'pph' ? 'TOTAL PEREDARAN BRUTO BULAN INI' : 'TOTAL ESTIMASI PAJAK BULAN INI', 20, finalY + 12);
    doc.text(formatCurrency(taxType === 'pph' ? totalBruto : ppnTerutang), 190, finalY + 12, { align: 'right' });

    let y = finalY + 35;
    if (taxType === 'pph' && totalBruto < 500000000) {
       doc.setFontSize(8);
       doc.setFont('helvetica', 'italic');
       doc.setTextColor(100, 100, 100);
       doc.text('* Menunggu kumulatif ambang batas Rp 500jt (PTKP) sesuai UU HPP.', 14, y);
       y += 10;
    }

    if (y > 250) { doc.addPage(); y = 30; }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const location = profile?.address?.split(',')[0] || 'Indonesia';
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    doc.text(`${location}, ${today}`, 140, y);
    y += 8;
    doc.text('Wajib Pajak / Pengusaha,', 140, y);
    y += 25;
    doc.setFont('helvetica', 'bold');
    doc.text(`( ${profile?.directorName || profile?.displayName || '..........................'} )`, 140, y);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 180, 180);
    doc.text('Laporan ini dihasilkan secara otomatis oleh Asisten Bisnis Pintar (AIS)', 105, 285, { align: 'center' });

    doc.save(`Laporan_Pajak_${currentPeriod.replace(' ', '_')}.pdf`);
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Menghitung Estimasi Pajak...</div>;

  return (
    <div className="space-y-12">
      {/* Period & Tax Type Selector */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100">
           <div className="flex items-center gap-4">
              <Calendar className="w-6 h-6 text-indigo-600" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilih Periode Laporan</h3>
           </div>
           <div className="flex gap-2">
              <select 
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(Number(e.target.value))}
                 className="px-6 py-3 bg-slate-50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all"
              >
                 {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                 ))}
              </select>
              <select 
                 value={selectedYear}
                 onChange={(e) => setSelectedYear(Number(e.target.value))}
                 className="px-6 py-3 bg-slate-50 border-2 border-slate-50 focus:border-indigo-100 rounded-[1.25rem] outline-none font-black text-[11px] uppercase tracking-widest text-slate-600 transition-all"
              >
                 {[2023, 2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                 ))}
              </select>
           </div>
        </div>

        <div className="bg-slate-900 p-2 rounded-[2rem] flex gap-1">
          <button 
            onClick={() => setTaxType('pph')}
            className={cn(
              "px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all",
              taxType === 'pph' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"
            )}
          >
            PPh Final UMKM
          </button>
          <button 
            onClick={() => setTaxType('ppn')}
            className={cn(
              "px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all",
              taxType === 'ppn' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"
            )}
          >
            Estimasi PPN
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={taxType}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Official Tax Header */}
          <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 md:p-12 shadow-2xl shadow-slate-100 flex flex-col md:flex-row gap-10 items-start">
             <div className="flex-1 space-y-6">
                <div className="flex items-center gap-4">
                   <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-xl",
                    taxType === 'pph' ? "bg-slate-900" : "bg-cyan-600"
                   )}>
                      {taxType === 'pph' ? <Calculator className="w-8 h-8" /> : <TrendingUp className="w-8 h-8" />}
                   </div>
                   <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight font-display uppercase">
                        {taxType === 'pph' ? 'Daftar Rekapitulasi PPh' : 'Estimasi Pajak PPN'}
                      </h2>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">
                        {taxType === 'pph' ? `Peredaran Bruto • Tarif ${profile?.pphRate ?? 0.5}%` : `Simulasi Mekanisme PK - PM (${profile?.ppnRate ?? 11}%)`}
                      </p>
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Building className="w-3 h-3" /> Identitas Usaha
                      </p>
                      <p className="text-sm font-black text-slate-900 truncate">{profile?.businessName || 'Belum Diatur'}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">NPWP: {profile?.npwp || 'N/A'}</p>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Calendar className="w-3 h-3" /> Masa Pajak
                      </p>
                      <p className="text-sm font-black text-slate-900">{currentPeriod}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Status: Perhitungan Berjalan</p>
                   </div>
                </div>
             </div>

             <div className={cn(
                "w-full md:w-80 rounded-[2rem] p-8 text-white space-y-6 shadow-2xl transition-colors duration-500",
                taxType === 'pph' ? "bg-indigo-600 shadow-indigo-200" : "bg-cyan-600 shadow-cyan-200"
             )}>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                     {taxType === 'pph' ? `Pajak Terutang (${profile?.pphRate ?? 0.5}%)` : 'PPN Terutang (PK-PM)'}
                   </p>
                   <h3 className="text-4xl font-black font-display tracking-tighter">
                     {formatCurrency(taxType === 'pph' ? taxAmount : ppnTerutang)}
                   </h3>
                </div>
                <div className="h-px bg-white/10" />
                <div className="space-y-4">
                   <button 
                      onClick={downloadPDF}
                      className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-[1.03] transition-all flex items-center justify-center gap-3"
                   >
                      <Download className="w-4 h-4" /> Download Simpan
                   </button>
                   <p className="text-[8px] font-bold text-white/60 text-center uppercase tracking-widest leading-relaxed">
                     {taxType === 'pph' 
                      ? 'Gunakan rekap ini sebagai lampiran SPT Masa Anda.'
                      : 'Simulasi estimasi PPN untuk perencanaan keuangan Anda.'}
                   </p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
             {taxType === 'ppn' ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-xl p-8 space-y-8">
                   <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-base font-black text-slate-900 tracking-tight uppercase">Komposisi PPN</h4>
                   </div>
                   
                   <div className="space-y-6">
                      <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center">
                         <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Pajak Keluaran ({profile?.ppnRate ?? 11}%)</p>
                            <p className="text-xl font-black text-slate-900">{formatCurrency(pajakKeluaran)}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] font-bold text-emerald-400 uppercase">DPP Pendapatan</p>
                            <p className="text-sm font-bold text-slate-600">{formatCurrency(dppKeluaran)}</p>
                         </div>
                      </div>

                      <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center">
                         <div>
                            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Pajak Masukan ({profile?.ppnRate ?? 11}%)</p>
                            <p className="text-xl font-black text-slate-900">{formatCurrency(pajakMasukan)}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] font-bold text-rose-400 uppercase">DPP Pembelian</p>
                            <p className="text-sm font-bold text-slate-600">{formatCurrency(dppMasukan)}</p>
                         </div>
                      </div>

                      <div className="p-8 bg-slate-900 rounded-[2rem] text-white flex justify-between items-center shadow-xl">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PPN Dis setor/Lebih Bayar</p>
                            <h4 className="text-3xl font-black text-white tracking-tighter">{formatCurrency(ppnTerutang)}</h4>
                         </div>
                         <div className="p-4 bg-white/10 rounded-2xl">
                            {ppnTerutang >= 0 ? <ShieldAlert className="w-8 h-8 text-amber-400" /> : <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
                         </div>
                      </div>
                   </div>
                   
                   <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">
                     * Perhitungan di atas bersifat estimasi. Pajak Masukan hanya dapat dikreditkan jika Anda memiliki Faktur Pajak yang sah dari supplier PKP (Pengusaha Kena Pajak).
                   </p>
                </div>
             ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-xl overflow-hidden flex flex-col h-[500px]">
                   <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                         <FileText className="w-5 h-5 text-slate-400" />
                         <h4 className="text-base font-black text-slate-900 tracking-tight uppercase">Detail Peredaran Bruto</h4>
                      </div>
                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full uppercase">Aktif</span>
                   </div>
                   <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                      <table className="w-full border-collapse">
                         <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-50">
                            <tr>
                               <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                               <th className="px-8 py-5 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Penjualan</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {sortedDates.map((date) => (
                               <tr key={date} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-8 py-4 text-sm font-bold text-slate-600">{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                  <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(dailySummary[date])}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}

             {/* Right Content */}
             <div className="space-y-8">
                {taxType === 'pph' && (
                  <div className="p-8 md:p-10 bg-slate-900 rounded-[2.5rem] text-white space-y-8 relative overflow-hidden group">
                     <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3">
                           <ShieldCheck className="w-6 h-6 text-indigo-400" />
                           <h4 className="text-base font-black tracking-tight uppercase">Status Kepatuhan WP</h4>
                        </div>
                        
                        <div className="space-y-4">
                           <ComplianceToggle 
                              title="Buat Kode Billing" 
                              checked={checklist.step1} 
                              onClick={() => toggleStep('step1')} 
                           />
                           <ComplianceToggle 
                              title="Berhasil Dibayar" 
                              checked={checklist.step2} 
                              onClick={() => toggleStep('step2')} 
                           />
                           <ComplianceToggle 
                              title="Lapor SPT Masa" 
                              checked={checklist.step3} 
                              onClick={() => toggleStep('step3')} 
                           />
                        </div>
                     </div>
                     <Sparkles className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 rotate-12" />
                  </div>
                )}

                <div className="p-8 md:p-10 bg-amber-50 rounded-[2.5rem] border border-amber-100 space-y-6">
                   <div className="flex items-center gap-3 text-amber-600">
                      <AlertCircle className="w-6 h-6" />
                      <h4 className="text-base font-black tracking-tight uppercase">Wawasan Perencanaan Pajak</h4>
                   </div>
                   <p className="text-[11px] font-bold text-amber-900/60 leading-relaxed uppercase tracking-wider">
                      {taxType === 'pph' 
                       ? `Bagi UMKM, pastikan omzet Anda dalam setahun tidak melebihi Rp 4,8 Miliar untuk tetap dapat menggunakan tarif ${profile?.pphRate ?? 0.5}%.`
                       : `Mekanisme PPN memerlukan ketelitian dalam pencatatan Faktur Pajak (Tarif Aktif: ${profile?.ppnRate ?? 11}%). Pastikan supplier Anda memberikan Faktur Pajak Masukan.`}
                   </p>
                   <div className="h-px bg-amber-200/50" />
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">{taxType === 'pph' ? 'Batas Omzet UMKM' : 'Batas PKP'}</span>
                      <span className="text-xs font-black text-amber-900">Rp 4.8 Miliar</span>
                   </div>
                   <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                      <div 
                         className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                         style={{ width: `${Math.min(100, (totalBruto / 4800000000) * 100)}%` }} 
                      />
                   </div>
                </div>
             </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ComplianceToggle({ title, checked, onClick }: { title: string, checked: boolean, onClick: () => void }) {
   return (
      <button 
         onClick={onClick}
         className={cn(
            "w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all group",
            checked ? "bg-indigo-500/20 border-indigo-500/30 text-white" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
         )}
      >
         <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
         <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
            checked ? "bg-indigo-400 text-slate-900" : "bg-white/10 text-transparent"
         )}>
            <Check className="w-4 h-4 stroke-[4]" />
         </div>
      </button>
   );
}
