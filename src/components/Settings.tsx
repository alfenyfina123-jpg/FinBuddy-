import { useState, useEffect, FormEvent } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Settings as SettingsIcon, 
  Save, 
  Store, 
  User, 
  ShieldCheck, 
  Mail, 
  QrCode, 
  FileText, 
  Printer, 
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, auth } from '../lib/firebase';
import { OperationType } from '../types';
import { handleFirestoreError, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    displayName: '',
    directorName: '',
    qrisPayload: '',
    autoGeneratePdfLedger: false,
    thermalPrinterOptimization: false
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFormData({
          businessName: data.businessName || '',
          displayName: data.displayName || '',
          directorName: data.directorName || '',
          qrisPayload: data.qrisPayload || '',
          autoGeneratePdfLedger: !!data.autoGeneratePdfLedger,
          thermalPrinterOptimization: !!data.thermalPrinterOptimization
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser?.uid}`);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);

    try {
      const profileRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(profileRef, {
        ...formData
      });
      alert('Cloud Store updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
      <div className="h-96 bg-slate-100 rounded-[2.5rem]" />
      <div className="h-96 bg-slate-100 rounded-[2.5rem]" />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Profile & BI */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Profil Business Intelligence</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Verified Enterprise Identity</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nama Entitas Bisnis</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    placeholder="FENY ALFINA DAMAYANTI"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nama Direktur Utama</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    placeholder="FENY ALFINA DAMAYANTI"
                    value={formData.directorName}
                    onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-2 opacity-60">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email Pengguna Terverifikasi</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    readOnly
                    type="email" 
                    value={auth.currentUser?.email || ''}
                    className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-100 rounded-2xl outline-none font-bold text-slate-500 cursor-not-allowed"
                  />
                  <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <QrCode className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Gerbang Pembayaran QRIS</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Konfigurasi EMVCo QRIS</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Masukkan data payload QRIS Anda di sini...</label>
                <textarea 
                  value={formData.qrisPayload}
                  onChange={(e) => setFormData({ ...formData, qrisPayload: e.target.value })}
                  placeholder="00020101021126660015ID.CO.QRIS.WWW..."
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] h-32 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-xs text-slate-600 leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic mt-2">
                  * Kode ini akan digunakan untuk menghasilkan QR Code otomatis saat pelanggan ingin membayar non-tunai secara real-time.
                </p>
              </div>

              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 min-h-[250px]">
                {formData.qrisPayload ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-xl">
                      <QRCodeSVG value={formData.qrisPayload} size={150} level="H" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full">Active QRIS Ready</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-300">
                    <QrCode className="w-12 h-12 stroke-[1.5]" />
                    <span className="text-xs font-black uppercase tracking-widest">No Dynamic QR Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preferences & Actions */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                <Printer className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Preferensi Dokumentasi</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Output Customization</p>
              </div>
            </div>

            <div className="space-y-6">
              <ToggleItem 
                icon={FileText} 
                label="Auto-Generate PDF Ledger" 
                value={formData.autoGeneratePdfLedger}
                onChange={(val) => setFormData({ ...formData, autoGeneratePdfLedger: val })}
              />
              <ToggleItem 
                icon={Printer} 
                label="Termal Printer Optimization (80mm)" 
                value={formData.thermalPrinterOptimization}
                onChange={(val) => setFormData({ ...formData, thermalPrinterOptimization: val })}
              />
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-slate-200">
            <div className="flex items-center gap-3 text-slate-400 mb-6">
              <Database className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Data Synchronization</span>
            </div>
            
            <button 
              disabled={saving}
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-slate-200"
            >
              {saving ? 'Syncing...' : (
                <>
                  <Save className="w-5 h-5" />
                  Update Cloud Store
                </>
              )}
            </button>
            <p className="text-[9px] text-center text-slate-400 font-bold mt-4 uppercase tracking-[0.3em]">Last Sync: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>
    </form>
  );
}

function ToggleItem({ icon: Icon, label, value, onChange }: any) {
  return (
    <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/10">
      <div className="flex items-center gap-4">
        <Icon className="w-5 h-5 text-slate-400" />
        <span className="text-xs font-bold text-slate-200">{label}</span>
      </div>
      <button 
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all duration-300",
          value ? "bg-indigo-500" : "bg-slate-700"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
          value ? "left-7" : "left-1"
        )} />
      </button>
    </div>
  );
}
