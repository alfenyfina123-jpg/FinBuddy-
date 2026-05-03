import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  PieChart, 
  Calculator, 
  LogOut, 
  User as UserIcon,
  Menu,
  X,
  FileText,
  Sparkles,
  Bot,
  Package,
  Wallet,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Chrome
} from 'lucide-react';
import { auth, loginWithGoogle, logout, db, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './lib/firebase';
import { UserProfile } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import MarginAnalysis from './components/MarginAnalysis';
import TaxReport from './components/TaxReport';
import ProfitLossReport from './components/ProfitLossReport';
import GeneralJournal from './components/GeneralJournal';
import GeneralLedger from './components/GeneralLedger';
import BalanceSheet from './components/BalanceSheet';
import CashFlow from './components/CashFlow';
import Settings from './components/Settings';
import BusinessAssistant from './components/BusinessAssistant';
import SmartInsights from './components/SmartInsights';
import ProductManager from './components/ProductManager';
import DebtManager from './components/DebtManager';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'analysis' | 'tax' | 'profitLoss' | 'journal' | 'ledger' | 'balanceSheet' | 'cashFlow' | 'settings' | 'aiAnalytics' | 'aiAssistant' | 'inventory' | 'debts'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);
  const mainRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'debts'), where('userId', '==', auth.currentUser.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debts = snapshot.docs.map(doc => doc.data());
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      const count = debts.filter((d: any) => {
        const dueDate = new Date(d.dueDate);
        return dueDate <= threeDaysFromNow;
      }).length;
      setUrgentCount(count);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Ensure profile exists
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          const newProfile = {
            uid: user.uid,
            email: user.email!,
            displayName: user.displayName || 'User',
            createdAt: serverTimestamp(),
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile as any);
        } else {
          setProfile(profileSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-brand-primary font-mono text-sm uppercase tracking-widest"
        >
          Loading FinBuddy...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Utama', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'transactions', label: 'Transaksi', icon: ReceiptText, group: 'Utama', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    
    { id: 'journal', label: 'Jurnal Umum', icon: FileText, group: 'Laporan Keuangan', color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'ledger', label: 'Buku Besar', icon: FileText, group: 'Laporan Keuangan', color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'profitLoss', label: 'Laba Rugi', icon: FileText, group: 'Laporan Keuangan', color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'balanceSheet', label: 'Neraca', icon: FileText, group: 'Laporan Keuangan', color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'cashFlow', label: 'Arus Kas', icon: FileText, group: 'Laporan Keuangan', color: 'text-rose-500', bg: 'bg-rose-50' },
    
    { id: 'analysis', label: 'Analisis Margin', icon: PieChart, group: 'Analitik', color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'tax', label: 'Laporan Pajak', icon: Calculator, group: 'Analitik', color: 'text-amber-500', bg: 'bg-amber-50' },
    
    { id: 'inventory', label: 'Inventori Stok', icon: Package, group: 'Operasional', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'debts', label: 'Catatan Utang', icon: Wallet, group: 'Operasional', color: 'text-emerald-500', bg: 'bg-emerald-50' },

    { id: 'aiAnalytics', label: 'Wawasan Bisnis', icon: Sparkles, group: 'Strategi & Konsultasi', color: 'text-violet-500', bg: 'bg-violet-50' },
    { id: 'aiAssistant', label: 'Konsultan Virtual', icon: Bot, group: 'Strategi & Konsultasi', color: 'text-violet-500', bg: 'bg-violet-50' },

    { id: 'settings', label: 'Pengaturan', icon: UserIcon, group: 'Sistem', color: 'text-slate-500', bg: 'bg-slate-50' },
  ];

  const groupConfigs: Record<string, { color: string, iconColor: string }> = {
    'Utama': { color: 'text-indigo-400', iconColor: 'text-indigo-500' },
    'Operasional': { color: 'text-emerald-400', iconColor: 'text-emerald-500' },
    'Laporan Keuangan': { color: 'text-rose-400', iconColor: 'text-rose-500' },
    'Analitik': { color: 'text-amber-400', iconColor: 'text-amber-500' },
    'Strategi & Konsultasi': { color: 'text-violet-400', iconColor: 'text-violet-500' },
    'Sistem': { color: 'text-slate-400', iconColor: 'text-slate-500' },
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAFBFF]">
      {/* Mobile Header - Compact for better real estate */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-md"></div>
          </div>
          <h1 className="font-black tracking-tighter text-slate-900 uppercase text-sm font-display">FinBuddy</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="p-2 text-slate-400 active:bg-slate-50 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar - Mobile Drawer / Desktop Permanent */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-white/70 backdrop-blur-3xl z-[50] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-[60] w-72 h-[100dvh] md:h-screen bg-white flex flex-col transform transition-transform duration-300 ease-out md:relative md:translate-x-0 md:bg-white/80 md:backdrop-blur-2xl md:border-r md:border-slate-100",
        isSidebarOpen ? "translate-x-0 shadow-2xl shadow-slate-900/20" : "-translate-x-full"
      )}>
        <div className="p-8 pb-4 hidden md:flex items-center gap-4 shrink-0">
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 ring-4 ring-indigo-50">
            <div className="w-5 h-5 bg-white rounded-lg"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none font-display">FinBuddy</h1>
            <div className="h-1 w-6 bg-indigo-500 rounded-full mt-1"></div>
          </div>
        </div>

        {/* Mobile Sidebar Header */}
        <div className="md:hidden p-6 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
               <div className="w-4 h-4 bg-white rounded-sm"></div>
             </div>
             <p className="font-black tracking-tighter text-slate-900 uppercase text-xs font-display">FinBuddy</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 flex flex-col gap-6 md:gap-10 overflow-y-auto px-6 md:px-8 py-8 custom-scrollbar">
          {Object.entries(groupConfigs).map(([group, config]) => (
            <div key={group}>
              <p className={cn("text-[11px] md:text-sm font-black uppercase tracking-[0.3em] mb-4 md:mb-8 px-4 opacity-40 font-display", config.color)}>{group}</p>
              <div className="flex flex-col gap-2 md:gap-3">
                {tabs.filter(t => t.group === group).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-4 md:gap-5 px-5 py-4 md:py-4.5 rounded-[1.5rem] md:rounded-[2rem] text-sm md:text-base font-bold transition-all group cursor-pointer border-2 border-transparent",
                        isActive 
                          ? `${tab.bg} ${tab.color} border-${tab.color.split('-')[1]}-100 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.15)]` 
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 md:w-6 md:h-6", isActive ? tab.color : "text-slate-400 group-hover:text-slate-900 transition-colors")} />
                      <span className="font-bold tracking-tight">{tab.label}</span>
                      {tab.id === 'debts' && urgentCount > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-4 ring-white group-hover:ring-slate-100 transition-all">
                          {urgentCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 md:p-8 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-300 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                alt="Avatar" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] md:text-xs font-black truncate text-slate-900 tracking-tight leading-tight">{user.displayName || 'User'}</p>
              <p className="text-[8px] md:text-[9px] text-slate-400 truncate uppercase tracking-widest font-black mt-0.5">Admin Account</p>
            </div>
            <button onClick={logout} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 h-screen overflow-y-auto bg-[#FAFBFF] relative custom-scrollbar">
        <div className="min-h-full p-4 md:p-8 lg:p-12 pb-40 w-full max-w-[1400px] mx-auto flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.4, 
                ease: [0.23, 1, 0.32, 1]
              }}
              className="flex-1 flex flex-col will-change-[opacity,transform]"
            >
              <header className="mb-6 md:mb-10 flex flex-col md:flex-row md:justify-between md:items-end border-b border-slate-100 pb-6 gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 font-display leading-tight">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-slate-500 text-xs md:text-sm font-medium mt-1.5 md:mt-2">
                    {activeTab === 'dashboard' && 'Selamat datang, ringkasan usaha Anda hari ini.'}
                    {activeTab === 'transactions' && 'Kelola dan catat semua arus kas masuk dan keluar.'}
                    {activeTab === 'journal' && 'Catatan kronologis semua transaksi keuangan.'}
                    {activeTab === 'ledger' && 'Pengelompokan transaksi berdasarkan kategori akun.'}
                    {activeTab === 'profitLoss' && 'Evaluasi pendapatan dan beban usaha.'}
                    {activeTab === 'balanceSheet' && 'Posisi keuangan (Aset vs Liabilitas & Ekuitas).'}
                    {activeTab === 'cashFlow' && 'Analisis pergerakan kas masuk dan keluar.'}
                    {activeTab === 'analysis' && 'Bandingkan profitabilitas antar produk yang Anda jual.'}
                    {activeTab === 'tax' && 'Estimasi kewajiban pajak PPh Final 0,5%.'}
                    {activeTab === 'inventory' && 'Kelola daftar produk dan stok inventori usaha Anda.'}
                    {activeTab === 'debts' && 'Pantau catatan hutang (keluar) dan piutang (masuk).'}
                    {activeTab === 'aiAnalytics' && 'Wawasan strategis yang dihasilkan oleh kecerdasan buatan.'}
                    {activeTab === 'aiAssistant' && 'Konsultasikan tantangan bisnis Anda dengan asisten cerdas.'}
                    {activeTab === 'settings' && 'Kelola informasi usaha dan profil Anda.'}
                  </p>
                </div>
              </header>

              <div className="flex-1 pb-32">
                {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
                {activeTab === 'transactions' && <TransactionList />}
                {activeTab === 'journal' && <GeneralJournal />}
                {activeTab === 'ledger' && <GeneralLedger />}
                {activeTab === 'profitLoss' && <ProfitLossReport />}
                {activeTab === 'balanceSheet' && <BalanceSheet />}
                {activeTab === 'cashFlow' && <CashFlow />}
                {activeTab === 'analysis' && <MarginAnalysis />}
                {activeTab === 'tax' && <TaxReport />}
                {activeTab === 'inventory' && <ProductManager />}
                {activeTab === 'debts' && <DebtManager />}
                {activeTab === 'aiAnalytics' && <SmartInsights setActiveTab={setActiveTab} />}
                {activeTab === 'aiAssistant' && <BusinessAssistant />}
                {activeTab === 'settings' && <Settings />}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function LoginView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create initial profile
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email!,
          displayName: name || user.email!.split('@')[0],
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* Visual Side - Adaptive visibility and size */}
      <div className="hidden lg:flex lg:w-[40%] xl:w-[45%] bg-slate-900 relative p-12 xl:p-16 flex-col justify-between overflow-hidden shrink-0">
        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10 xl:mb-16">
            <div className="w-10 h-10 xl:w-12 xl:h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <div className="w-4 h-4 xl:w-5 xl:h-5 bg-white rounded-lg"></div>
            </div>
            <h1 className="text-2xl xl:text-3xl font-black text-white tracking-tighter font-display">FinBuddy</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tighter mb-8 font-display">
              Manajemen Finansial yang <span className="text-indigo-400">Bernyawa.</span>
            </h2>
            <p className="text-slate-400 text-base xl:text-lg leading-relaxed font-medium">
              Ubah data mentah menjadi keputusan strategis. FinBuddy membantu Anda memantau profit, mengelola stok, dan mengawasi kesehatan bisnis secara real-time.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-6 mb-8">
            <div className="flex -space-x-3 xl:-space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 xl:w-10 xl:h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 123}`} alt="User" />
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs xl:text-sm font-bold">Solusi Modern Untuk Bisnis Anda</p>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <span>Otomasi Keuangan Bisnis Terpadu</span>
            <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
            <span>Secured by Firebase</span>
          </div>
        </div>
      </div>

      {/* Form Side - Center focus on mobile/tablet */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 md:p-12 lg:p-16">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-white p-6 sm:p-10 md:p-12 lg:p-14 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-50"
        >
          <div className="text-center mb-8 lg:hidden">
             <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-md"></div>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter font-display">FinBuddy</h1>
            </div>
          </div>

          <div className="mb-8 md:mb-10 text-center lg:text-left">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display mb-2">
              {isLogin ? 'Selamat Datang Kembali' : 'Bergabung Sekarang'}
            </h3>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] sm:text-[10px]">
              {isLogin ? 'Masuk ke portal operasional bisnis Anda' : 'Mulai petualangan finansial baru Anda'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {!isLogin && (
              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nama Lengkap</label>
                <div className="relative group">
                  <UserIcon className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    required
                    type="text" 
                    placeholder="Nama Bisnis / Anda"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 sm:pl-14 pr-6 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-[1.25rem] md:rounded-2xl outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 md:space-y-2">
              <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Kredensial</label>
              <div className="relative group">
                <Mail className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  required
                  type="email" 
                  placeholder="name@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-6 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-[1.25rem] md:rounded-2xl outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Keamanan Sandi</label>
                {isLogin && <button type="button" className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:underline">Lupa Sandi?</button>}
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 sm:pl-14 pr-6 py-3.5 sm:py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-[1.25rem] md:rounded-2xl outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 sm:p-4 bg-rose-50 border border-rose-100 rounded-[1.25rem] md:rounded-2xl flex items-center gap-3">
                <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <p className="text-[9px] sm:text-[10px] font-bold text-rose-600 line-clamp-2 leading-relaxed">{error}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 sm:py-5 bg-slate-900 text-white rounded-[1.25rem] md:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50 mt-2"
            >
              {loading ? 'Memproses...' : (isLogin ? 'Masuk Sekarang' : 'Daftar Akun')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="my-8 md:my-10 flex items-center gap-4 text-slate-300">
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Atau Gunakan</span>
            <div className="h-px bg-slate-100 flex-1" />
          </div>

          <button 
            type="button"
            onClick={async () => {
              try {
                setLoading(true);
                setError(null);
                await loginWithGoogle();
              } catch (err: any) {
                console.error(err);
                if (err.code === 'auth/popup-blocked') {
                  setError('Popup diblokir! Harap izinkan popup di browser Anda untuk login via Google.');
                } else if (err.code === 'auth/unauthorized-domain') {
                  setError('Domain ini belum diizinkan di Firebase Console. Harap tambahkan domain deploy Anda ke Authorized Domains di setelan Firebase Authentication.');
                } else {
                  setError('Gagal login via Google. Silakan coba lagi atau gunakan email.');
                }
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full py-4 sm:py-5 bg-white border-2 border-slate-50 rounded-[1.25rem] md:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] text-slate-600 hover:bg-slate-50 hover:border-slate-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <Chrome className="w-4 h-4 text-indigo-500" />
            {loading ? 'Menghubungkan...' : 'Lanjutkan via Google'}
          </button>

          <p className="mt-10 md:mt-12 text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isLogin ? 'Belum punya akses?' : 'Sudah terdaftar?'} 
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-indigo-500 hover:underline cursor-pointer"
            >
              {isLogin ? 'Buat Akun Perdana' : 'Masuk Portal'}
            </button>
          </p>
        </motion.div>

        <div className="mt-8 md:mt-12 flex items-center gap-2 text-slate-300 pb-4">
          <ShieldCheck className="w-4 h-4" />
          <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">End-to-End Encryption Enabled</p>
        </div>
      </div>
    </div>
  );
}
