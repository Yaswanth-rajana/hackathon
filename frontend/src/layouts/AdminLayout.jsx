import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WebSocketProvider, useAdminWebSocket } from '../context/WebSocketContext';

// ─── Breadcrumb labels ───────────────────────────────────────────────────────
const ROUTE_LABELS = {
    '': 'Overview',
    'analytics': 'Deep Analytics',
    'performance': 'Performance',
    'reports': 'Reports',
    'forecast': 'Forecast',
    'complaints': 'Complaints',
    'audits': 'Audits',
    'recommendations': 'AI Recommendations',
    'logs': 'Activity Logs',
    'dealers': 'Dealer Management',
    'explorer': 'Blockchain Explorer',
    'simulation': 'Simulation Engine',
};

// ─── Navigation groups ───────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        label: 'MONITORING',
        items: [
            { to: '/admin', end: true, icon: '📊', text: 'Overview' },
            { to: '/admin/analytics', end: false, icon: '📈', text: 'Deep Analytics' },
            { to: '/admin/performance', end: false, icon: '🏆', text: 'Performance' },
            { to: '/admin/explorer', end: false, icon: '⛓️', text: 'Explorer' },
        ],
    },
    {
        label: 'GOVERNANCE',
        items: [
            { to: '/admin/complaints', end: false, icon: '⚠️', text: 'Complaints' },
            { to: '/admin/audits', end: false, icon: '🔍', text: 'Audits' },
            { to: '/admin/recommendations', end: false, icon: '✨', text: 'AI Recs' },
        ],
    },
    {
        label: 'INTELLIGENCE',
        items: [
            { to: '/admin/reports', end: false, icon: '📄', text: 'Reports' },
            { to: '/admin/forecast', end: false, icon: '🔮', text: 'Forecast' },
            { to: '/admin/logs', end: false, icon: '📜', text: 'Logs' },
        ],
    },
    {
        label: 'USER MANAGEMENT',
        items: [
            { to: '/admin/dealers', end: false, icon: '👥', text: 'Dealers' },
        ],
    },
    {
        label: 'TEST & DEMO',
        items: [
            { to: '/admin/simulation', end: false, icon: '⚡', text: 'Simulation' },
        ],
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const menuItemStyle = {
    display: 'block', width: '100%', padding: '0.5rem 0.875rem',
    textAlign: 'left', background: 'none', border: 'none',
    fontSize: '0.875rem', color: '#374151', cursor: 'pointer',
    borderRadius: '0.375rem', fontWeight: '500',
};

const statusField = (label, value) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0 0.75rem' }}>
        <span style={{ color: '#9ca3af' }}>{label}:</span>
        <span style={{ color: '#374151', fontWeight: '600' }}>{value}</span>
    </span>
);

