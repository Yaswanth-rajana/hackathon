import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDistrict } from '../context/DistrictContext';
import { WebSocketProvider, useAdminWebSocket } from '../context/WebSocketContext';
import {
    LayoutDashboard, ShieldCheck, ClipboardList, BrainCircuit,
    FileBarChart, Settings, ChevronDown, Menu, X,
    Activity, Database, Shield, User, LogOut,
    Bell, BarChart3, Fingerprint, Search, AlertTriangle,
    Users, Truck, Package, Heart, Cpu, Eye,
    TrendingUp, FileText, Download, Play
} from 'lucide-react';

const LOGO_TEXT = "RationShield";
const SUB_TEXT = "Government Monitoring Platform";

const NAV_STRUCTURE = [
    {
        label: 'Dashboard',
        path: '/admin',
        icon: <LayoutDashboard size={18} />,
        items: [
            { label: 'Overview', path: '/admin', icon: <Eye size={16} />, end: true },
            { label: 'Performance Summary', path: '/admin/performance', icon: <BarChart3 size={16} /> },
            { label: 'Alerts & Notifications', path: '/admin/alerts', icon: <Bell size={16} /> },
        ]
    },
    {
        label: 'Governance',
        path: '/admin/governance',
        icon: <ShieldCheck size={18} />,
        items: [
            { label: 'Complaints', path: '/admin/complaints', icon: <AlertTriangle size={16} /> },
            { label: 'Audits', path: '/admin/audits', icon: <Search size={16} /> },
            { label: 'Inspections', path: '/admin/governance/inspections', icon: <Shield size={16} /> },
            { label: 'Risk Registry', path: '/admin/analytics', icon: <Activity size={16} /> },
        ]
    },
    {
        label: 'Operations',
        path: '/admin/operations',
        icon: <ClipboardList size={18} />,
        items: [
            { label: 'Dealers', path: '/admin/dealers', icon: <Users size={16} /> },
            { label: 'Distribution Logs', path: '/admin/explorer', icon: <Truck size={16} /> },
            { label: 'Inventory Status', path: '/admin/operations/inventory', icon: <Package size={16} /> },
            { label: 'Beneficiaries', path: '/admin/operations/beneficiaries', icon: <Heart size={16} /> },
        ]
    },
    {
        label: 'Intelligence',
        path: '/admin/intelligence',
        icon: <BrainCircuit size={18} />,
        items: [
            { label: 'AI Risk Analysis', path: '/admin/recommendations', icon: <Cpu size={16} /> },
            { label: 'Fraud Detection Insights', path: '/admin/intelligence/fraud', icon: <Fingerprint size={16} /> },
            { label: 'Predictive Trends', path: '/admin/intelligence/trends', icon: <TrendingUp size={16} /> },
        ]
    },
    {
        label: 'Reports',
        path: '/admin/reports',
        icon: <FileBarChart size={18} />,
        items: [
            { label: 'Monthly Reports', path: '/admin/reports', icon: <FileText size={16} />, end: true },
            { label: 'Compliance Reports', path: '/admin/reports/compliance', icon: <Shield size={16} /> },
            { label: 'Forecast & Projections', path: '/admin/forecast', icon: <TrendingUp size={16} /> },
            { label: 'Data Export', path: '/admin/reports/export', icon: <Download size={16} /> },
        ]
    },
    {
        label: 'System',
        path: '/admin/system',
        icon: <Settings size={18} />,
        items: [
            { label: 'User Management', path: '/admin/system/users', icon: <User size={16} /> },
            { label: 'Activity Logs', path: '/admin/logs', icon: <Database size={16} /> },
            { label: 'Configuration', path: '/admin/system/config', icon: <Settings size={16} /> },
            { label: 'Simulation', path: '/admin/simulation', icon: <Play size={16} />, demoOnly: true },
        ]
    },
];

