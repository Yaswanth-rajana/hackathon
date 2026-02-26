import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    getDealers, createDealer, updateDealer,
    suspendDealer, reactivateDealer, resetDealerPassword,
} from '../../api/adminDealers';

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_MAP = {
    active: { bg: '#dcfce7', color: '#166534', dot: '#22c55e', label: 'Active', icon: '🟢' },
    suspended: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'Suspended', icon: '🔴' },
    expired: { bg: '#f3f4f6', color: '#374151', dot: '#6b7280', label: 'Expired', icon: '⚫' },
    under_review: { bg: '#fef9c3', color: '#78350f', dot: '#f59e0b', label: 'Under Review', icon: '🟡' },
};

function StatusBadge({ status }) {
    const s = STATUS_MAP[status] || STATUS_MAP.active;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.15rem 0.55rem', borderRadius: '9999px',
            backgroundColor: s.bg, color: s.color,
            fontSize: '0.7rem', fontWeight: '700',
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
            {s.label}
        </span>
    );
}

// ─── License expiry badge (3-tier) ────────────────────────────────────────────
function LicenseBadge({ daysToExpiry, licenseUntil }) {
    if (daysToExpiry === null || daysToExpiry === undefined) {
        return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>—</span>;
    }
    const dateStr = licenseUntil
        ? new Date(licenseUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
        : '—';

    if (daysToExpiry < 0) {
        return <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{dateStr} (Expired)</span>;
    }
    if (daysToExpiry < 7) {
        return (
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#374151' }}>{dateStr}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                    🔴 {daysToExpiry}d left — Critical
                </span>
            </span>
        );
    }
    if (daysToExpiry <= 30) {
        return (
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#374151' }}>{dateStr}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>
                    🟡 {daysToExpiry}d left — Warning
                </span>
            </span>
        );
    }
    return <span style={{ fontSize: '0.75rem', color: '#374151' }}>{dateStr}</span>;
}

// ─── Shared modal overlay ─────────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={{
                backgroundColor: '#ffffff', borderRadius: '0.75rem',
                boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
                width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
                padding: '1.5rem',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontWeight: '800', fontSize: '1.0625rem', color: '#111827' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ─── Shared form helpers ──────────────────────────────────────────────────────
const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db', borderRadius: '0.375rem',
    fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
    color: '#111827', backgroundColor: '#fff',
};
const labelStyle = { fontSize: '0.8rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' };
const formRow = (label, children) => (
    <div style={{ marginBottom: '0.875rem' }}>
        <label style={labelStyle}>{label}</label>
        {children}
    </div>
);