const dividerStyle = {
    display: 'inline-block', width: '1px', height: '14px',
    backgroundColor: '#d1d5db', flexShrink: 0,
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
const AdminLayoutContent = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { connected, lastMessage } = useAdminWebSocket();

    const [alerts, setAlerts] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const dropdownRef = useRef(null);
    const dropdownBtnRef = useRef(null);

    // Last login time (captured at mount)
    const lastLoginLabel = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Auto-refresh "Last Sync" every minute
    useEffect(() => {
        const id = setInterval(() => setLastUpdated(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // WS toast alerts
    useEffect(() => {
        if (lastMessage) {
            setAlerts(prev => [lastMessage, ...prev].slice(0, 3));
            const t = setTimeout(() => setAlerts(prev => prev.filter(m => m.timestamp !== lastMessage.timestamp)), 5000);
            return () => clearTimeout(t);
        }
    }, [lastMessage]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                !dropdownBtnRef.current?.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close dropdown on ESC
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setDropdownOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    // Breadcrumb
    const segments = location.pathname.split('/').filter(Boolean);
    const currentSegment = segments[1] ?? '';
    const currentLabel = ROUTE_LABELS[currentSegment] ?? currentSegment;

    const getLastSyncLabel = () => {
        const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60_000);
        if (diff < 1) return 'Just now';
        if (diff === 1) return '1 min ago';
        return `${diff} min ago`;
    };

    // Tab style factory
    const navLinkStyle = ({ isActive }) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.35rem 0.75rem',
        borderRadius: '0.375rem',
        border: isActive ? '1px solid #e5e7eb' : '1px solid transparent',
        boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
        backgroundColor: isActive ? '#ffffff' : 'transparent',
        fontWeight: isActive ? '600' : '500',
        fontSize: '0.8125rem',
        cursor: 'pointer',
        color: isActive ? '#111827' : '#6b7280',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'color 0.12s, background 0.12s',
    });

    return (
        <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh' }}>

            {/* ── Main Header (sticky) ──────────────────────────────────────── */}
            <header style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
                position: 'sticky', top: 0, zIndex: 100,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>

                {/* Row 1 — Logo + Profile ──────────────────────────────────── */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 2rem', maxWidth: '1440px', margin: '0 auto',
                }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.375rem' }}>🏛️</span>
                        <div>
                            <h1 style={{ fontSize: '1.0625rem', fontWeight: '800', color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                                Government Monitoring Dashboard
                            </h1>
                            <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Andhra Pradesh Public Distribution System
                            </p>
                        </div>
                    </div>

                    {/* Right side ─ live badge + profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>

                        {/* Live monitoring badge — pill with pulse dot only */}
                        <span
                            title={connected
                                ? 'WebSocket connected — real-time anomaly stream active'
                                : 'WebSocket disconnected — real-time updates paused'}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.325rem 0.75rem',
                                borderRadius: '9999px',
                                backgroundColor: connected ? '#dcfce7' : '#fee2e2',
                                border: `1px solid ${connected ? '#bbf7d0' : '#fecaca'}`,
                                fontSize: '0.7rem', fontWeight: '700',
                                color: connected ? '#166534' : '#991b1b',
                                cursor: 'default', userSelect: 'none', letterSpacing: '0.02em',
                            }}
                        >
                            {/* Dot pulses, text does not */}
                            <span className="status-dot-pulse" style={{
                                width: '7px', height: '7px', borderRadius: '50%',
                                backgroundColor: connected ? '#16a34a' : '#dc2626',
                                display: 'inline-block', flexShrink: 0,
                            }} />
                            {connected ? 'Live Monitoring Active' : 'Real-time Updates Paused'}
                        </span>

                        {/* Profile button */}
                        <button
                            ref={dropdownBtnRef}
                            onClick={() => setDropdownOpen(o => !o)}
                            aria-haspopup="menu"
                            aria-expanded={dropdownOpen}
                            aria-controls="profile-dropdown"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.4rem 0.875rem',
                                border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                                backgroundColor: '#f9fafb', cursor: 'pointer',
                                fontSize: '0.8125rem', fontWeight: '700', color: '#111827',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>👤</span>
                            <span>District Collector</span>
                            <span style={{ fontSize: '0.6rem', color: '#9ca3af', marginLeft: '2px' }}>▼</span>
                        </button>

                        {/* Dropdown */}
                        {dropdownOpen && (
                            <div
                                id="profile-dropdown"
                                ref={dropdownRef}
                                role="menu"
                                aria-label="User menu"
                                style={{
                                    position: 'absolute', top: '3.5rem', right: '2rem',
                                    backgroundColor: '#ffffff', border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                    minWidth: '228px', zIndex: 200, padding: '0.375rem',
                                }}
                            >
                                {/* Identity block */}
                                <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid #f3f4f6', marginBottom: '0.375rem' }}>
                                    <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9375rem', color: '#111827' }}>District Collector</p>
                                    <div style={{ marginTop: '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.175rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                            Role: <span style={{ fontWeight: '700', color: '#1d4ed8' }}>Admin</span>
                                        </p>
                                        {user?.district && (
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                                District: <span style={{ fontWeight: '700', color: '#374151' }}>{user.district}</span>
                                            </p>
                                        )}
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>
                                            Last Login: {lastLoginLabel}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <button role="menuitem" tabIndex={0} onClick={() => setDropdownOpen(false)} style={menuItemStyle}>
                                    ⚙️ Settings
                                </button>
                                <button role="menuitem" tabIndex={0} onClick={handleLogout} style={{ ...menuItemStyle, color: '#dc2626' }}>
                                    🚪 Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2 — Global Status Bar ───────────────────────────────── */}
                <div style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e5e7eb', padding: '0.3rem 2rem' }}>
                    <div style={{
                        maxWidth: '1440px', margin: '0 auto',
                        display: 'flex', alignItems: 'center',
                        fontSize: '0.7rem', color: '#6b7280', fontWeight: '500',
                    }}>
                        {statusField('📍 District', user?.district || 'All Districts')}
                        <span style={dividerStyle} />
                        {statusField('🔄 Last Sync', getLastSyncLabel())}
                        <span style={dividerStyle} />
                        {statusField('System', <span style={{ color: '#15803d', fontWeight: '700' }}>🟢 Operational</span>)}
                        <span style={dividerStyle} />
                        {statusField('Blockchain', 'Ledger Active')}
                    </div>
                </div>

                {/* Row 3 — Grouped Navigation ─────────────────────────────── */}
                <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{
                        maxWidth: '1440px', margin: '0 auto',
                        padding: '0.375rem 2rem',
                        display: 'flex', alignItems: 'center', gap: 0,
                        overflowX: 'auto',
                    }}>
                        {NAV_GROUPS.map((group, gIdx) => (
                            <React.Fragment key={group.label}>
                                {/* Group */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flexShrink: 0 }}>
                                    {/* Group label */}
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: '800', color: '#9ca3af',
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        padding: '0 0.5rem', userSelect: 'none', flexShrink: 0,
                                    }}>
                                        {group.label}
                                    </span>

                                    {/* Tab items */}
                                    {group.items.map(item => (
                                        <NavLink key={item.to} to={item.to} end={item.end} style={navLinkStyle}>
                                            <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{item.icon}</span>
                                            {item.text}
                                        </NavLink>
                                    ))}
                                </div>

                                {/* Group divider (except after last) */}
                                {gIdx < NAV_GROUPS.length - 1 && (
                                    <span style={{
                                        display: 'inline-block', width: '1px', height: '24px',
                                        backgroundColor: '#e5e7eb', margin: '0 0.5rem', flexShrink: 0,
                                    }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Row 4 — Breadcrumb ─────────────────────────────────────── */}
                <div style={{ padding: '0.25rem 2rem', backgroundColor: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ maxWidth: '1440px', margin: '0 auto', fontSize: '0.7rem', color: '#9ca3af' }}>
                        <span style={{ color: '#6b7280', fontWeight: '600' }}>Dashboard</span>
                        {currentLabel !== 'Overview' && (
                            <>
                                <span style={{ margin: '0 0.35rem', color: '#d1d5db' }}>›</span>
                                <span style={{ color: '#374151', fontWeight: '700' }}>{currentLabel}</span>
                            </>
                        )}
                    </div>
                </div>

            </header>

            {/* ── WS Toast Alerts ──────────────────────────────────────────── */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1000 }}>
                {alerts.map((alert, idx) => (
                    <div key={idx} style={{
                        padding: '0.875rem 1rem', backgroundColor: '#1f2937', color: 'white',
                        borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        minWidth: '260px', borderLeft: '4px solid #60a5fa',
                    }}>
                        <strong style={{ display: 'block', color: '#60a5fa', fontSize: '0.8125rem' }}>
                            {alert.type?.replace(/_/g, ' ')}
                        </strong>
                        <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>Entity ID: {alert.entity_id}</span>
                    </div>
                ))}
            </div>

            {/* ── Page content ─────────────────────────────────────────────── */}
            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 2rem' }}>
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
