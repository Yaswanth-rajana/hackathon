import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDistrict } from '../context/DistrictContext';
import { WebSocketProvider, useAdminWebSocket } from '../context/WebSocketContext';
import { ANDHRA_PRADESH_DISTRICTS } from '../constants/districts';
import {
    LayoutDashboard,
    BrainCircuit,
    Fingerprint,
    TrendingUp,
    AlertTriangle,
    ClipboardList,
    Users,
    Blocks,
    FileBarChart,
    Play,
    Radio,
    Settings,
    Menu,
    X,
    Shield,
    LogOut,
    User
} from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Intelligence', to: '/admin/intelligence/risk-analysis', icon: BrainCircuit },
    { label: 'Fraud Analysis', to: '/admin/intelligence/fraud-insights', icon: Fingerprint },
    { label: 'Predictive Trends', to: '/admin/intelligence/predictive-trends', icon: TrendingUp },
    { label: 'Complaints', to: '/admin/complaints', icon: AlertTriangle },
    { label: 'Audits', to: '/admin/audits', icon: ClipboardList },
    { label: 'Dealers', to: '/admin/dealers', icon: Users },
    { label: 'Blockchain', to: '/admin/explorer', icon: Blocks },
    { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
    { label: 'Simulation', to: '/admin/simulation', icon: Play },
    { label: 'Live Monitor', to: '/admin/live-monitor', icon: Radio },
    { label: 'System', to: '/admin/system/config', icon: Settings }
];

const breadcrumbLabel = (pathname) => {
    const hit = NAV_ITEMS.find((item) => item.end ? pathname === item.to : pathname.startsWith(item.to));
    return hit ? hit.label : 'Dashboard';
};

const AdminLayoutContent = () => {
    const { user, logout } = useAuth();
    const { selectedDistrict, setSelectedDistrict } = useDistrict();
    const { connected } = useAdminWebSocket();
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setLastUpdated(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    const lastSyncText = useMemo(() => {
        const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        return mins <= 0 ? 'Just now' : `${mins} min ago`;
    }, [lastUpdated]);

    const sectionName = breadcrumbLabel(location.pathname);

    const onLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="gov-shell min-h-screen">
            <header className="gov-header sticky top-0 z-50">
                <div className="gov-header-inner">
                    <div className="flex items-center gap-3">
                        <button className="lg:hidden p-1 text-white/90" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
                            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                        <div className="w-9 h-9 bg-white/10 border border-white/20 rounded-sm flex items-center justify-center text-white">
                            <Shield size={20} />
                        </div>
                        <div>
                            <div className="text-white font-bold text-lg leading-tight">RationShield</div>
                            <div className="text-white/80 text-[11px] uppercase tracking-wide">Public Distribution Transparency System</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                        <span className="hidden xl:inline text-white/85 border border-white/25 rounded px-2 py-1 text-xs">
                            Internal Governance Portal - Authorized Access Only
                        </span>
                        <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            className="bg-white text-[#0B3D91] border border-white/40 rounded px-2 py-1 text-xs font-semibold"
                        >
                            {ANDHRA_PRADESH_DISTRICTS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <div className="hidden md:flex items-center gap-2 border border-white/20 rounded px-2 py-1 text-white/90">
                            <User size={14} />
                            <span>{user?.id || 'admin_1'}</span>
                        </div>
                        <button onClick={onLogout} className="text-white border border-white/35 rounded px-2 py-1 text-xs font-semibold hover:bg-white/10">
                            <LogOut size={13} className="inline mr-1" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="gov-subheader">
                <div className="gov-subheader-inner">
                    <div className="text-sm text-[#0B3D91] font-semibold">Dashboard / {sectionName}</div>
                    <div className="flex items-center gap-4 text-xs text-[#334155]">
                        <span>District: <strong>{selectedDistrict}</strong></span>
                        <span>Last Sync: <strong>{lastSyncText}</strong></span>
                        <span className={connected ? 'text-[#1B5E20]' : 'text-[#B71C1C]'}>
                            {connected ? 'System Status: Operational' : 'System Status: Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            {!connected && (
                <div className="bg-[#FFF3E0] border-b border-[#FFE0B2] text-[#E65100] text-xs px-6 py-2">
                    Risk Escalation Feed Paused - Reconnection in progress.
                </div>
            )}

            <div className="gov-body">
                <aside className={`gov-sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                    <nav className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.label}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `gov-nav-item ${isActive ? 'gov-nav-item-active' : ''}`
                                    }
                                >
                                    <Icon size={16} />
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                </aside>

                {sidebarOpen && (
                    <button className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />
                )}

                <main className="gov-main">
                    <Outlet />
                </main>
            </div>

            <footer className="gov-footer">
                <div className="max-w-[1440px] mx-auto px-6">
                    Government of Andhra Pradesh | Public Distribution Monitoring System | Powered by Blockchain & AI | © 2026
                </div>
            </footer>
        </div>
    );
};

const AdminLayout = () => (
    <WebSocketProvider>
        <AdminLayoutContent />
    </WebSocketProvider>
);

export default AdminLayout;