// ─── Create Dealer Modal ──────────────────────────────────────────────────────
function CreateDealerModal({ token, onClose, onSuccess }) {
    const [form, setForm] = useState({
        name: '', email: '', mobile: '', shop_id: '', mandal: '', license_valid_until: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const valid = form.name && form.email && form.mobile.length >= 10 &&
        form.shop_id && form.mandal && form.license_valid_until;

    const handleSubmit = async () => {
        if (!valid || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const data = await createDealer(token, form);
            onSuccess(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal title="➕ Create Dealer" onClose={onClose}>
            {formRow('Full Name *', <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="P. Ramudu" />)}
            {formRow('Email Address *', <input type="email" style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ramudu@fairprice.gov.in" />)}
            {formRow('Mobile Number *', <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="9876543210" maxLength={15} />)}
            {formRow('Shop ID *', <input style={inputStyle} value={form.shop_id} onChange={e => setForm(f => ({ ...f, shop_id: e.target.value }))} placeholder="TPT123" />)}
            {formRow('Mandal *', <input style={inputStyle} value={form.mandal} onChange={e => setForm(f => ({ ...f, mandal: e.target.value }))} placeholder="Renigunta" />)}
            {formRow('License Valid Until *', <input type="date" style={inputStyle} value={form.license_valid_until} onChange={e => setForm(f => ({ ...f, license_valid_until: e.target.value }))} min={new Date().toISOString().split('T')[0]} />)}

            {error && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '0.375rem', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: '#991b1b', marginBottom: '0.875rem' }}>
                    ⚠ {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={onClose} style={{ padding: '0.5rem 1.125rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!valid || submitting}
                    style={{
                        padding: '0.5rem 1.125rem', borderRadius: '0.375rem', border: 'none',
                        backgroundColor: !valid || submitting ? '#93c5fd' : '#2563eb',
                        color: 'white', fontSize: '0.875rem', fontWeight: '700',
                        cursor: !valid || submitting ? 'not-allowed' : 'pointer',
                    }}
                >
                    {submitting ? 'Creating…' : 'Create Dealer'}
                </button>
            </div>
        </Modal>
    );
}

// ─── Temp Password Result Modal ───────────────────────────────────────────────
function TempPasswordModal({ result, onClose }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(result.temp_password || '').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <Modal title="🔑 Temporary Password" onClose={onClose}>
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: '700', color: '#92400e', fontSize: '0.8125rem' }}>
                    ⚠ This password will be shown only once. Store it securely before closing.
                </p>
            </div>
            <div style={{ backgroundColor: '#1f2937', borderRadius: '0.5rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                <code style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.08em', flexGrow: 1 }}>
                    {result.temp_password}
                </code>
                <button onClick={copy} style={{ padding: '0.375rem 0.75rem', backgroundColor: copied ? '#059669' : '#374151', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0 }}>
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            {result.dealer_id && (
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem' }}>
                    Dealer ID: <strong style={{ color: '#374151' }}>{result.dealer_id}</strong>
                </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' }}>
                    I've saved the password
                </button>
            </div>
        </Modal>
    );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmColor = '#dc2626', onConfirm, onClose, loading }) {
    return (
        <Modal title={title} onClose={onClose}>
            <p style={{ color: '#374151', fontSize: '0.9rem', margin: '0 0 1.25rem', lineHeight: 1.6 }}>{message}</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button onClick={onClose} disabled={loading} style={{ padding: '0.5rem 1.125rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                <button onClick={onConfirm} disabled={loading} style={{ padding: '0.5rem 1.125rem', borderRadius: '0.375rem', border: 'none', backgroundColor: loading ? '#fca5a5' : confirmColor, color: 'white', fontSize: '0.875rem', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    {loading ? 'Processing…' : confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

// ─── Edit Dealer Modal ────────────────────────────────────────────────────────
function EditDealerModal({ dealer, token, onClose, onSuccess }) {
    const [form, setForm] = useState({
        mobile: dealer.mobile || '',
        license_valid_until: dealer.license_valid_until
            ? new Date(dealer.license_valid_until).toISOString().split('T')[0]
            : '',
        dealer_status: dealer.dealer_status || 'active',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const payload = {};
            if (form.mobile !== dealer.mobile) payload.mobile = form.mobile;
            if (form.dealer_status !== dealer.dealer_status) payload.dealer_status = form.dealer_status;
            if (form.license_valid_until) payload.license_valid_until = form.license_valid_until;
            await updateDealer(token, dealer.id, payload);
            onSuccess();
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal title={`✏️ Edit — ${dealer.name}`} onClose={onClose}>
            {formRow('Mobile Number', <input style={inputStyle} value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />)}
            {formRow('License Valid Until', <input type="date" style={inputStyle} value={form.license_valid_until} onChange={e => setForm(f => ({ ...f, license_valid_until: e.target.value }))} />)}
            {formRow('Status', (
                <select style={inputStyle} value={form.dealer_status} onChange={e => setForm(f => ({ ...f, dealer_status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="under_review">Under Review</option>
                    <option value="expired">Expired</option>
                </select>
            ))}
            {error && <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginBottom: '0.875rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={onClose} style={{ padding: '0.5rem 1.125rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} style={{ padding: '0.5rem 1.125rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' }}>
                    {submitting ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </Modal>
    );
}

// ─── Action Dropdown ──────────────────────────────────────────────────────────
function ActionMenu({ dealer, onEdit, onSuspend, onReactivate, onReset }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const isSuspended = dealer.dealer_status === 'suspended';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(o => !o)} style={{ padding: '0.35rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>
                Actions ▾
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: '110%', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '160px', zIndex: 999, padding: '0.25rem' }}>
                    {[
                        { label: '✏️ Edit', action: onEdit },
                        isSuspended
                            ? { label: '✅ Reactivate', action: onReactivate }
                            : { label: '🚫 Suspend', action: onSuspend },
                        { label: '🔑 Reset Password', action: onReset },
                    ].map(item => (
                        <button key={item.label} onClick={() => { setOpen(false); item.action(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#374151', borderRadius: '0.25rem', fontWeight: '500' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DealersPage() {
    const { token } = useAuth();

    const [dealers, setDealers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const LIMIT = 20;

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [mandalFilter, setMandalFilter] = useState('');

    // Modal state
    const [showCreate, setShowCreate] = useState(false);
    const [showTempPw, setShowTempPw] = useState(null);    // { dealer_id, temp_password }
    const [editDealer, setEditDealer] = useState(null);
    const [suspendTarget, setSuspendTarget] = useState(null);
    const [reactivateTarget, setReactivateTarget] = useState(null);
    const [resetTarget, setResetTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const fetchDealers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getDealers(token, { page, limit: LIMIT, status: statusFilter, mandal: mandalFilter, search });
            setDealers(data.dealers || []);
            setTotal(data.total || 0);
        } catch (e) {
            console.error('Failed to fetch dealers:', e);
        } finally {
            setLoading(false);
        }
    }, [token, page, statusFilter, mandalFilter, search]);

    useEffect(() => { fetchDealers(); }, [fetchDealers]);

    // Reset to page 1 when filters change
    useEffect(() => { setPage(1); }, [statusFilter, mandalFilter, search]);

    const totalPages = Math.ceil(total / LIMIT);

    // ── Action handlers ─────────────────────────────────────────────────────

    const handleSuspend = async () => {
        setActionLoading(true);
        setActionError('');
        try {
            await suspendDealer(token, suspendTarget.id);
            setSuspendTarget(null);
            fetchDealers();
        } catch (e) {
            setActionError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivate = async () => {
        setActionLoading(true);
        setActionError('');
        try {
            await reactivateDealer(token, reactivateTarget.id);
            setReactivateTarget(null);
            fetchDealers();
        } catch (e) {
            setActionError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setActionLoading(true);
        setActionError('');
        try {
            const data = await resetDealerPassword(token, resetTarget.id);
            setResetTarget(null);
            setShowTempPw(data);  // Show temp password once
        } catch (e) {
            setActionError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const inputSty = { padding: '0.4rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8125rem', outline: 'none', color: '#111827', backgroundColor: '#fff' };

    // ── Skeleton ───────────────────────────────────────────────────────────
    if (loading && dealers.length === 0) {
        return (
            <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="skeleton" style={{ height: '24px', width: '200px', borderRadius: '0.375rem' }} />
                    <div style={{ marginLeft: 'auto' }}>
                        <div className="skeleton" style={{ height: '34px', width: '130px', borderRadius: '0.375rem' }} />
                    </div>
                </div>
                {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr 1fr 1fr 0.7fr', gap: '1rem', padding: '0.875rem 0', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                        {[200, 140, 100, 80, 120, 100, 60].map((w, j) => (
                            <div key={j} className="skeleton" style={{ height: '14px', width: `${w}px`, borderRadius: '0.25rem' }} />
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>👥 Dealer Management</h2>
                    <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                        Create, manage, and control dealer accounts across your district
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontWeight: '600' }}>
                        {total} Total
                    </span>
                    <button onClick={fetchDealers} style={{ padding: '0.4rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>
                        ↻ Refresh
                    </button>
                    <button onClick={() => setShowCreate(true)} style={{ padding: '0.45rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        ➕ Create Dealer
                    </button>
                </div>
            </div>

            {/* ── Filters ────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.875rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <input placeholder="🔍 Search name, email, mobile…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSty, minWidth: '200px', flexGrow: 1 }} />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputSty}>
                    <option value="">All Statuses</option>
                    <option value="active">🟢 Active</option>
                    <option value="suspended">🔴 Suspended</option>
                    <option value="expired">⚫ Expired</option>
                    <option value="under_review">🟡 Under Review</option>
                </select>
                <input placeholder="Filter by Mandal…" value={mandalFilter} onChange={e => setMandalFilter(e.target.value)} style={{ ...inputSty, minWidth: '140px' }} />
                {(statusFilter || mandalFilter || search) && (
                    <button onClick={() => { setStatusFilter(''); setMandalFilter(''); setSearch(''); }} style={{ ...inputSty, background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                        ✕ Clear
                    </button>
                )}
            </div>

            {/* ── Table / Empty state ─────────────────────────────────────── */}
            {dealers.length === 0 && !loading ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>👥</span>
                    <p style={{ fontWeight: '800', color: '#111827', fontSize: '1.0625rem', margin: '0 0 0.375rem' }}>
                        {statusFilter || mandalFilter || search ? 'No dealers match your filters' : 'No dealers registered yet'}
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
                        {statusFilter || mandalFilter || search
                            ? 'Try adjusting your search or filter criteria.'
                            : 'Create a dealer to assign shop operations in your district.'}
                    </p>
                    {!statusFilter && !mandalFilter && !search && (
                        <button onClick={() => setShowCreate(true)} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' }}>
                            ➕ Create First Dealer
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', overflow: 'visible', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 0.9fr 0.9fr 1.3fr 1fr 0.8fr', gap: '0', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem' }}>
                        {['Dealer', 'Shop', 'Mandal', 'Status', 'License Validity', 'Last Login', 'Actions'].map(h => (
                            <div key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                        ))}
                    </div>

                    {/* Table rows */}
                    {dealers.map((d, idx) => (
                        <div key={d.id} style={{
                            display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 0.9fr 0.9fr 1.3fr 1fr 0.8fr',
                            gap: 0, borderBottom: idx < dealers.length - 1 ? '1px solid #f3f4f6' : 'none',
                            alignItems: 'center',
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                            borderBottomLeftRadius: (idx === dealers.length - 1 && totalPages <= 1) ? '0.5rem' : 0,
                            borderBottomRightRadius: (idx === dealers.length - 1 && totalPages <= 1) ? '0.5rem' : 0,
                            position: 'relative',
                            zIndex: dealers.length - idx // Ensure earlier rows stack above later rows so dropdowns overlap correctly
                        }}>
                            {/* Dealer */}
                            <div style={{ padding: '0.875rem 1rem' }}>
                                <p style={{ margin: 0, fontWeight: '700', color: '#111827', fontSize: '0.875rem' }}>{d.name}</p>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>{d.email || d.mobile}</p>
                                {d.must_change_password && (
                                    <span style={{ fontSize: '0.6rem', backgroundColor: '#fffbeb', color: '#92400e', fontWeight: '700', padding: '0.1rem 0.35rem', borderRadius: '9999px', border: '1px solid #fcd34d' }}>
                                        ⚠ Must change password
                                    </span>
                                )}
                            </div>
                            {/* Shop */}
                            <div style={{ padding: '0.875rem 1rem' }}>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#374151', fontWeight: '600' }}>{d.shop_name || '—'}</p>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af' }}>{d.shop_id}</p>
                            </div>
                            {/* Mandal */}
                            <div style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: '#374151' }}>{d.mandal || '—'}</div>
                            {/* Status */}
                            <div style={{ padding: '0.875rem 1rem' }}>
                                <StatusBadge status={d.dealer_status} />
                            </div>
                            {/* License */}
                            <div style={{ padding: '0.875rem 1rem' }}>
                                <LicenseBadge daysToExpiry={d.days_to_expiry} licenseUntil={d.license_valid_until} />
                            </div>
                            {/* Last Login */}
                            <div style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                {d.last_login
                                    ? new Date(d.last_login).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                                    : <span style={{ color: '#d1d5db' }}>Never</span>}
                            </div>
                            {/* Actions */}
                            <div style={{ padding: '0.875rem 1rem' }}>
                                <ActionMenu
                                    dealer={d}
                                    onEdit={() => setEditDealer(d)}
                                    onSuspend={() => setSuspendTarget(d)}
                                    onReactivate={() => setReactivateTarget(d)}
                                    onReset={() => setResetTarget(d)}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                Page {page} of {totalPages} · {total} total dealers
                            </span>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} style={{ padding: '0.375rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: page <= 1 ? '#f3f4f6' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', color: page <= 1 ? '#9ca3af' : '#374151', fontWeight: '600' }}>← Prev</button>
                                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={{ padding: '0.375rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: page >= totalPages ? '#f3f4f6' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', color: page >= totalPages ? '#9ca3af' : '#374151', fontWeight: '600' }}>Next →</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Modals ──────────────────────────────────────────────────── */}
            {showCreate && (
                <CreateDealerModal
                    token={token}
                    onClose={() => setShowCreate(false)}
                    onSuccess={(data) => {
                        setShowCreate(false);
                        setShowTempPw(data);
                        fetchDealers();
                    }}
                />
            )}

            {showTempPw && <TempPasswordModal result={showTempPw} onClose={() => setShowTempPw(null)} />}

            {editDealer && (
                <EditDealerModal
                    dealer={editDealer}
                    token={token}
                    onClose={() => setEditDealer(null)}
                    onSuccess={() => { setEditDealer(null); fetchDealers(); }}
                />
            )}

            {suspendTarget && (
                <ConfirmModal
                    title="🚫 Suspend Dealer"
                    message={`Are you sure you want to suspend ${suspendTarget.name}? They will be blocked from logging in immediately.`}
                    confirmLabel="Suspend Dealer"
                    confirmColor="#dc2626"
                    onConfirm={handleSuspend}
                    onClose={() => { setSuspendTarget(null); setActionError(''); }}
                    loading={actionLoading}
                />
            )}

            {reactivateTarget && (
                <ConfirmModal
                    title="✅ Reactivate Dealer"
                    message={`Reactivate ${reactivateTarget.name}? Ensure their license is valid before proceeding.`}
                    confirmLabel="Reactivate"
                    confirmColor="#059669"
                    onConfirm={handleReactivate}
                    onClose={() => { setReactivateTarget(null); setActionError(''); }}
                    loading={actionLoading}
                />
            )}

            {resetTarget && (
                <ConfirmModal
                    title="🔑 Reset Password"
                    message={`Reset password for ${resetTarget.name}? A new temporary password will be generated and shown once. The dealer must change it on next login.`}
                    confirmLabel="Reset Password"
                    confirmColor="#d97706"
                    onConfirm={handleResetPassword}
                    onClose={() => { setResetTarget(null); setActionError(''); }}
                    loading={actionLoading}
                />
            )}

            {actionError && (
                <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fee2e2', border: '1px solid #f87171', borderRadius: '0.5rem', padding: '0.75rem 1.25rem', color: '#991b1b', fontWeight: '600', fontSize: '0.875rem', zIndex: 2000 }}>
                    ⚠ {actionError}
                    <button onClick={() => setActionError('')} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: '800' }}>×</button>
                </div>
            )}
        </div>
    );
}
