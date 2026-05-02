import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Plus, Search, Trash2, Package, Tag, Calculator, ShoppingBag, X, Save, TrendingUp, TrendingDown, Layers, Box, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { Product, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'Retail',
    price: '',
    hpp: '',
    stock: '',
    unit: 'Unit'
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'products'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      const data = {
        ...formData,
        userId: auth.currentUser.uid,
        price: Number(formData.price),
        hpp: Number(formData.hpp),
        stock: Number(formData.stock),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'products'), data);
      setIsModalOpen(false);
      setFormData({ code: '', name: '', category: 'Retail', price: '', hpp: '', stock: '', unit: 'Unit' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm('Hapus produk ini?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 relative group">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-violet-500 transition-colors" />
           <input 
             type="text" 
             placeholder="Cari SKU atau Nama Produk..."
             className="w-full pl-16 pr-6 py-4 md:py-5 bg-white border-2 border-slate-50 focus:border-violet-100 rounded-3xl outline-none transition-all font-bold text-sm shadow-xl shadow-slate-100/30"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white px-10 py-4 md:py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-100 hover:scale-[1.03] transition-all shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Daftarkan Produk
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs">Mengambil Data Inventori...</div>
        ) : filteredProducts.map((p) => (
          <motion.div 
            layout
            key={p.id}
            className="bg-white/60 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl hover:shadow-2xl hover:bg-white transition-all group relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                 <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                   <Package className="w-6 h-6 stroke-[2]" />
                 </div>
                 <span className={cn(
                   "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                   p.stock > 10 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                 )}>
                   Stok: {p.stock}
                 </span>
              </div>

              <div className="mb-6">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.code || 'NO SKU'}</p>
                 <h4 className="text-xl font-black text-slate-900 tracking-tight font-display pr-6 line-clamp-1">{p.name}</h4>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Harga Jual</p>
                    <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(p.price)}</p>
                 </div>
                 <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Harga Dasar</p>
                    <p className="text-sm font-black text-indigo-500 font-mono">{formatCurrency(p.hpp)}</p>
                 </div>
                 <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Margin Laba</p>
                    <p className="text-xs font-black text-emerald-600 font-mono">+{formatCurrency(p.price - p.hpp)}</p>
                 </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                 <button 
                  onClick={() => deleteProduct(p.id)}
                  className="flex-1 py-3.5 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all"
                 >
                   Hapus
                 </button>
                 <button className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-indigo-600 transition-all">Edit</button>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-indigo-50/50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-white/70 backdrop-blur-3xl" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl p-10 overflow-hidden">
               <div className="mb-10 flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter font-display">Registrasi Produk</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kode SKU</label>
                       <input 
                         required type="text"
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                         value={formData.code}
                         onChange={(e) => setFormData({...formData, code: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Produk</label>
                       <input 
                         required type="text"
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                         value={formData.name}
                         onChange={(e) => setFormData({...formData, name: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Harga Jual (Rp)</label>
                       <input 
                         required type="number"
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-black text-sm"
                         value={formData.price}
                         onChange={(e) => setFormData({...formData, price: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modal / HPP (Rp)</label>
                       <input 
                         required type="number"
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-black text-sm"
                         value={formData.hpp}
                         onChange={(e) => setFormData({...formData, hpp: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stok Awal</label>
                       <input 
                         required type="number"
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-black text-sm"
                         value={formData.stock}
                         onChange={(e) => setFormData({...formData, stock: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Satuan</label>
                       <select 
                         className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                         value={formData.unit}
                         onChange={(e) => setFormData({...formData, unit: e.target.value})}
                       >
                         <option>Unit</option>
                         <option>Pcs</option>
                         <option>Box</option>
                         <option>Liter</option>
                         <option>Gram</option>
                         <option>Kg</option>
                       </select>
                    </div>
                 </div>

                 <button 
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-100 hover:bg-slate-900 transition-all flex items-center justify-center gap-3 mt-4"
                 >
                   Simpan Inventori
                 </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
