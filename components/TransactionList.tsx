import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Plus, Search, Trash2, Filter, ShoppingBag, ArrowUpRight, ArrowDownRight, X, QrCode, CreditCard, Banknote, Check, Hash, Calendar, User as UserIcon, TrendingUp, TrendingDown, ReceiptText, Package, DollarSign, Calculator, ChevronRight, AlertCircle, Sparkles, Printer, Download, Share2, ShieldCheck, Mail, MapPin, Building, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db, auth } from '../lib/firebase';
import { Transaction, OperationType, Product, UserProfile } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [qrValue, setQrValue] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'Penjualan Retail',
    amount: '',
    description: '',
    customerName: '',
    paymentMethod: 'cash' as 'cash' | 'qris' | 'credit',
    date: new Date().toISOString().split('T')[0],
    productName: '',
    hpp: ''
  });

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render((result) => {
        // Success
        console.log("QR Result:", result);
        // Basic QRIS amount parsing attempt (very simplified for demo)
        if (result.includes('ID.CO.QRIS')) {
           const parts = result.split('.');
           if (parts.length > 2) {
              const amount = parts[parts.length - 1];
              if (!isNaN(Number(amount))) {
                 setFormData(prev => ({ ...prev, amount: amount, paymentMethod: 'qris' }));
              }
           }
        }
        setIsScanning(false);
        scanner.clear();
      }, (error) => {
        // Error
      });

      return () => {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e));
      };
    }
  }, [isScanning]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const pq = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const unsubscribeProd = onSnapshot(pq, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubscribeProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    return () => {
      unsubscribe();
      unsubscribeProd();
      unsubscribeProfile();
    };
  }, []);

  const generateInvoiceNo = (type: string) => {
    const prefix = type === 'income' ? 'INV' : 'EXP';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}/${dateStr}/${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (formData.paymentMethod === 'qris' && !isQRModalOpen) {
        // Generate a dummy QRIS-style payload
        const payload = `00020101021226300016ID.CO.FINBUDDY.01189360051100000000005204599953033605802ID5916${profile?.businessName || 'FinBuddy Merchant'}6005JAKARTA61051234562070703A016304${Math.floor(Math.random() * 10000).toString(16).toUpperCase()}`;
        setQrValue(payload);
        setIsQRModalOpen(true);
        return; // Don't submit yet if showing QR
      }

      const transData = {
        ...formData,
        userId: auth.currentUser.uid,
        amount: Number(formData.amount),
        hpp: formData.hpp ? Number(formData.hpp) : 0,
        invoiceNo: generateInvoiceNo(formData.type),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'transactions'), transData);
      
      // If product was selected, decrease stock
      const product = products.find(p => p.name === formData.productName);
      if (product && formData.type === 'income') {
        const productRef = doc(db, 'products', product.id);
        const prodSnap = await getDoc(productRef);
        if (prodSnap.exists()) {
           await updateDoc(productRef, {
             stock: Math.max(0, (prodSnap.data().stock || 0) - 1)
           });
        }
      }

      setIsModalOpen(false);
      setIsQRModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleConfirmQRPayment = async () => {
    // Manually trigger submit but skip the QR step
    try {
      const transData = {
        ...formData,
        userId: auth.currentUser!.uid,
        amount: Number(formData.amount),
        hpp: formData.hpp ? Number(formData.hpp) : 0,
        invoiceNo: generateInvoiceNo(formData.type),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'transactions'), transData);
      
      // Stock updates...
      const product = products.find(p => p.name === formData.productName);
      if (product && formData.type === 'income') {
        const productRef = doc(db, 'products', product.id);
        const prodSnap = await getDoc(productRef);
        if (prodSnap.exists()) {
           await updateDoc(productRef, {
             stock: Math.max(0, (prodSnap.data().stock || 0) - 1)
           });
        }
      }

      setIsQRModalOpen(false);
      setQrValue('');
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'income',
      category: 'Penjualan Retail',
      amount: '',
      description: '',
      customerName: '',
      paymentMethod: 'cash',
      date: new Date().toISOString().split('T')[0],
      productName: '',
      hpp: ''
    });
  };

  const deleteTransaction = async (id: string, trans: Transaction) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      
      // If it was a sale, restore stock
      if (trans.type === 'income' && trans.productName) {
        const product = products.find(p => p.name === trans.productName);
        if (product) {
          await updateDoc(doc(db, 'products', product.id), {
            stock: product.stock + 1
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-violet-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari deskripsi, pelanggan, atau produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 md:py-4.5 bg-white border-2 border-slate-50 focus:border-violet-100 rounded-2xl md:rounded-3xl outline-none transition-all font-bold text-sm shadow-sm md:shadow-md"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white p-1.5 md:p-2 rounded-2xl md:rounded-[1.5rem] shadow-sm md:shadow-md border border-slate-50">
            {(['all', 'income', 'expense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-[1.25rem] text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all",
                  filterType === type 
                    ? type === 'income' ? "bg-emerald-500 text-white" : type === 'expense' ? "bg-rose-500 text-white" : "bg-indigo-500 text-white"
                    : "text-slate-400 hover:text-slate-900"
                )}
              >
                {type === 'all' ? 'Semua' : type === 'income' ? 'Masuk' : 'Keluar'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 md:px-8 py-4 md:py-4.5 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-[10px] md:text-[11px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-100 shrink-0"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 stroke-[3]" />
            <span className="hidden sm:inline">Tambah</span>
          </button>
        </div>
      </div>

      {/* Transaction Table Card */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[3.5rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-indigo-50/50">
                <th className="px-6 md:px-8 py-6 md:py-8 text-left text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                <th className="px-6 md:px-8 py-6 md:py-8 text-left text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deskripsi & Entitas</th>
                <th className="px-6 md:px-8 py-6 md:py-8 text-left text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hidden lg:table-cell">Kategori</th>
                <th className="px-6 md:px-8 py-6 md:py-8 text-left text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hidden md:table-cell">Metode</th>
                <th className="px-6 md:px-8 py-6 md:py-8 text-right text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nominal</th>
                <th className="px-6 md:px-8 py-6 md:py-8 text-center text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                 <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                       <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</p>
                       </div>
                    </td>
                 </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={t.id} 
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 md:px-8 py-6 md:py-7">
                      <div className={cn(
                        "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.25rem] flex items-center justify-center shadow-sm shrink-0",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {t.type === 'income' ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6" /> : <TrendingDown className="w-5 h-5 md:w-6 md:h-6" />}
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-6 md:py-7">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <p className="text-sm md:text-base font-black text-slate-900 pr-2 truncate max-w-[150px] sm:max-w-xs">{t.description}</p>
                           {t.hpp! > 0 && (
                             <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[8px] font-black uppercase">Analyzed</span>
                           )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                           {t.customerName && (
                              <>
                                <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                   <UserIcon className="w-2.5 h-2.5" /> {t.customerName}
                                </span>
                              </>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-6 md:py-7 hidden lg:table-cell">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg">{t.category}</span>
                    </td>
                    <td className="px-6 md:px-8 py-6 md:py-7 hidden md:table-cell">
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                         t.paymentMethod === 'qris' ? "text-violet-500" : 
                         t.paymentMethod === 'credit' ? "text-amber-500" : "text-emerald-500"
                       )}>
                         {t.paymentMethod === 'qris' ? <QrCode className="w-4 h-4" /> : 
                          t.paymentMethod === 'credit' ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                         {t.paymentMethod}
                       </span>
                    </td>
                    <td className="px-6 md:px-8 py-6 md:py-7 text-right">
                      <p className={cn(
                        "text-base md:text-xl font-black tracking-tight",
                        t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                      {t.hpp! > 0 && t.type === 'income' && (
                        <p className="text-[9px] font-bold text-slate-400 mt-1">Margin: {Math.round(((t.amount - t.hpp!) / t.amount) * 100)}%</p>
                      )}
                    </td>
                    <td className="px-6 md:px-8 py-6 md:py-7 text-center">
                       <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => setSelectedInvoice(t)}
                            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Lihat Invoice"
                          >
                            <ReceiptText className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => deleteTransaction(t.id, t)}
                            className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                       </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                       <ReceiptText className="w-20 h-20 mb-6" />
                       <p className="text-xl font-black uppercase tracking-[0.2em] text-slate-900">Belum Ada Transaksi</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-white/30 backdrop-blur-[100px]" 
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
            >
              <div className="p-8 md:p-10 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div>
                   <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter font-display">Catat Aktivitas</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Lengkapi detail finansial Anda</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 md:p-10 overflow-y-auto custom-scrollbar space-y-8">
                {/* Transaction Type Selector */}
                <div className="grid grid-cols-2 gap-4">
                  {(['income', 'expense'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type, category: type === 'income' ? 'Penjualan Retail' : 'Belanja Stok' })}
                      className={cn(
                        "p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden group",
                        formData.type === type 
                          ? type === 'income' ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                          : "bg-white border-slate-50 grayscale opacity-40 hover:grayscale-0 hover:opacity-100"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
                        type === 'income' ? "bg-emerald-600 shadow-emerald-200" : "bg-rose-600 shadow-rose-200"
                      )}>
                        {type === 'income' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                      </div>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        type === 'income' ? "text-emerald-700" : "text-rose-700"
                      )}>Arus {type === 'income' ? 'Masuk' : 'Keluar'}</p>
                      
                      {formData.type === type && (
                         <div className={cn(
                           "absolute -right-4 -bottom-4 w-12 h-12 rounded-full",
                           type === 'income' ? "bg-emerald-100" : "bg-rose-100"
                         )} />
                      )}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {/* Common Fields */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kategori Akun</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm h-[52px]"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                      >
                        {formData.type === 'income' ? (
                          <>
                            <option>Penjualan Retail</option>
                            <option>Pendapatan Jasa</option>
                            <option>Penerimaan Piutang</option>
                            <option>Saldo Awal Pengusaha</option>
                            <option>Lain-lain (Masuk)</option>
                          </>
                        ) : (
                          <>
                            <option>Belanja Stok</option>
                            <option>Biaya Operasional</option>
                            <option>Gaji Karyawan</option>
                            <option>Sewa & Listrik</option>
                            <option>Pribadi (Prive)</option>
                            <option>Lain-lain (Keluar)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Produk (Opsional)</label>
                       <div className="relative group">
                          <Package className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                          <select 
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm h-[52px] appearance-none"
                            value={formData.productName}
                            onChange={(e) => {
                              const prod = products.find(p => p.name === e.target.value);
                              setFormData({
                                ...formData, 
                                productName: e.target.value,
                                amount: prod && formData.type === 'income' ? prod.price.toString() : formData.amount,
                                hpp: prod ? prod.hpp.toString() : formData.hpp,
                                description: prod ? `Penjualan ${prod.name}` : formData.description
                              });
                            }}
                          >
                            <option value="">-- Pilih Produk --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.name}>{p.name} (Stok: {p.stock})</option>
                            ))}
                          </select>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Deskripsi Transaksi</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Contoh: Penjualan Kopi Susu"
                        className="w-full px-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nominal Rupiah (Rp)</label>
                      <div className="relative group">
                         <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                         <input 
                          required
                          type="number" 
                          placeholder="0"
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-emerald-100 rounded-2xl outline-none transition-all font-black text-lg text-emerald-600 font-mono"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        />
                      </div>
                    </div>

                    {formData.type === 'income' && (
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Modal / HPP (Per Unit)</label>
                          <div className="relative group">
                            <Calculator className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                            <input 
                              type="number" 
                              placeholder="0"
                              className="w-full pl-12 pr-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-amber-100 rounded-2xl outline-none transition-all font-black text-sm text-amber-600 font-mono"
                              value={formData.hpp}
                              onChange={(e) => setFormData({...formData, hpp: e.target.value})}
                            />
                          </div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1 leading-relaxed">Penting untuk analisis margin keuntungan Anda.</p>
                       </div>
                    )}

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Metode Pembayaran</label>
                       <div className="grid grid-cols-3 gap-2">
                          {(['cash', 'qris', 'credit'] as const).map(method => (
                             <button
                                key={method}
                                type="button"
                                onClick={() => setFormData({...formData, paymentMethod: method})}
                                className={cn(
                                   "py-3 border-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1.5",
                                   formData.paymentMethod === method ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-50 text-slate-400 hover:bg-slate-50"
                                )}
                             >
                               {method === 'cash' && <Banknote className="w-4 h-4" />}
                               {method === 'qris' && <QrCode className="w-4 h-4" />}
                               {method === 'credit' && <CreditCard className="w-4 h-4" />}
                               {method}
                             </button>
                          ))}
                       </div>
                       {formData.paymentMethod === 'qris' && (
                          <button
                            type="button"
                            onClick={() => setIsScanning(true)}
                            className="mt-2 w-full py-3 bg-violet-50 text-violet-600 border border-violet-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-100 transition-all"
                          >
                             <Search className="w-3.5 h-3.5" /> Scan QR Customer
                          </button>
                       )}
                    </div>

                    {isScanning && (
                      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden">
                           <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Scanner QRIS</p>
                              <button onClick={() => setIsScanning(false)} className="text-slate-400"><X className="w-5 h-5" /></button>
                           </div>
                           <div id="reader" className="w-full"></div>
                           <div className="p-6 bg-slate-50 text-center">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Arahkan kamera ke QR Code pelanggan</p>
                           </div>
                        </div>
                      </div>
                    )}

                    {formData.paymentMethod === 'qris' && formData.amount && (
                      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col items-center gap-4">
                        <QRCodeSVG 
                          value={`ID.CO.QRIS.0112345678.9876543210.${formData.amount}`} 
                          size={120}
                          className="bg-white p-2 rounded-lg"
                        />
                        <div className="text-center">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">QRIS Dinamis Otomatis</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-relaxed">Customer dapat scan barcode di atas untuk membayar {formatCurrency(Number(formData.amount))}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Pelanggan (Jika Ada)</label>
                    <div className="relative group">
                       <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                       <input 
                        type="text" 
                        placeholder="Contoh: Bapak Budi"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Waktu Transaksi</label>
                    <div className="relative group">
                       <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 transition-colors" />
                       <input 
                        required
                        type="date" 
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 focus:bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm h-[55px]"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-[11px] shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                  >
                    Simpan Laporan Sekarang <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {/* Bottom Decorative QR Pattern */}
              <div className="md:block px-8 py-6 bg-slate-900 border-t border-slate-800 shrink-0">
                <motion.div 
                   animate={{ opacity: [0.3, 0.6, 0.3] }}
                   transition={{ repeat: Infinity, duration: 3 }}
                   className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                     <Sparkles className="w-4 h-4 text-indigo-400" />
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Encrypted Storage Protocol v4.2</p>
                  </div>
                  <div className="flex items-center gap-4 grayscale opacity-30 scale-75 md:scale-100 origin-right">
                     <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/GPN_Logo.svg" alt="GPN" className="h-4" />
                     <img src="https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dan_Nama_Bank_Indonesia.svg" alt="BI" className="h-4" />
                     <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-4" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* QR Confirmation Modal */}
      <AnimatePresence>
        {isQRModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl" 
            />
            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl p-10 flex flex-col items-center text-center"
            >
               <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-600 mb-6">
                  <QrCode className="w-8 h-8" />
               </div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Scan & Bayar</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Silahkan Scan QR Berikut</p>
               
               <div className="p-6 bg-white border-4 border-slate-50 rounded-[2.5rem] shadow-xl mb-8">
                  <QRCodeSVG value={qrValue} size={200} />
               </div>
               
               <div className="space-y-2 mb-8">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Tagihan</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(Number(formData.amount))}</p>
               </div>
               
               <div className="w-full space-y-3">
                  <button 
                    onClick={handleConfirmQRPayment}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Konfirmasi - Dana Diterima
                  </button>
                  <button 
                    onClick={() => setIsQRModalOpen(false)}
                    className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-100 transition-all"
                  >
                    Batal
                  </button>
               </div>
               
               <div className="mt-8 flex items-center gap-4 grayscale opacity-40">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/GPN_Logo.svg" alt="GPN" className="h-3" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-3" />
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice View Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="absolute inset-0 bg-white/30 backdrop-blur-[100px]" 
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95dvh]"
            >
              <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <ReceiptText className="w-5 h-5" />
                   </div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Data Invoice</h3>
                 </div>
                 <button onClick={() => setSelectedInvoice(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                   <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#fafafa]">
                 {/* The Actual Invoice Document Design */}
                 <div className="bg-white rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden relative">
                    {/* Header Strip */}
                    <div className={cn(
                      "h-2 w-full",
                      selectedInvoice.type === 'income' ? "bg-emerald-500" : "bg-rose-500"
                    )} />

                    <div className="p-8 md:p-10 space-y-8">
                       {/* Brand & Invoice No */}
                       <div className="flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-4">
                             <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                                   {profile?.businessName?.[0] || 'F'}
                                </div>
                                <div>
                                   <h4 className="text-xl font-black text-slate-900 tracking-tight">{profile?.businessName || 'FinBuddy Business'}</h4>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Digital Merchant Identity</p>
                                </div>
                             </div>
                             <div className="space-y-1 pl-1">
                                {profile?.address && (
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                      <MapPin className="w-3 h-3 text-indigo-500" /> {profile.address}
                                   </p>
                                )}
                                {profile?.npwp && (
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                      <FileText className="w-3 h-3 text-indigo-500" /> NPWP: {profile.npwp}
                                   </p>
                                )}
                             </div>
                          </div>

                          <div className="text-left md:text-right space-y-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nomor Invoice</p>
                             <p className="text-base font-black text-slate-900 font-mono tracking-wider">{selectedInvoice.invoiceNo || 'N/A'}</p>
                             <div className="flex flex-col md:items-end mt-4">
                                <span className={cn(
                                   "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                   selectedInvoice.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                )}>
                                   {selectedInvoice.type === 'income' ? 'Penjualan' : 'Pengeluaran'}
                                </span>
                             </div>
                          </div>
                       </div>

                       <div className="h-px bg-slate-100" />

                       {/* Transaction Info */}
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-1">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</p>
                             <p className="text-xs font-bold text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Metode Bayar</p>
                             <p className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                {selectedInvoice.paymentMethod === 'qris' && <QrCode className="w-3.5 h-3.5 text-violet-500" />}
                                {selectedInvoice.paymentMethod}
                             </p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer/Entitas</p>
                             <p className="text-xs font-bold text-slate-900">{selectedInvoice.customerName || 'Pelanggan Umum'}</p>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Petugas Kasir</p>
                             <p className="text-xs font-bold text-slate-900">{profile?.directorName || 'Admin FinBuddy'}</p>
                          </div>
                       </div>

                       {/* Items Table */}
                       <div className="space-y-4">
                          <div className="bg-slate-50 rounded-xl overflow-hidden">
                             <div className="grid grid-cols-12 px-6 py-4 border-b border-white shadow-sm">
                                <div className="col-span-8 text-[9px] font-black uppercase tracking-widest text-slate-400">Deskripsi Layanan/Produk</div>
                                <div className="col-span-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Subtotal</div>
                             </div>
                             <div className="grid grid-cols-12 px-6 py-6 items-center">
                                <div className="col-span-8">
                                   <p className="text-sm font-black text-slate-900 leading-tight">{selectedInvoice.description}</p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedInvoice.category}</p>
                                </div>
                                <div className="col-span-4 text-right">
                                   <p className="text-sm font-black text-slate-900">{formatCurrency(selectedInvoice.amount)}</p>
                                </div>
                             </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 px-4">
                             <div className="flex items-center gap-12">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</p>
                                <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(selectedInvoice.amount)}</p>
                             </div>
                             <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-full mt-2">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Lunas / Berhasil</span>
                             </div>
                          </div>
                       </div>

                       <div className="h-px bg-slate-100" />

                       {/* QRIS & Verification */}
                       <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-4">
                          <div className="flex items-center gap-6">
                             <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                <QRCodeSVG value={`https://finbuddy.app/verify/${selectedInvoice.id}`} size={70} />
                             </div>
                             <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verification Link</p>
                                <p className="text-[9px] font-bold text-slate-900 leading-relaxed max-w-[120px]">Scan untuk memverifikasi keaslian dokumen ini secara digital.</p>
                             </div>
                          </div>

                          <div className="text-center md:text-right space-y-4">
                             <div className="flex items-center gap-3 grayscale opacity-30 scale-75 md:scale-90 md:origin-right">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/GPN_Logo.svg" alt="GPN" className="h-3" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dan_Nama_Bank_Indonesia.svg" alt="BI" className="h-3" />
                                <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-3" />
                             </div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Terima kasih atas kerja sama Anda</p>
                          </div>
                       </div>
                    </div>
                    
                    {/* Background Decorative */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none -rotate-12">
                       <ShieldCheck className="w-64 h-64" />
                    </div>
                 </div>
              </div>

              <div className="p-8 border-t border-slate-50 flex items-center justify-center gap-4 shrink-0">
                 <button className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <Printer className="w-4 h-4" /> Print PDF
                 </button>
                 <button className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-slate-50 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">
                    <Share2 className="w-4 h-4" /> Share
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
