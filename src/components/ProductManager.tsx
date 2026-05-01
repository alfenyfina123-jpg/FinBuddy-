import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Search, Trash2, Package, Edit2, X, Save, AlertCircle } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { Product, OperationType } from '../types';
import { formatCurrency, handleFirestoreError, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    price: '',
    hpp: '',
    stock: '',
    unit: 'pcs'
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'products'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const data = {
        userId: auth.currentUser.uid,
        code: formData.code,
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price),
        hpp: parseFloat(formData.hpp),
        stock: parseFloat(formData.stock),
        unit: formData.unit,
        createdAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), data);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'products'), data);
      }

      setShowAddModal(false);
      setFormData({ code: '', name: '', category: '', price: '', hpp: '', stock: '', unit: 'pcs' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      code: p.code,
      name: p.name,
      category: p.category,
      price: p.price.toString(),
      hpp: p.hpp.toString(),
      stock: p.stock.toString(),
      unit: p.unit
    });
    setShowAddModal(true);
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 relative">
       <div className="absolute top-0 left-0 -z-10 w-96 h-96 bg-emerald-200/10 blur-[120px] rounded-full" />

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 justify-between items-stretch">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Cari kode atau nama produk..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 md:pl-16 pr-6 py-4 md:py-5 text-xs md:text-sm bg-white/60 backdrop-blur-md border border-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg md:shadow-xl shadow-slate-200/40 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder:text-slate-300 font-bold"
          />
        </div>

        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ code: '', name: '', category: '', price: '', hpp: '', stock: '', unit: 'pcs' });
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-[10px] md:text-[11px] font-black uppercase tracking-widest px-8 md:px-12 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] hover:scale-[1.02] active:scale-[0.98] shadow-xl md:shadow-2xl shadow-emerald-200 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5 stroke-[3]" />
          Produk Baru
        </button>
      </div>

      <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100/50">
          {filtered.map((p) => (
            <div key={p.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Package className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate pr-2">{p.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {p.code} • {p.stock} {p.unit}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black tracking-tight text-slate-900">
                  {formatCurrency(p.price)}
                </p>
                <div className="flex justify-end gap-3 mt-2">
                  <button onClick={() => handleEdit(p)} className="text-slate-300 hover:text-indigo-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest">Data Kosong</div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/30 border-b border-white/50">
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identitas Produk</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ketersediaan</th>
                <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Profitabilitas</th>
                <th className="px-10 py-6 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              <AnimatePresence>
                {filtered.map((p) => (
                  <motion.tr 
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-white/80 transition-all group cursor-default"
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-100/50">
                          <Package className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">{p.code}</span>
                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{p.category}</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 leading-none">{p.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                           <div className={cn(
                             "w-2 h-2 rounded-full",
                             p.stock <= 5 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                           )} />
                           <p className="text-base font-black text-slate-900 leading-none">
                             {p.stock} <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">{p.unit}</span>
                           </p>
                        </div>
                        <p className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          p.stock <= 5 ? "text-rose-500" : "text-slate-400"
                        )}>
                          {p.stock <= 5 ? 'Stok Kritis' : 'Stok Aman'}
                        </p>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <p className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">
                        {formatCurrency(p.price)}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Modal: {formatCurrency(p.hpp)} 
                        <span className="ml-2 text-emerald-500">
                          (Margin: {formatCurrency(p.price - p.hpp)})
                        </span>
                      </p>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="px-10 py-32 text-center">
            <div className="flex flex-col items-center justify-center opacity-40">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl mb-6 flex items-center justify-center text-slate-300">
                 <Package className="w-10 h-10" />
               </div>
               <p className="text-xs font-black uppercase tracking-[0.2em]">Inventori Kosong</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden"
            >
              <div className="p-12">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <div className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full w-fit mb-3">
                      {editingId ? 'Revision Mode' : 'Creation Mode'}
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">{editingId ? 'Edit Manifest Produk' : 'Registrasi Produk Baru'}</h2>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                    <X className="w-8 h-8 text-slate-300 hover:text-slate-900" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="gap-8 grid grid-cols-2">
                  <div className="space-y-6 col-span-2 md:col-span-1">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identitas SKU (Unique)</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. PRD-X01"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-6 py-4 text-sm bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Kategori Produk</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Elektronik"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-6 py-4 text-sm bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-6 col-span-2 md:col-span-1">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Visual Produk</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Kopi Arabika"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-6 py-4 text-sm bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stok Awal</label>
                        <input 
                          required
                          type="number" 
                          placeholder="0"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                          className="w-full px-6 py-4 text-sm bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unit</label>
                        <select 
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          className="w-full px-6 py-4 text-sm bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer"
                        >
                          <option value="pcs">Pcs</option>
                          <option value="kg">Kg</option>
                          <option value="porsi">Porsi</option>
                          <option value="box">Box</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Harga Modal (HPP)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">Rp</span>
                        <input 
                          required
                          type="number" 
                          value={formData.hpp}
                          onChange={(e) => setFormData({ ...formData, hpp: e.target.value })}
                          className="w-full pl-12 pr-6 py-4 text-sm bg-emerald-50/30 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-emerald-700"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Harga Retail (Jual)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">Rp</span>
                        <input 
                          required
                          type="number" 
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="w-full pl-12 pr-6 py-4 text-sm bg-indigo-50/30 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-indigo-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 pt-6">
                    <button 
                      type="submit"
                      className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 flex items-center justify-center gap-3"
                    >
                      <Save className="w-5 h-5" />
                      {editingId ? 'Manifestasi Perubahan' : 'Finalisasi Produk Baru'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
