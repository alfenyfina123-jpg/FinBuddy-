import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Search, Trash2, Filter, ShoppingBag, ArrowUpRight, ArrowDownRight, X, QrCode, CreditCard, Banknote, Check, Hash, Calendar, User as UserIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, auth } from '../lib/firebase';
import { Transaction, TransactionType, OperationType, Product } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense'>('all');

  const [formData, setFormData] = useState({
    type: 'income' as TransactionType,
    category: '',
    amount: '',
    description: '',
    customerName: '',
    paymentMethod: 'cash' as 'cash' | 'qris' | 'credit',
    date: new Date().toISOString().split('T')[0],
    productName: '',
    hpp: ''
  });

  const [productCodeInput, setProductCodeInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showQRIS, setShowQRIS] = useState(false);
  const [qrisData, setQRISData] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const pq = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const punsubscribe = onSnapshot(pq, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => {
      unsubscribe();
      punsubscribe();
    };
  }, []);

  const handleProductCodeChange = (code: string) => {
    setProductCodeInput(code);
    const product = products.find(p => p.code.toLowerCase() === code.toLowerCase());
    if (product) {
      setSelectedProduct(product);
      setFormData({
        ...formData,
        productName: product.name,
        hpp: product.hpp.toString(),
        amount: product.price.toString(),
        category: product.category,
        description: `Penjualan ${product.name}`
      });
    } else {
      setSelectedProduct(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const amount = parseFloat(formData.amount);
      const payload = {
        userId: auth.currentUser.uid,
        type: formData.type,
        category: formData.category,
        amount: amount,
        description: formData.description,
        customerName: formData.customerName,
        paymentMethod: formData.paymentMethod,
        date: formData.date,
        productName: formData.type === 'income' ? formData.productName : '',
        hpp: formData.type === 'income' ? (parseFloat(formData.hpp) || 0) : 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'transactions'), payload);

      // 1. Integrasi Hutang/Piutang
      if (formData.paymentMethod === 'credit') {
        await addDoc(collection(db, 'debts'), {
          userId: auth.currentUser.uid,
          transactionId: docRef.id,
          type: formData.type === 'income' ? 'receivable' : 'payable',
          contactName: formData.customerName || (formData.type === 'income' ? 'Pelanggan Umum' : 'Vendor Umum'),
          totalAmount: amount,
          remainingAmount: amount,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 1 minggu
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      // 2. Integrasi Stok
      if (selectedProduct && formData.type === 'income') {
        await updateDoc(doc(db, 'products', selectedProduct.id), {
          stock: selectedProduct.stock - 1
        });
      }

      setIsModalOpen(false);
      setProductCodeInput('');
      setSelectedProduct(null);
      setFormData({
        type: 'income',
        category: '',
        amount: '',
        description: '',
        customerName: '',
        paymentMethod: 'cash',
        date: new Date().toISOString().split('T')[0],
        productName: '',
        hpp: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || t.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-10 relative">
      <div className="absolute top-0 right-0 -z-10 w-96 h-96 bg-indigo-200/20 blur-[120px] rounded-full" />
      
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 justify-between items-stretch">
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-1">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Cari transaksi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 md:pl-16 pr-6 py-4 md:py-5 text-xs md:text-sm bg-white/60 backdrop-blur-md border border-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg md:shadow-xl shadow-slate-200/40 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300 font-bold"
            />
          </div>
          
          <div className="relative group">
             <Filter className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
             <select 
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="appearance-none w-full sm:w-48 lg:w-56 pl-12 md:pl-14 pr-10 py-4 md:py-5 text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-white/60 backdrop-blur-md border border-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg md:shadow-xl shadow-slate-200/40 outline-none cursor-pointer text-slate-500 hover:text-slate-900 transition-all font-display"
            >
              <option value="all">Semua Tipe</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </div>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white text-[10px] md:text-[11px] font-black uppercase tracking-widest px-8 md:px-12 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] hover:scale-[1.02] active:scale-[0.98] shadow-xl md:shadow-2xl shadow-indigo-200 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 stroke-[3]" />
          Transaksi Baru
        </button>
      </div>

      {/* Transaction List Box */}
      <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        {/* Mobile List View (Card-style) */}
        <div className="md:hidden divide-y divide-slate-100/50">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-md grow-0 shrink-0",
                  t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {t.type === 'income' ? <TrendingUp className="w-5 h-5 stroke-[2.5]" /> : <TrendingDown className="w-5 h-5 stroke-[2.5]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate pr-2">{t.description}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {t.category}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={cn(
                  "text-base font-black tracking-tighter",
                  t.type === 'income' ? "text-emerald-600" : "text-rose-500"
                )}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </p>
                <div className="flex justify-end gap-2 mt-1">
                  <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && !loading && (
             <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Data Kosong</div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/30 border-b border-white/50">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Metadata</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Finansial</th>
                <th className="px-10 py-6 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-white/80 transition-all group cursor-default">
                  <td className="px-10 py-8">
                    <div className="flex items-start gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" : "bg-rose-50 text-rose-600 shadow-rose-100"
                      )}>
                        {t.type === 'income' ? <TrendingUp className="w-6 h-6 stroke-[2.5]" /> : <TrendingDown className="w-6 h-6 stroke-[2.5]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <p className="text-lg font-black text-slate-900 leading-none">{t.description}</p>
                           {t.paymentMethod && (
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5",
                              t.paymentMethod === 'qris' ? "bg-violet-50 text-violet-500" : 
                              t.paymentMethod === 'credit' ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500"
                            )}>
                              {t.paymentMethod === 'qris' ? <QrCode className="w-3 h-3" /> : 
                               t.paymentMethod === 'credit' ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                              {t.paymentMethod}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          <span className="flex items-center gap-1.5"><ShoppingBag className="w-3 h-3" /> {t.category}</span>
                          {t.customerName && <span className="flex items-center gap-1.5 text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md"><UserIcon className="w-3 h-3" /> {t.customerName}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <p className={cn(
                      "text-2xl font-black tracking-tighter",
                      t.type === 'income' ? "text-emerald-600" : "text-rose-500"
                    )}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    {t.productName && <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-1">{t.productName}</p>}
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                       <div className="w-20 h-20 bg-slate-50 rounded-3xl mb-6 flex items-center justify-center text-slate-300">
                         <ShoppingBag className="w-10 h-10" />
                       </div>
                       <p className="text-xs font-black uppercase tracking-[0.2em]">Data Tidak Ditemukan</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight">Tambah Transaksi</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex p-1 bg-gray-50 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-semibold rounded-lg transition-all",
                      formData.type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-brand-secondary"
                    )}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-semibold rounded-lg transition-all",
                      formData.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-brand-secondary"
                    )}
                  >
                    Pengeluaran
                  </button>
                </div>

                {formData.type === 'income' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> Scan / Masukkan Kode Produk
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Contoh: PRD-001"
                        value={productCodeInput}
                        onChange={(e) => handleProductCodeChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm bg-indigo-50/50 border-2 border-indigo-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                    </div>
                    {selectedProduct && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-700 uppercase leading-none">{selectedProduct.name}</p>
                          <p className="text-[9px] text-emerald-600/70 font-bold mt-0.5">Stok: {selectedProduct.stock} {selectedProduct.unit}</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Kategori</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Makanan, Sewa, Gaji"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 text-sm bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Tanggal</label>
                    <input 
                      required
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-3 text-sm bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Nama Pelanggan / Vendor</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Budi Santoso"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Jumlah (Rp)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-brand-primary outline-none"
                  />
                </div>

                {formData.type === 'income' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-2 border-t border-gray-50"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" /> Nama Produk (Opt)
                        </label>
                        <input 
                          type="text" 
                          placeholder="Nama Barang"
                          value={formData.productName}
                          onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                          className="w-full px-4 py-3 text-sm bg-emerald-50/30 border-none rounded-xl focus:ring-1 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">HPP per Produk (Rp)</label>
                        <input 
                          type="number" 
                          placeholder="Harga Pokok"
                          value={formData.hpp}
                          onChange={(e) => setFormData({ ...formData, hpp: e.target.value })}
                          className="w-full px-4 py-3 text-sm bg-emerald-50/30 border-none rounded-xl focus:ring-1 focus:ring-emerald-200 outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Deskripsi</label>
                  <textarea 
                    placeholder="Detail tambahan..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-brand-primary outline-none resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary ml-1">Metode Pembayaran</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'cash', label: 'Tunai', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { id: 'qris', label: 'QRIS', icon: QrCode, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                      { id: 'credit', label: 'Kredit', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: method.id as any })}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all",
                          formData.paymentMethod === method.id 
                            ? `border-${method.id === 'cash' ? 'emerald' : method.id === 'qris' ? 'indigo' : 'amber'}-500 bg-white shadow-md` 
                            : "border-gray-50 bg-gray-50/50 opacity-60"
                        )}
                      >
                        <method.icon className={cn("w-5 h-5", method.color)} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{method.label}</span>
                      </button>
                    ))}
                  </div>

                  {formData.paymentMethod === 'qris' && formData.amount && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="button"
                      onClick={() => {
                        setQRISData(`00020101021126590016ID.CO.QRIS.WWW011893600000000000000002140000000000000510208520400005303360540${formData.amount}5802ID5912${auth.currentUser?.displayName || 'Merchant'}6007Jakarta6105123456304`);
                        setShowQRIS(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                    >
                      <QrCode className="w-4 h-4" />
                      Tampilkan QRIS Pembayaran
                    </motion.button>
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QRIS Simulator Modal */}
      <AnimatePresence>
        {showQRIS && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQRIS(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xs bg-white rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center text-center"
            >
              <button 
                onClick={() => setShowQRIS(false)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center gap-2 mb-8">
                <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2">QRIS Statis</div>
                <h3 className="text-xl font-black tracking-tight text-slate-900">Scan Untuk Bayar</h3>
                <p className="text-slate-400 font-medium text-xs">Silakan scan kode QR untuk melakukan pembayaran</p>
              </div>

              <div className="bg-white p-6 rounded-3xl border-4 border-slate-100 shadow-inner mb-8 transform hover:scale-105 transition-transform">
                <QRCodeSVG value={qrisData} size={200} />
              </div>

              <div className="w-full space-y-4">
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bayar</span>
                  <span className="text-xl font-black text-indigo-600">{formatCurrency(parseFloat(formData.amount))}</span>
                </div>
                <button 
                  onClick={() => setShowQRIS(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800"
                >
                  Selesai Bayar
                </button>
              </div>
              
              <div className="mt-8 pt-8 border-t border-slate-100 w-full flex justify-center gap-6 opacity-30 grayscale">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/GPN_Logo.svg" alt="GPN" className="h-4" />
                 <img src="https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dan_Nama_Bank_Indonesia.svg" alt="BI" className="h-4" />
                 <img src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg" alt="QRIS" className="h-4" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
