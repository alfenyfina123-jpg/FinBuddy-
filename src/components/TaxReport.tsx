import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { Calculator, Calendar, Info, CheckCircle2, AlertCircle, Download, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function TaxReport() {
  const [omset, setOmset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [businessName, setBusinessName] = useState('Bisnis Saya');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    step1: false,
    step2: false,
    step3: false
  });

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const periodId = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Get business name
    const profileRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setBusinessName(snap.data().businessName || 'Bisnis Saya');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    // Get checklist for the period
    const checklistRef = doc(db, 'taxChecklist', `${auth.currentUser.uid}_${periodId}`);
    const unsubscribeChecklist = onSnapshot(checklistRef, (snap) => {
      if (snap.exists()) {
        setChecklist(snap.data() as any);
      } else {
        setChecklist({ step1: false, step2: false, step3: false });
      }
    });

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'income')
    );

    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => doc.data() as Transaction);
      
      const filtered = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });

      const totalOmset = filtered.reduce((acc, curr) => acc + curr.amount, 0);
      setOmset(totalOmset);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTransactions();
      unsubscribeChecklist();
    };
  }, [selectedMonth, selectedYear, periodId]);

  const toggleStep = async (step: string) => {
    if (!auth.currentUser) return;
    const checklistRef = doc(db, 'taxChecklist', `${auth.currentUser.uid}_${periodId}`);
    try {
      const newStatus = !checklist[step];
      await setDoc(checklistRef, {
        ...checklist,
        [step]: newStatus,
        userId: auth.currentUser.uid,
        period: periodId,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `taxChecklist/${periodId}`);
    }
  };

  const pphFinal = omset * 0.005;
  const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
  const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
  
  const paymentDeadline = `15/${(nextMonth + 1).toString().padStart(2, '0')}/${nextYear}`;
  const reportDeadline = `20/${(nextMonth + 1).toString().padStart(2, '0')}/${nextYear}`;

  const exportToPDF = () => {
    const doc = new jsPDF();
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const periodString = `${lastDayOfMonth} ${months[selectedMonth]} ${selectedYear}`;

    // Header
    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('LAPORAN KEWAJIBAN PAJAK (PPh FINAL 0.5%)', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Untuk Periode yang Berakhir pada ${periodString}`, 105, 32, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    doc.setFontSize(12);
    doc.text('PERHITUNGAN PAJAK', 20, 50);

    autoTable(doc, {
      startY: 55,
      head: [['Keterangan', 'Nilai']],
      body: [
        ['Total Peredaran Bruto (Omset)', formatCurrency(omset)],
        ['Tarif Pajak (PP No. 55 Th 2022)', '0.5%'],
        [{ content: 'Total PPh Terutang', styles: { fontStyle: 'bold' } }, { content: formatCurrency(pphFinal), styles: { fontStyle: 'bold' } }]
      ],
      theme: 'plain',
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('Batas Waktu Pelaksanaan:', 20, finalY);
    doc.setFontSize(10);
    doc.text(`- Batas Pembayaran: ${paymentDeadline}`, 25, finalY + 7);
    doc.text(`- Batas Pelaporan SPT Masa: ${reportDeadline}`, 25, finalY + 14);

    doc.save(`Laporan_Pajak_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  if (loading) return <div className="animate-pulse space-y-6">
    <div className="h-48 bg-gray-100 rounded-3xl" />
    <div className="h-96 bg-gray-100 rounded-3xl" />
  </div>;

  return (
    <div className="space-y-8">
      {/* Selector */}
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
        <div className="md:col-span-8 space-y-8">
          {/* Main Calculation Bento */}
          <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 text-white overflow-hidden relative shadow-2xl shadow-slate-900/10">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                   <Calculator className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500">Estimasi Pajak</h4>
                  <p className="text-sm font-bold text-slate-300">{months[selectedMonth]} {selectedYear}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pajak Terutang (0,5%)</p>
                <h2 className="text-6xl font-black tracking-tighter text-emerald-400">{formatCurrency(pphFinal)}</h2>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-800 grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Total Omset</p>
                  <p className="text-2xl font-black text-white">{formatCurrency(omset)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Status</p>
                  <div className="flex items-center gap-2 text-white">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-bold">Terhitung</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute right-[-10%] bottom-[-10%] w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          </div>

          {/* Compliance Card Bento */}
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative z-10">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-3 mb-10">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[3]" />
              Checklist Kepatuhan
            </h3>
            <div className="space-y-8">
              <ComplianceStep 
                num="01" 
                title="Selesaikan Kode Billing" 
                desc="Gunakan fitur SSE Pajak dengan kode MAP 411128 dan KJS 420 melalui DJP Online."
                completed={checklist.step1}
                onToggle={() => toggleStep('step1')}
              />
              <ComplianceStep 
                num="02" 
                title="Pembayaran (Deadline)" 
                desc={`Lakukan setoran ke Kas Negara paling lambat ${paymentDeadline} melalui Bank Persepsi.`}
                completed={checklist.step2}
                onToggle={() => toggleStep('step2')}
              />
              <ComplianceStep 
                num="03" 
                title="Pelaporan SPT Masa" 
                desc={`Input data pembayaran ke SPT Masa PPh Final UMKM paling lambat ${reportDeadline}.`}
                completed={checklist.step3}
                onToggle={() => toggleStep('step3')}
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
          <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-100 text-amber-900 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform">⚠️</div>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-600 stroke-[3]" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Pembebasan Pajak</h4>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              Wajib Pajak Orang Pribadi dengan omset di bawah <b>Rp 500.000.000</b> setahun tidak dikenakan PPh Final. Pastikan omset akumulatif Anda terpantau.
            </p>
          </div>

          <div className="bg-indigo-50 p-8 rounded-[2rem] border border-indigo-100 text-indigo-900 relative overflow-hidden group">
             <div className="absolute -right-4 -top-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform">⚖️</div>
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-indigo-600 stroke-[3]" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-800">Regulasi Terkait</h4>
            </div>
            <p className="text-[10px] leading-relaxed font-bold italic opacity-80">
              "Peredaran bruto yang dijadikan objek pajak adalah seluruh penerimaan dari hasil penjualan barang/jasa dari usaha pokok."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceStep({ num, title, desc, completed, onToggle }: { 
  num: string; 
  title: string; 
  desc: string; 
  completed?: boolean;
  onToggle: () => void;
}) {
  return (
    <div 
      className={cn(
        "flex gap-6 p-4 rounded-2xl transition-all cursor-pointer group",
        completed ? "bg-emerald-50/50" : "hover:bg-slate-50"
      )}
      onClick={onToggle}
    >
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-all",
        completed 
          ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200" 
          : "bg-white border-slate-100 text-slate-300 group-hover:border-indigo-200 group-hover:text-indigo-400"
      )}>
        {completed ? <Check className="w-6 h-6 stroke-[3]" /> : <span className="text-lg font-black">{num}</span>}
      </div>
      <div className="flex-1">
        <h4 className={cn(
          "text-sm font-black uppercase tracking-wider mb-1 transition-colors",
          completed ? "text-emerald-900" : "text-slate-900"
        )}>
          {title}
        </h4>
        <p className={cn(
          "text-xs leading-relaxed font-medium transition-colors",
          completed ? "text-emerald-600/80" : "text-slate-500"
        )}>
          {desc}
        </p>
      </div>
    </div>
  );
}
