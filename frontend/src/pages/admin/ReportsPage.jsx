import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ReportsPage() {
    const { token } = useAuth();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    // Monthly report form
    const [monthlyDistrict, setMonthlyDistrict] = useState('');
    const [monthlyMonth, setMonthlyMonth] = useState('');
    const [monthlyLoading, setMonthlyLoading] = useState(false);

    // Shop report form
    const [shopId, setShopId] = useState('');
    const [shopLoading, setShopLoading] = useState(false);

    // Scheduled reports
    const [scheduledReports, setScheduledReports] = useState([]);
    const [schedLoading, setSchedLoading] = useState(true);

    const fetchScheduled = async () => {
        try {
            setSchedLoading(true);
            const res = await fetch(`${baseUrl}/api/admin/schedule`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setScheduledReports(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch scheduled reports:', err);
        } finally {
            setSchedLoading(false);
        }
    };

    useEffect(() => { fetchScheduled(); }, []);

    const handleMonthlyDownload = async () => {
        if (!monthlyDistrict || !monthlyMonth) return;
        setMonthlyLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/admin/reports/monthly`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ district: monthlyDistrict, month: monthlyMonth })
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `Monthly_Report_${monthlyDistrict}_${monthlyMonth}.pdf`;
                document.body.appendChild(a); a.click();
                URL.revokeObjectURL(url); document.body.removeChild(a);
            } else { alert('Report generation failed. Please try again.'); }
        } catch (err) { alert('Network error. Please check your connection.'); }
        finally { setMonthlyLoading(false); }
    };

    const handleShopDownload = async () => {
        if (!shopId.trim()) return;
        setShopLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/admin/reports/shop/${shopId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `Shop_Report_${shopId}.pdf`;
                document.body.appendChild(a); a.click();
                URL.revokeObjectURL(url); document.body.removeChild(a);
            } else { alert('Shop report generation failed.'); }
        } catch (err) { alert('Network error. Please check your connection.'); }
        finally { setShopLoading(false); }
    };

    const statusBadge = (status) => {
        const map = { active: { bg: '#dcfce7', color: '#166534' }, paused: { bg: '#f3f4f6', color: '#374151' }, error: { bg: '#fee2e2', color: '#991b1b' } };
        const s = map[status] || { bg: '#f3f4f6', color: '#374151' };
        return <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: s.bg, color: s.color }}>{status?.toUpperCase()}</span>;
    };

    const cardStyle = {
        border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem',
        backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '1.5rem',
    };

    const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.375rem' };
    const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem', outline: 'none' };

    const isMonthlyValid = monthlyDistrict.trim() && monthlyMonth.trim();
    const isShopValid = shopId.trim().length > 0;

    return (
        <div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>📁 Report Generation Center</h2>
                <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Generate on-demand compliance and audit reports</p>
            </div>

            {/* Monthly Report */}
            <div style={cardStyle}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 1rem' }}>Monthly Compliance Report</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={labelStyle}>District <span style={{ color: '#ef4444' }}>*</span></label>
                        <select value={monthlyDistrict} onChange={e => setMonthlyDistrict(e.target.value)} style={inputStyle}>
                            <option value="">Select district…</option>
                            <option value="Hyderabad">Hyderabad</option>
                            <option value="Ranga Reddy">Ranga Reddy</option>
                            <option value="Medchal">Medchal</option>
                            <option value="Visakhapatnam">Visakhapatnam</option>
                            <option value="Guntur">Guntur</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Month <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="month" value={monthlyMonth} onChange={e => setMonthlyMonth(e.target.value)} style={inputStyle} />
                    </div>
                </div>
                <button
                    onClick={handleMonthlyDownload}
                    disabled={!isMonthlyValid || monthlyLoading}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1.25rem', backgroundColor: isMonthlyValid && !monthlyLoading ? '#1d4ed8' : '#9ca3af',
                        color: 'white', border: 'none', borderRadius: '0.375rem',
                        cursor: isMonthlyValid && !monthlyLoading ? 'pointer' : 'not-allowed',
                        fontWeight: '700', fontSize: '0.875rem', transition: 'background 0.2s',
                    }}
                >
                    {monthlyLoading
                        ? <><span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Generating…</>
                        : '⬇ Download PDF'}
                </button>
                {!isMonthlyValid && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>Please select a district and month to enable download.</p>}
            </div>

            {/* Shop Report */}
            <div style={cardStyle}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 1rem' }}>Individual Shop Report</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={labelStyle}>Shop ID <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" placeholder="e.g. SH001234" value={shopId} onChange={e => setShopId(e.target.value)} style={inputStyle} />
                    </div>
                </div>
                <button
                    onClick={handleShopDownload}
                    disabled={!isShopValid || shopLoading}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1.25rem', backgroundColor: isShopValid && !shopLoading ? '#1d4ed8' : '#9ca3af',
                        color: 'white', border: 'none', borderRadius: '0.375rem',
                        cursor: isShopValid && !shopLoading ? 'pointer' : 'not-allowed',
                        fontWeight: '700', fontSize: '0.875rem',
                    }}
                >
                    {shopLoading
                        ? <><span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Generating…</>
                        : '⬇ Download Shop Report'}
                </button>
                {!isShopValid && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>Please enter a Shop ID to enable download.</p>}
            </div>

            {/* Scheduled Reports Table */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>Scheduled Reports</h3>
                    <button onClick={fetchScheduled} style={{ fontSize: '0.8rem', color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer' }}>↻ Refresh</button>
                </div>

                {schedLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '40px' }} />)}
                    </div>
                ) : scheduledReports.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: '0.5rem' }}>
                        <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.875rem' }}>No scheduled reports configured.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead style={{ backgroundColor: '#f9fafb', color: '#374151' }}>
                                <tr>
                                    {['District', 'Type', 'Frequency', 'Next Run', 'Status', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '0.625rem 1rem', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: '700' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scheduledReports.map((r) => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.625rem 1rem', fontWeight: '600', color: '#111827' }}>{r.district}</td>
                                        <td style={{ padding: '0.625rem 1rem', color: '#4b5563' }}>{r.report_type}</td>
                                        <td style={{ padding: '0.625rem 1rem', color: '#4b5563' }}>{r.frequency}</td>
                                        <td style={{ padding: '0.625rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                            {r.next_run ? new Date(r.next_run).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                                        </td>
                                        <td style={{ padding: '0.625rem 1rem' }}>{statusBadge(r.status)}</td>
                                        <td style={{ padding: '0.625rem 1rem' }}>
                                            <button style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                                                Disable
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
