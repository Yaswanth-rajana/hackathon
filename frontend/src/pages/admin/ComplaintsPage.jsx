import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ComplaintsPage() {
    const { token } = useAuth();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMandal, setFilterMandal] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');

    const fetchComplaints = async () => {
        try {
            setLoading(true);
            const url = new URL(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/complaints`);
            url.searchParams.set('limit', '100');
            if (filterDistrict) url.searchParams.set('district', filterDistrict);
            if (filterStatus) url.searchParams.set('status', filterStatus);
            if (filterFrom) url.searchParams.set('from_date', filterFrom);
            if (filterTo) url.searchParams.set('to_date', filterTo);
            if (filterMandal) url.searchParams.set('mandal', filterMandal);

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setComplaints(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch complaints:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchComplaints(); }, [filterDistrict, filterStatus, filterFrom, filterTo, filterMandal]);

    const [processingIds, setProcessingIds] = useState(new Set());

    const handleAssign = async (id, inspectorId) => {
        const originalComplaints = [...complaints];
        setComplaints(complaints.map(c => c.id === id ? { ...c, status: 'in_progress', inspector_id: inspectorId } : c));
        setProcessingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/complaints/${id}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ inspector_id: inspectorId })
            });
            if (res.ok) fetchComplaints();
            else { alert('Failed to assign. Rolling back.'); setComplaints(originalComplaints); }
        } catch {
            setComplaints(originalComplaints);
        } finally {
            setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    const handleResolve = async (id, notes) => {
        const originalComplaints = [...complaints];
        setComplaints(complaints.map(c => c.id === id ? { ...c, status: 'resolved' } : c));
        setProcessingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/complaints/${id}/resolve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resolution_notes: notes })
            });
            if (res.ok) fetchComplaints();
            else { alert('Failed to resolve. Rolling back.'); setComplaints(originalComplaints); }
        } catch {
            setComplaints(originalComplaints);
        } finally {
            setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    // Client-side filtering
    // TODO: move filtering to backend when dataset > 500 records
    const filtered = complaints.filter(c => {
        if (filterStatus && c.status !== filterStatus) return false;
        if (filterMandal && !(c.mandal || '').toLowerCase().includes(filterMandal.toLowerCase())) return false;
        if (filterFrom && new Date(c.created_at) < new Date(filterFrom)) return false;
        if (filterTo && new Date(c.created_at) > new Date(filterTo + 'T23:59:59')) return false;
        return true;
    });

    const statusBadge = (status) => {
        const map = {
            resolved: { bg: '#dcfce7', color: '#166534', label: 'RESOLVED' },
            in_progress: { bg: '#fef3c7', color: '#92400e', label: 'IN PROGRESS' },
            escalated: { bg: '#fee2e2', color: '#991b1b', label: 'ESCALATED' },
            pending: { bg: '#f3f4f6', color: '#374151', label: 'PENDING' },
        };
        const s = map[status] || { bg: '#f3f4f6', color: '#374151', label: status?.toUpperCase() };
        return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
    };

    const inputStyle = { padding: '0.4rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8125rem', outline: 'none' };

    return (
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>🧾 Complaint Lifecycle Management</h2>
                    <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Track, assign, and resolve citizen complaints</p>
                </div>
                <button onClick={fetchComplaints} style={{ padding: '0.4rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>↻ Refresh</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.875rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} style={inputStyle}>
                    <option value="">All Districts</option>
                    <option value="Alluri Sitharama Raju">Alluri Sitharama Raju</option>
                    <option value="Anakapalli">Anakapalli</option>
                    <option value="Anantapur">Anantapur</option>
                    <option value="Annamayya">Annamayya</option>
                    <option value="Bapatla">Bapatla</option>
                    <option value="Chittoor">Chittoor</option>
                    <option value="East Godavari">East Godavari</option>
                    <option value="Eluru">Eluru</option>
                    <option value="Guntur">Guntur</option>
                    <option value="Kakinada">Kakinada</option>
                    <option value="Konaseema">Konaseema</option>
                    <option value="Krishna">Krishna</option>
                    <option value="Kurnool">Kurnool</option>
                    <option value="Nandyal">Nandyal</option>
                    <option value="NTR">NTR</option>
                    <option value="Palnadu">Palnadu</option>
                    <option value="Parvathipuram Manyam">Parvathipuram Manyam</option>
                    <option value="Prakasam">Prakasam</option>
                    <option value="Sri Potti Sriramulu Nellore">Sri Potti Sriramulu Nellore</option>
                    <option value="Sri Sathya Sai">Sri Sathya Sai</option>
                    <option value="Srikakulam">Srikakulam</option>
                    <option value="Tirupati">Tirupati</option>
                    <option value="Visakhapatnam">Visakhapatnam</option>
                    <option value="Vizianagaram">Vizianagaram</option>
                    <option value="West Godavari">West Godavari</option>
                    <option value="YSR Kadapa">YSR Kadapa</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="escalated">Escalated</option>
                </select>
                <input placeholder="Filter by Mandal…" value={filterMandal} onChange={e => setFilterMandal(e.target.value)} style={{ ...inputStyle, minWidth: '140px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    <span>From:</span>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
                    <span>To:</span>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
                </div>
                {(filterStatus || filterMandal || filterDistrict || filterFrom || filterTo) && (
                    <button onClick={() => { setFilterStatus(''); setFilterMandal(''); setFilterDistrict(''); setFilterFrom(''); setFilterTo(''); }}
                        style={{ ...inputStyle, backgroundColor: '#fff', cursor: 'pointer', color: '#6b7280' }}>✕ Clear</button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <div className="skeleton" style={{ height: '14px', width: '40%', marginBottom: '0.5rem' }} />
                                <div className="skeleton" style={{ height: '11px', width: '60%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</span>
                    <p style={{ fontWeight: '700', color: '#15803d', margin: 0, fontSize: '1rem' }}>No complaints received</p>
                    <p style={{ color: '#9ca3af', margin: '0.375rem 0 0', fontSize: '0.8125rem' }}>
                        {filterStatus || filterMandal || filterFrom || filterTo
                            ? 'No complaints match the current filters.'
                            : 'No complaints received in the selected period. System operating normally.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.25rem' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
                    {filtered.map((c) => (
                        <div key={c.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                                    <h3 style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '0.9375rem' }}>{c.complaint_type}</h3>
                                    {statusBadge(c.status)}
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.25rem' }}>Shop: {c.shop_id} | Ref: {c.id} {c.mandal ? `| Mandal: ${c.mandal}` : ''}</p>
                                <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>{c.description}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                {c.status !== 'resolved' && (
                                    <>
                                        <button disabled={processingIds.has(c.id)}
                                            onClick={() => { const insp = prompt('Enter Inspector ID:'); if (insp) handleAssign(c.id, insp); }}
                                            style={{ padding: '0.375rem 0.75rem', backgroundColor: processingIds.has(c.id) ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: processingIds.has(c.id) ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: '600' }}>
                                            {processingIds.has(c.id) ? 'Working…' : 'Assign'}
                                        </button>
                                        <button disabled={processingIds.has(c.id)}
                                            onClick={() => { if (c.status === 'escalated' && !window.confirm('Escalated complaint — confirm override authority?')) return; const note = prompt('Resolution Notes:'); if (note) handleResolve(c.id, note); }}
                                            style={{ padding: '0.375rem 0.75rem', backgroundColor: processingIds.has(c.id) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: processingIds.has(c.id) ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: '600' }}>
                                            {processingIds.has(c.id) ? 'Working…' : 'Resolve'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
