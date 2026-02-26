import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCitizenAuth } from '../context/CitizenAuthContext';
import { Home, History, MessageSquareWarning, User as UserIcon, LogOut, ShieldCheck, ChevronRight, Clock, X, Lock, Link, Eye } from 'lucide-react';
import { citizenActions } from '../services/citizenApi';
import { useAlert } from '../context/AlertContext';

// Stubbing out components to be implemented next
import EntitlementCard from '../components/citizen/EntitlementCard';
import ShopCard from '../components/citizen/ShopCard';
import TransactionsList from '../components/citizen/TransactionsList';
import ComplaintsPanel from '../components/citizen/ComplaintsPanel';
import NotificationsPanel from '../components/citizen/NotificationsPanel';
import FamilyMembersPanel from '../components/citizen/FamilyMembersPanel';
import NearbyShopsPanel from '../components/citizen/NearbyShopsPanel';

export default function CitizenDashboard() {
    const { citizen, logout } = useCitizenAuth();
    const { showAlert } = useAlert();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('home'); // home, history, complaints, profile

    const [profile, setProfile] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [shop, setShop] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showBlockchainModal, setShowBlockchainModal] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [profData, entData, shopData] = await Promise.all([
                    citizenActions.getProfile(),
                    citizenActions.getEntitlement(),
                    citizenActions.getShop().catch(() => null)
                ]);
                setProfile(profData);
                setEntitlement(entData);
                setShop(shopData);
            } catch (error) {
                console.error("Dashboard fetch error", error);
                showAlert("Failed to load some dashboard data.", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [showAlert]);

    if (isLoading) {
        return <div className="p-8 text-center text-[#003366] font-semibold animate-pulse">Loading Portal...</div>;
    }

    // Helper for tab visibility - making it strict for a tabbed experience on both mobile and desktop
    const isVisible = (tabId) => {
        return activeTab === tabId ? 'block' : 'hidden';
    };

    const tabs = [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'history', label: 'History', icon: History },
        { id: 'complaints', label: 'Support', icon: MessageSquareWarning },
        { id: 'profile', label: 'Account', icon: UserIcon },
    ];

    return (
        <div className="min-h-screen bg-[#F5F7FA] font-sans text-gray-800 pb-20 md:pb-12">
            {/* Header */}
            <header className="bg-[#003366] text-white shadow-lg sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex justify-between items-center h-20 border-b border-white/10">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black tracking-tighter">RationShield</h1>
                                <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[10px] tracking-widest uppercase font-black shadow-sm">Portal</span>
                            </div>

                            {/* Desktop Navigation */}
                            <nav className="hidden md:flex items-center gap-1 ml-4">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id
                                            ? 'bg-white/10 text-white shadow-inner'
                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden lg:flex flex-col items-end mr-2">
                                <span className="text-xs font-bold text-white/50 uppercase tracking-widest leading-none mb-1">State Citizen</span>
                                <span className="text-sm font-black">{profile?.name}</span>
                            </div>
                            <button onClick={logout} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 flex items-center gap-2 group">
                                <LogOut className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                                <span className="hidden md:inline text-xs font-black uppercase tracking-widest">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <main className="p-4 md:p-8 max-w-7xl mx-auto">
                {/* Welcome Banner */}
                <div className={`mb-12 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isVisible('home')}`}>
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-[#003366] rounded-2xl flex items-center justify-center text-white text-3xl font-black shrink-0 shadow-lg shadow-blue-100 rotate-3">
                            {profile?.name?.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">👋 Namaste, {profile?.name}</h2>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded leading-none border border-blue-100">Verified Identity</span>
                            </div>
                            <p className="text-gray-400 font-bold text-sm tracking-wide">Digital Ration Card: {profile?.ration_card?.substring(0, 4)} — **** — ****</p>
                            <div className="flex items-center gap-4 mt-1.5">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last Access: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBlockchainModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-emerald-100 transition-all cursor-pointer"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        Blockchain Powered Ledger
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Home Tab */}
                    <div className={`col-span-1 md:col-span-2 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isVisible('home')}`}>
                        <EntitlementCard entitlement={entitlement} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                            <ShopCard shop={shop} />
                            <NearbyShopsPanel />
                        </div>
                    </div>

                    {/* History Tab */}
                    <div className={`col-span-1 md:col-span-3 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isVisible('history')}`}>
                        <TransactionsList />
                    </div>

                    {/* Support Tab */}
                    <div className={`col-span-1 md:col-span-3 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isVisible('complaints')}`}>
                        <ComplaintsPanel />
                    </div>

                    {/* Account Tab */}
                    <div className={`col-span-1 md:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-700 ${isVisible('profile')}`}>
                        <div className="space-y-12">
                            <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-50 text-[#003366]">
                                    <UserIcon className="w-6 h-6" />
                                    <h3 className="text-2xl font-black tracking-tight">Citizen Profile Settings</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm">
                                    <div className="space-y-6">
                                        <div>
                                            <span className="text-gray-400 block mb-1 font-black uppercase tracking-widest text-[10px]">Beneficiary Name</span>
                                            <span className="text-xl font-black text-gray-900 leading-none">{profile?.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1 font-black uppercase tracking-widest text-[10px]">Ration Card Number</span>
                                            <span className="text-xl font-black text-gray-900 leading-none">{profile?.ration_card}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-1 font-black uppercase tracking-widest text-[10px]">Digital Wallet Status</span>
                                            <span className="inline-flex px-4 py-1.5 bg-emerald-50 text-emerald-800 rounded-full font-black uppercase tracking-[0.2em] text-[10px] border border-emerald-100 shadow-sm">{profile?.account_status}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 pt-8 border-t md:border-t-0 md:pt-0">
                                        <button
                                            onClick={() => navigate('/citizen/update-mobile')}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#F0F9FF] hover:text-[#005A9C] rounded-2xl transition-all font-black text-xs uppercase tracking-widest text-gray-600 border border-transparent hover:border-blue-100"
                                        >
                                            <span>Update Registered Mobile</span>
                                            <ChevronRight className="w-5 h-5 opacity-30" />
                                        </button>
                                        <button
                                            onClick={() => navigate('/citizen/update-pin')}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-[#F0F9FF] hover:text-[#005A9C] rounded-2xl transition-all font-black text-xs uppercase tracking-widest text-gray-600 border border-transparent hover:border-blue-100"
                                        >
                                            <span>Update Portal PIN / Password</span>
                                            <ChevronRight className="w-5 h-5 opacity-30" />
                                        </button>
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent">
                                            <span className="font-black text-xs uppercase tracking-widest text-gray-400">Two-Factor Authentication</span>
                                            <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-not-allowed">
                                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <FamilyMembersPanel />
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] flex justify-around items-center h-20 z-50 px-2 pb-2">
                <button
                    onClick={() => setActiveTab('home')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all outline-none ${activeTab === 'home' ? 'text-[#005A9C]' : 'text-gray-400'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'home' ? 'bg-[#F0F9FF]' : ''}`}>
                        <Home className={`${activeTab === 'home' ? 'w-6 h-6' : 'w-5 h-5 opacity-70'}`} />
                    </div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${activeTab === 'home' ? 'opacity-100' : 'opacity-40'}`}>Home</span>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all outline-none ${activeTab === 'history' ? 'text-[#005A9C]' : 'text-gray-400'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'history' ? 'bg-[#F0F9FF]' : ''}`}>
                        <History className={`${activeTab === 'history' ? 'w-6 h-6' : 'w-5 h-5 opacity-70'}`} />
                    </div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${activeTab === 'history' ? 'opacity-100' : 'opacity-40'}`}>History</span>
                </button>
                <button
                    onClick={() => setActiveTab('complaints')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all outline-none ${activeTab === 'complaints' ? 'text-rose-600' : 'text-gray-400'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'complaints' ? 'bg-rose-50' : ''}`}>
                        <MessageSquareWarning className={`${activeTab === 'complaints' ? 'w-6 h-6' : 'w-5 h-5 opacity-70'}`} />
                    </div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${activeTab === 'complaints' ? 'opacity-100' : 'opacity-40'}`}>Support</span>
                </button>
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all outline-none ${activeTab === 'profile' ? 'text-[#005A9C]' : 'text-gray-400'}`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-[#F0F9FF]' : ''}`}>
                        <UserIcon className={`${activeTab === 'profile' ? 'w-6 h-6' : 'w-5 h-5 opacity-70'}`} />
                    </div>
                    <span className={`text-[10px] uppercase font-black tracking-widest ${activeTab === 'profile' ? 'opacity-100' : 'opacity-40'}`}>Account</span>
                </button>
            </nav>

            {/* Blockchain Explanation Modal */}
            {showBlockchainModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-[#001A33]/80 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setShowBlockchainModal(false)}
                    />
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-[#003366] p-8 text-white relative">
                            <button
                                onClick={() => setShowBlockchainModal(false)}
                                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-3 bg-emerald-400 rounded-2xl shadow-lg shadow-emerald-900/20">
                                    <ShieldCheck className="w-6 h-6 text-[#003366]" />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight">How it Works</h3>
                            </div>
                            <p className="text-emerald-300 text-xs font-black uppercase tracking-widest">Secure Immutability Layer</p>
                        </div>

                        <div className="p-8">
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Hash className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight mb-1">Every distribution is hashed</h4>
                                        <p className="text-sm text-gray-500 font-medium leading-relaxed">Each transaction generates a unique digital fingerprint (SHA-256), ensuring the data cannot be falsified.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Link className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight mb-1">Linked to previous block</h4>
                                        <p className="text-sm text-gray-500 font-medium leading-relaxed">Transactions are chained chronologically. Altering one transaction would require altering every subsequent block.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Lock className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight mb-1">Cannot be altered</h4>
                                        <p className="text-sm text-gray-500 font-medium leading-relaxed">Once a distribution is verified on-chain, it is permanent. No officer, dealer, or citizen can retroactively modify it.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Eye className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight mb-1">Publicly Auditable</h4>
                                        <p className="text-sm text-gray-500 font-medium leading-relaxed">Transparency is absolute. Any citizen can verify the audit trail using their unique ration card ID.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Your Most Recent Transaction Hash</p>
                                <div className="flex items-center gap-2">
                                    <code className="text-[10px] font-bold text-[#003366] break-all bg-white p-2 rounded-lg border border-gray-100 flex-1">
                                        {entitlement?.last_txn_hash || '0x4f2a8...91b2c'}
                                    </code>
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                </div>
                            </div>

                            <button
                                onClick={() => setShowBlockchainModal(false)}
                                className="w-full mt-8 py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl shadow-blue-100"
                            >
                                Got it, thanks!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
