import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { Book, Download, Calendar, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function GeneralLedger() {
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

    const q = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid), orderBy('date', 'asc'));
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
  }, []);

  const filtered = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Group by Category
  const categories = Array.from(new Set(filtered.map(t => t.category))) as string[];

  const exportToPDF = () => {
    const doc = new jsPDF();
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const periodStr = `${lastDay} ${months[selectedMonth]} ${selectedYear}`;

    doc.setFontSize(18);
    doc.text(businessName.toUpperCase(), 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('BUKU BESAR', 105, 24, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Untuk Periode yang Berakhir pada ${periodStr}`, 105, 30, { align: 'center' });
    doc.line(20, 35, 190, 35);

    let currentY = 45;
    categories.forEach(cat => {
      const catTrans = filtered.filter(t => t.category === cat);
      let balance = 0;

      doc.setFont(undefined, 'bold');
      doc.text(`AKUN: ${cat.toUpperCase()}`, 20, currentY);
      
      const body = catTrans.map(t => {
        if (t.type === 'income') balance += t.amount;
        else balance -= t.amount;
        const desc = t.customerName ? `${t.customerName} - ${t.description}` : (t.description || '-');
        return [t.date, desc, t.type === 'income' ? formatCurrency(t.amount) : '-', t.type === 'expense' ? formatCurrency(t.amount) : '-', formatCurrency(balance)];
      });

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Tanggal', 'Keterangan', 'Debet', 'Kredit', 'Saldo']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save(`Buku_Besar_${months[selectedMonth]}_${selectedYear}.pdf`);
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
        <button onClick={exportToPDF} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer">
          <Download className="w-4 h-4" /> Ekspor PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {categories.map(cat => {
          const catTrans = filtered.filter(t => t.category === cat);
          let runningBalance = 0;
          return (
            <div key={cat} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.2em]">{cat}</h3>
                <span className="text-[10px] opacity-60">General Ledger Account</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-4">Tanggal</th>
                      <th className="px-8 py-4">Keterangan</th>
                      <th className="px-8 py-4">Debet</th>
                      <th className="px-8 py-4">Kredit</th>
                      <th className="px-8 py-4 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {catTrans.map(t => {
                      if (t.type === 'income') runningBalance += t.amount;
                      else runningBalance -= t.amount;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="px-8 py-3">{t.date}</td>
                          <td className="px-8 py-3">
                            {t.customerName && <p className="font-bold text-slate-900">{t.customerName}</p>}
                            <p className="text-slate-500">{t.description}</p>
                          </td>
                          <td className="px-8 py-3 text-emerald-600 font-bold">{t.type === 'income' ? formatCurrency(t.amount) : '-'}</td>
                          <td className="px-8 py-3 text-rose-500 font-bold">{t.type === 'expense' ? formatCurrency(t.amount) : '-'}</td>
                          <td className="px-8 py-3 text-right font-black">{formatCurrency(runningBalance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
