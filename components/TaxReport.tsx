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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [checklist, setChecklist] = useState<ComplianceChecklist>({ step1: false, step2: false, step3: false, updatedAt: null });

  useEffect(() => {
    if (!auth.currentUser) return;

    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'income'),
      orderBy('date', 'desc')
    );

    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      // Client-side filtering for month/year
      const filtered = allTransactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
      });
      setTransactions(filtered);
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
  const taxAmount = totalBruto * 0.005; // PPh Final UMKM 0.5%
  const currentPeriod = new Date(selectedYear, selectedMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Group transactions by date for the summary table
  const dailySummary = transactions.reduce((acc: any, curr) => {
    const d = curr.date;
    acc[d] = (acc[d] || 0) + curr.amount;
    return acc;
  }, {});

  const sortedDates = Object.keys(dailySummary).sort((a, b) => b.localeCompare(a));

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header Color Bar
    doc.setFillColor(15, 23, 42); // Blue Slate 900
    doc.rect(0, 0, 210, 40, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN PAJAK UMKM', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('REKAPITULASI PEREDARAN BRUTO - PP 55 TAHUN 2022', 14, 28);
    
    // Reset Text Color
    doc.setTextColor(15, 23, 42);
    
    // Business Info Box
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.roundedRect(14, 45, 182, 35, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA WAJIB PAJAK', 20, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`NAMA USAHA : ${profile?.businessName || profile?.displayName || 'N/A'}`, 20, 60);
    doc.text(`NPWP       : ${profile?.npwp || 'Belum Diatur'}`, 20, 66);
    doc.text(`MASA PAJAK : ${currentPeriod}`, 20, 72);

    // Summary Box
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.roundedRect(140, 52, 50, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PAJAK TERUTANG', 145, 58);
    doc.setFontSize(12);
    doc.text(formatCurrency(taxAmount), 145, 68);

    doc.setTextColor(15, 23, 42);
    
    // Detailed Table
    const tableData = sortedDates.map(date => [
      new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      formatCurrency(dailySummary[date]).replace('Rp ', '')
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['TANGGAL TRANSAKSI', 'PEREDARAN BRUTO (IDR)']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        1: { halign: 'right' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 5
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Total Summary Below Table
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 20, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PEREDARAN BRUTO BULAN INI', 20, finalY + 12);
    doc.text(formatCurrency(totalBruto), 190, finalY + 12, { align: 'right' });

    let y = finalY + 35;
    
    // Threshold warning if eligible
    if (totalBruto < 500000000) {
       doc.setFontSize(8);
       doc.setFont('helvetica', 'italic');
       doc.setTextColor(100, 100, 100);
       doc.text('* Menunggu kumulatif ambang batas Rp 500jt (PTKP) sesuai UU HPP.', 14, y);
       y += 10;
    }

    // Signature Area
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

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 180, 180);
    doc.text('Laporan ini dihasilkan secara otomatis oleh Asisten Bisnis Pintar (AIS)', 105, 285, { align: 'center' });

    doc.save(`Laporan_Pajak_${currentPeriod.replace(' ', '_')}.pdf`);
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Menghitung Estimasi Pajak...</div>;

  return (
    <div className="space-y-12">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-xl shadow-slate-100">
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

      {/* Official Tax Header */}
      <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 p-8 md:p-12 shadow-2xl shadow-slate-100 flex flex-col md:flex-row gap-10 items-start">
         <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-xl">
                  <Calculator className="w-8 h-8" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight font-display uppercase">Daftar Rekapitulasi Pajak</h2>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1">PP 55 Tahun 2022 • PPh Final 0.5%</p>
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

         <div className="w-full md:w-80 bg-indigo-600 rounded-[2rem] p-8 text-white space-y-6 shadow-2xl shadow-indigo-200">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Pajak Terutang (0,5%)</p>
               <h3 className="text-4xl font-black font-display tracking-tighter">{formatCurrency(taxAmount)}</h3>
            </div>
            <div className="h-px bg-white/10" />
            <div className="space-y-4">
               <button 
                  onClick={downloadPDF}
                  className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-[1.03] transition-all flex items-center justify-center gap-3"
               >
                  <Download className="w-4 h-4" /> Download Rekap
               </button>
               <p className="text-[8px] font-bold text-indigo-100 text-center uppercase tracking-widest leading-relaxed">Gunakan rekap ini sebagai lampiran SPT Masa Anda.</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         {/* Detailed Turnover Table */}
         <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-xl overflow-hidden flex flex-col h-[600px]">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <h4 className="text-base font-black text-slate-900 tracking-tight uppercase">Detail Peredaran Bruto</h4>
               </div>
               <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full uppercase">Real-time</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
               <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-50">
                     <tr>
                        <th className="px-8 py-5 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                        <th className="px-8 py-5 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Peredaran Bruto</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {sortedDates.map((date) => (
                        <tr key={date} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long' })}</td>
                           <td className="px-8 py-5 text-right font-black text-slate-900">{formatCurrency(dailySummary[date])}</td>
                        </tr>
                     ))}
                     {sortedDates.length === 0 && (
                        <tr>
                           <td colSpan={2} className="px-8 py-20 text-center opacity-20 flex flex-col items-center">
                              <ShieldAlert className="w-16 h-16 mb-4" />
                              <p className="text-[10px] font-black uppercase tracking-widest">Belum ada pendapatan masuk</p>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Masa Pajak</p>
               <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(totalBruto)}</p>
            </div>
         </div>

         {/* Compliance & Regulation */}
         <div className="flex flex-col gap-10">
            <div className="p-8 md:p-10 bg-slate-900 rounded-[2.5rem] text-white space-y-8 relative overflow-hidden group">
               <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                     <ShieldCheck className="w-6 h-6 text-indigo-400" />
                     <h4 className="text-base font-black tracking-tight uppercase">Status Kepatuhan WP</h4>
                  </div>
                  
                  <div className="space-y-4">
                     <ComplianceToggle 
                        title="Kode Billing (MAP 411128)" 
                        checked={checklist.step1} 
                        onClick={() => toggleStep('step1')} 
                     />
                     <ComplianceToggle 
                        title="Pembayaran (KJS 420)" 
                        checked={checklist.step2} 
                        onClick={() => toggleStep('step2')} 
                     />
                     <ComplianceToggle 
                        title="Pelaporan SPT Masa" 
                        checked={checklist.step3} 
                        onClick={() => toggleStep('step3')} 
                     />
                  </div>

                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                     <div className="flex items-start gap-4">
                        <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
                           Pajak ini wajib disetor paling lambat tanggal 15 bulan berikutnya untuk menghindari sanksi administratif.
                        </p>
                     </div>
                  </div>
               </div>
               <Sparkles className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 rotate-12" />
            </div>

            <div className="p-8 md:p-10 bg-amber-50 rounded-[2.5rem] border border-amber-100 space-y-6">
               <div className="flex items-center gap-3 text-amber-600">
                  <AlertCircle className="w-6 h-6" />
                  <h4 className="text-base font-black tracking-tight uppercase">Insentif Pajak UMKM</h4>
               </div>
               <p className="text-[11px] font-bold text-amber-900/60 leading-relaxed uppercase tracking-wider">
                  Sesuai UU HPP, jika total peredaran bruto Anda dalam setahun di bawah <span className="text-amber-800 font-extrabold text-sm ml-1">Rp 500.000.000</span>, maka Anda berhak atas fasilitas PTKP (Peredaran Tidak Kena Pajak).
               </p>
               <div className="h-px bg-amber-200/50" />
               <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Persentase Thd PTKP</span>
                  <span className="text-xs font-black text-amber-900">{Math.round((totalBruto / 500000000) * 100)}%</span>
               </div>
               <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                  <div 
                     className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                     style={{ width: `${Math.min(100, (totalBruto / 500000000) * 100)}%` }} 
                  />
               </div>
            </div>
         </div>
      </div>
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