const AdminLayoutContent = () => {
    const { user, logout } = useAuth();
    const { selectedDistrict } = useDistrict();
    const navigate = useNavigate();
    const location = useLocation();
    const { connected } = useAdminWebSocket();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [profileOpen, setProfileOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);

    // DEMO_MODE toggle (normally from env, here for UI control)
    const DEMO_MODE = true;

    const dropdownRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => setLastUpdated(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    // WS toast alerts
    const { lastMessage } = useAdminWebSocket();
    useEffect(() => {
        if (lastMessage) {
            setAlerts(prev => [lastMessage, ...prev].slice(0, 3));
            const t = setTimeout(() => setAlerts(prev => prev.filter(m => m.timestamp !== lastMessage.timestamp)), 5000);
            return () => clearTimeout(t);
        }
    }, [lastMessage]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setActiveDropdown(null);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getLastSyncLabel = () => {
        const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        return diff < 1 ? 'Just now' : `${diff} min ago`;
    };

    return (
        <div className="min-h-screen bg-[#F3F4F6] font-['Inter']">
            {/* ── LEVEL 1: SYSTEM HEADER (Thin Status Bar) ────────────────── */}
            <div className="h-9 bg-[#F4F6F8] border-b border-[#E5E7EB] flex items-center px-6 text-[13px] text-[#6B7280]">
                <div className="max-w-[1440px] w-full mx-auto flex justify-between items-center">
                    {/* Left Group */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1F2937]">District:</span>
                            <span className="font-normal">{selectedDistrict}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <span className="font-semibold text-[#1F2937]">Last Sync:</span>
                            <span className="font-normal">{getLastSyncLabel()}</span>
                        </div>
                    </div>

                    {/* Right Group */}
                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                            <span className="font-semibold text-[#1F2937]">System Status:</span>
                            <span className="font-normal">{connected ? 'Operational' : 'Disconnected'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                            <span className="font-semibold text-[#1F2937]">Ledger Status:</span>
                            <span className="font-normal">Active</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#1F2937]">Role:</span>
                            <span className="font-normal text-[#1E3A8A]">Admin</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── LEVEL 2: PRIMARY NAVIGATION BAR ─────────────────────────── */}
            <header className="h-[60px] bg-white border-b border-[#E2E8F0] sticky top-0 z-50">
                <div className="max-w-[1440px] w-full mx-auto h-full flex items-center justify-between px-6">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/admin')}>
                        <div className="w-8 h-8 bg-[#1E3A8A] rounded flex items-center justify-center text-white">
                            <Shield size={20} fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[#1E3A8A] leading-none">{LOGO_TEXT}</h1>
                            <p className="text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">{SUB_TEXT}</p>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center h-full px-8 flex-1" ref={dropdownRef}>
                        <ul className="flex items-center h-full gap-2">
                            {NAV_STRUCTURE.map((section) => {
                                const isActive = section.items.some(item =>
                                    item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)
                                );
                                return (
                                    <li key={section.label} className="h-full relative group">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === section.label ? null : section.label)}
                                            className={`
                                                flex items-center gap-2 px-4 h-full text-[15px] font-medium transition-all duration-150
                                                ${isActive ? 'text-[#1E3A8A] border-b-[3px] border-[#1E3A8A]' : 'text-[#1F2937] border-b-[3px] border-transparent hover:bg-[#F9FAFB]'}
                                            `}
                                        >
                                            {section.label}
                                            <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === section.label ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeDropdown === section.label && (
                                            <div className="absolute top-full left-0 mt-0.5 w-64 bg-white border border-[#E2E8F0] rounded-b-lg shadow-sm overflow-hidden animate-in fade-in duration-150 z-[60]">
                                                <div className="py-2">
                                                    {section.items.map((item) => {
                                                        if (item.demoOnly && !DEMO_MODE) return null;
                                                        return (
                                                            <NavLink
                                                                key={item.label}
                                                                to={item.path}
                                                                end={item.end}
                                                                className={({ isActive }) => `
                                                                    flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors
                                                                    ${isActive ? 'bg-[#F3F4F6] text-[#1E3A8A] font-semibold' : 'text-[#4B5563] hover:bg-[#F9FAFB]'}
                                                                `}
                                                            >
                                                                <span className={isActive ? 'text-[#1E3A8A]' : 'text-[#9CA3AF]'}>
                                                                    {item.icon}
                                                                </span>
                                                                {item.label}
                                                            </NavLink>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Profile & Mobile Toggle */}
                    <div className="flex items-center gap-4">
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(!profileOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F9FAFB] rounded-lg transition-colors border border-transparent hover:border-[#E5E7EB]"
                            >
                                <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#1E3A8A] border border-[#E5E7EB]">
                                    <User size={18} />
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-[13px] font-bold text-[#1F2937] leading-tight">Admin User</p>
                                    <p className="text-[11px] text-[#6B7280] leading-tight">District HQ</p>
                                </div>
                                <ChevronDown size={14} className="text-[#9CA3AF]" />
                            </button>

                            {/* Profile Dropdown */}
                            {profileOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-lg shadow-sm py-2 z-[60] animate-in fade-in duration-150">
                                    <div className="px-4 py-2 border-b border-[#F3F4F6] mb-1">
                                        <p className="text-xs font-semibold text-[#9CA3AF] uppercase">Signed in as</p>
                                        <p className="text-sm font-bold text-[#1F2937]">admin@ration.gov.in</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigate('/admin/system/config');
                                            setProfileOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
                                    >
                                        <Settings size={16} /> Account Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#DC2626] hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            className="lg:hidden p-2 text-[#1F2937] hover:bg-[#F9FAFB] rounded-lg"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden bg-white overflow-y-auto pt-4 shadow-xl">
                    <div className="flex justify-between items-center px-6 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#1E3A8A] rounded flex items-center justify-center text-white">
                                <Shield size={20} fill="currentColor" />
                            </div>
                            <h1 className="text-lg font-bold text-[#1E3A8A]">{LOGO_TEXT}</h1>
                        </div>
                        <button onClick={() => setMobileMenuOpen(false)}>
                            <X size={24} className="text-[#1F2937]" />
                        </button>
                    </div>

                    <nav className="px-4 space-y-1">
                        {NAV_STRUCTURE.map((section) => (
                            <div key={section.label} className="space-y-1">
                                <div className="px-3 py-2 text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mt-4">
                                    {section.label}
                                </div>
                                {section.items.map((item) => {
                                    if (item.demoOnly && !DEMO_MODE) return null;
                                    return (
                                        <NavLink
                                            key={item.label}
                                            to={item.path}
                                            end={item.end}
                                            className={({ isActive }) => `
                                                flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] transition-all
                                                ${isActive ? 'bg-[#1E3A8A] text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6]'}
                                            `}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    <div className="p-6 mt-6 border-t border-[#F3F4F6]">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-red-50 text-[#DC2626] font-bold"
                        >
                            <LogOut size={20} /> Logout
                        </button>
                    </div>
                </div>
            )}

            {/* Live Updates Status Banner */}
            {!connected && (
                <div className="bg-[#FEF2F2] border-b border-[#FEE2E2] px-6 py-2 animate-in slide-in-from-top duration-300">
                    <div className="max-w-[1440px] mx-auto flex items-center gap-2 text-[#991B1B] text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                        <span>Real-time Updates Paused. Attempting to reconnect...</span>
                    </div>
                </div>
            )}

            {/* ── MAIN CONTENT AREA ─────────────────────────────────────── */}
            <main className="max-w-[1440px] mx-auto p-4 md:p-8">
                {/* Status Alerts (WebSocket Toasts) */}
                <div className="fixed bottom-8 right-8 z-[200] space-y-3 pointer-events-none">
                    {alerts.map((alert, idx) => (
                        <div key={idx} className="pointer-events-auto p-4 bg-[#1F2937] text-white rounded-lg shadow-lg border-l-4 border-[#3B82F6] min-w-[280px] animate-in slide-in-from-right duration-300">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                                    {alert.type?.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] text-[#6B7280]">Just now</span>
                            </div>
                            <p className="text-sm font-medium">Anomaly detected in {alert.entity_id}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#60A5FA] text-[10px] font-bold rounded">
                                    {alert.severity || 'HIGH'}
                                </div>
                                <span className="text-[10px] text-[#9CA3AF]">Ledger updated</span>
                            </div>
                        </div>
                    ))}
                </div>

                <Outlet />
            </main>
        </div>
    );
};

const AdminLayout = () => (
    <WebSocketProvider>
        <AdminLayoutContent />
    </WebSocketProvider>
);

export default AdminLayout;
