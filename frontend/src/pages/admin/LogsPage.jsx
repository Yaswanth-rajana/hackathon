import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LogsPage() {
    const { token } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterFrom, setFilterFrom] = useState('');
    const [filterTo, setFilterTo] = useState('');
    const [filterAction, setFilterAction] = useState('');

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/logs?limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    // Client-side filtering
    const filtered = logs.filter(l => {
        if (filterFrom && new Date(l.timestamp) < new Date(filterFrom)) return false;
        if (filterTo && new Date(l.timestamp) > new Date(filterTo + 'T23:59:59')) return false;
        if (filterAction && !(l.action || '').toLowerCase().includes(filterAction.toLowerCase())) return false;
        return true;
    });

    // Unique action types for dropdown
    const actionTypes = [...new Set(logs.map(l => l.action).filter(Boolean))];

    // CSV export with safe escaping (UTF-8 BOM for Excel compatibility)
    const handleExportCSV = () => {
        const headers = ['Time', 'Admin ID', 'Action', 'Target Type', 'Target ID', 'IP Address'];
        const rows = filtered.map(l => [
            new Date(l.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            l.admin_id,
            l.action,
            l.target_type,
            l.target_id || '',
            l.ip_address || 'unknown'
        ].map(v => JSON.stringify(v ?? '')));

        const csvContent = '\uFEFF' + [headers.map(h => JSON.stringify(h)), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
    };

    const inputStyle = { padding: '0.4rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8125rem', outline: 'none' };

    return (
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>📜 System Activity Logs</h2>
                    <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Full accountability trail for all admin actions</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={fetchLogs} style={{ padding: '0.4rem 0.875rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer', color: '#374151', fontWeight: '600' }}>↻ Refresh</button>
                    <button onClick={handleExportCSV} disabled={filtered.length === 0}
                        style={{ padding: '0.4rem 0.875rem', backgroundColor: filtered.length === 0 ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.8125rem', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontWeight: '700' }}>
                        ⬇ Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '0.875rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    <span>From:</span>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
                    <span>To:</span>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
                </div>
                <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={inputStyle}>
                    <option value="">All Action Types</option>
                    {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {(filterFrom || filterTo || filterAction) && (
                    <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterAction(''); }}
                        style={{ ...inputStyle, backgroundColor: '#fff', cursor: 'pointer', color: '#6b7280' }}>✕ Clear</button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#9ca3af' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                            <tr>
                                {['Time', 'Admin ID', 'Action', 'Target Type', 'Target ID', 'IP Address'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(6)].map((__, j) => (
                                        <td key={j} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' }}>
                                            <div className="skeleton" style={{ height: '12px', width: j === 2 ? '120px' : '70px' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</span>
                    <p style={{ fontWeight: '700', color: '#374151', margin: 0 }}>No activity logs found</p>
                    <p style={{ color: '#9ca3af', margin: '0.375rem 0 0', fontSize: '0.8125rem' }}>
                        {filterFrom || filterTo || filterAction ? 'No logs match the current filters.' : 'No activity logs for selected time range.'}
                    </p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                        <thead style={{ backgroundColor: '#f9fafb', color: '#374151' }}>
                            <tr>
                                {['Time', 'Admin ID', 'Action', 'Target Type', 'Target ID', 'IP Address'].map(h => (
                                    <th key={h} style={{ padding: '0.625rem 1rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: '700' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((l) => (
                                <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }} className="hover:bg-gray-50">
                                    <td style={{ padding: '0.625rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                        {new Date(l.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                    </td>
                                    <td style={{ padding: '0.625rem 1rem', fontWeight: '600', color: '#111827' }}>{l.admin_id}</td>
                                    <td style={{ padding: '0.625rem 1rem', color: '#047857', fontWeight: '600' }}>{l.action}</td>
                                    <td style={{ padding: '0.625rem 1rem', color: '#4b5563' }}>{l.target_type}</td>
                                    <td style={{ padding: '0.625rem 1rem', color: '#4b5563' }}>{l.target_id || '—'}</td>
                                    <td style={{ padding: '0.625rem 1rem', color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{l.ip_address || 'unknown'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
