import React, { useState, useEffect } from 'react';
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
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError, cn } from '../lib/utils';

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { ...profile });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
           <div className="p-8 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-slate-200 rounded-full mb-6 overflow-hidden border-4 border-white shadow-lg">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`} alt="Avatar" className="w-full h-full" />
              </div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight font-display">{profile.displayName}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Administrator Portal</p>
              
              <div className="mt-8 pt-8 border-t border-slate-50 w-full space-y-4">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Level Akun</span>
                    <span className="text-indigo-600">Premium</span>
                 </div>
                 <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                 </div>
              </div>
           </div>

           <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
              <div className="flex items-center gap-3 mb-6">
                 <QrCode className="w-5 h-5 text-indigo-400" />
                 <p className="text-xs font-black uppercase tracking-widest">QR Pembayaran Usaha</p>
              </div>
              <div className="bg-white p-4 rounded-2xl flex items-center justify-center">
                <QRCodeSVG value={profile.qrisPayload || 'BELUM DIATUR'} size={150} />
              </div>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] text-center mt-6">Scan untuk pembayaran via QRIS</p>
           </div>
        </div>

        <form onSubmit={handleSave} className="md:col-span-2 space-y-8">
           <div className="p-8 md:p-10 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl space-y-8">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Store className="w-5 h-5" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Identitas Bisnis</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Entitas Bisnis</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-white/50 border-2 border-slate-50 focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                    value={profile.businessName || ''}
                    onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Direktur / Penanggung Jawab</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-white/50 border-2 border-slate-50 focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-sm"
                    value={profile.directorName || ''}
                    onChange={(e) => setProfile({ ...profile, directorName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">QRIS Payload Data</label>
                <textarea 
                  className="w-full px-6 py-4 bg-white/50 border-2 border-slate-50 focus:border-indigo-100 rounded-2xl outline-none transition-all font-bold text-xs h-24"
                  placeholder="0002010102112662001..."
                  value={profile.qrisPayload || ''}
                  onChange={(e) => setProfile({ ...profile, qrisPayload: e.target.value })}
                />
              </div>
           </div>

           <div className="p-8 md:p-10 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-xl space-y-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Database className="w-5 h-5" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight font-display">Preferensi Sistem</h3>
              </div>

              <div className="space-y-4">
                 <Toggle 
                   label="Otomasi Laporan PDF (Buku Besar)"
                   description="Sistem akan otomatis mengarsip laporan buku besar setiap akhir bulan."
                   value={profile.autoGeneratePdfLedger || false}
                   onChange={(val) => setProfile({ ...profile, autoGeneratePdfLedger: val })}
                 />
                 <Toggle 
                   label="Optimasi Printer Thermal (58mm/80mm)"
                   description="Format struk dan laporan akan disesuaikan dengan standar printer kasir thermal."
                   value={profile.thermalPrinterOptimization || false}
                   onChange={(val) => setProfile({ ...profile, thermalPrinterOptimization: val })}
                   accentColor="bg-emerald-500"
                 />
              </div>
           </div>

           <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button 
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : (
                  <>
                    <Save className="w-5 h-5" />
                    Simpan Perubahan
                  </>
                )}
              </button>
              
              {showSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-6 py-4 rounded-3xl animate-in fade-in slide-in-from-left-4">
                   <CheckCircle2 className="w-5 h-5" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Konfigurasi Berhasil Diperbarui</span>
                </div>
              )}
           </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({ label, description, value, onChange, accentColor }: any) {
  return (
    <div className="flex items-center justify-between p-4 md:p-6 bg-white/40 rounded-3xl border border-white hover:bg-white transition-all group">
      <div>
        <p className="text-sm font-black text-slate-900 mb-1">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-sm">{description}</p>
      </div>
      <button 
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-14 h-7 rounded-full relative transition-all duration-300 shrink-0",
          value ? (accentColor || "bg-indigo-600") : "bg-slate-200"
        )}
      >
        <div className={cn(
          "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300",
          value ? "left-8" : "left-1"
        )} />
      </button>
    </div>
  );
}
