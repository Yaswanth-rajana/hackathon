import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuditsPage() {
    const { token } = useAuth();
    const [audits, setAudits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState(new Set());

    const fetchAudits = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/audits?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAudits(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch audits:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudits(); }, []);

    const handleSchedule = async () => {
        const shop_id = prompt('Shop ID:');
        if (!shop_id) return;
        const date = prompt('Scheduled Date (YYYY-MM-DD):');
        if (!date) return;
        const priority = prompt('Priority (low, medium, high):', 'medium');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/audits/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ shop_id, scheduled_date: new Date(date).toISOString(), priority, notes: 'Scheduled manually' })
            });
            if (res.ok) fetchAudits();
            else alert('Failed to schedule audit');
        } catch (err) { console.error(err); }
    };

    const handleComplete = async (id) => {
        const findings = prompt('Enter findings (use "fraud" or "mismatch" to trigger risk increase):');
        if (!findings) return;
        const originalAudits = [...audits];
        setAudits(audits.map(a => a.id === id ? { ...a, status: 'completed', findings } : a));
        setProcessingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/audits/${id}/complete`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ findings })
            });
            if (res.ok) {
                const data = await res.json();
                alert(`Audit completed. New Shop Risk Score: ${data.new_risk_score}`);
                fetchAudits();
            } else { throw new Error('Server error'); }
        } catch {
            alert('Failed to complete. Rolling back.');
            setAudits(originalAudits);
        } finally {
            setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    const priorityBadge = (priority) => {
        const map = { high: '#b91c1c//#fee2e2', medium: '#d97706//#fef3c7', low: '#15803d//#dcfce7' };
        const [color, bg] = (map[priority] || '#374151//#f3f4f6').split('//');
        return <span style={{ padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: bg, color }}>{priority?.toUpperCase()}</span>;
    };

    return (
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>🔍 Audit Scheduling & Tracking</h2>
                    <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Proactive field audit governance and compliance verification</p>
                </div>
                <button onClick={handleSchedule} style={{
                    padding: '0.5rem 1.25rem', backgroundColor: '#111827', color: 'white',
                    borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}>
                    + Schedule Audit
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ padding: '1rem', border: '1px solid #f3f4f6', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div className="skeleton" style={{ height: '14px', width: '35%' }} />
                                <div className="skeleton" style={{ height: '11px', width: '50%' }} />
                            </div>
                            <div className="skeleton" style={{ height: '32px', width: '100px', alignSelf: 'center' }} />
                        </div>
                    ))}
                </div>
            ) : audits.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</span>
                    <h3 style={{ fontWeight: '800', color: '#111827', margin: '0 0 0.5rem', fontSize: '1.125rem' }}>No audits scheduled</h3>
                    <p style={{ color: '#6b7280', margin: '0 0 1.5rem', fontSize: '0.875rem' }}>Start proactive governance today.</p>
                    <button onClick={handleSchedule} style={{
                        padding: '0.75rem 2rem', backgroundColor: '#1d4ed8', color: 'white',
                        borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                        fontWeight: '700', fontSize: '0.9375rem', boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
                        letterSpacing: '0.01em',
                    }}>
                        📋 Schedule Your First Audit
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {audits.map((a) => (
                        <div key={a.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <div>
                                <h3 style={{ fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.375rem' }}>
                                    Audit #{a.id} — Shop {a.shop_id}
                                    {priorityBadge(a.priority)}
                                </h3>
                                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.125rem' }}>Scheduled: {new Date(a.scheduled_date).toLocaleDateString()}</p>
                                {a.status === 'completed' && <p style={{ fontSize: '0.8125rem', color: '#374151', fontStyle: 'italic', margin: 0 }}>Findings: {a.findings}</p>}
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                {a.status === 'scheduled' ? (
                                    <button disabled={processingIds.has(a.id)} onClick={() => handleComplete(a.id)}
                                        style={{ padding: '0.5rem 1rem', backgroundColor: processingIds.has(a.id) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: processingIds.has(a.id) ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.875rem' }}>
                                        {processingIds.has(a.id) ? 'Working…' : 'Mark Complete'}
                                    </button>
                                ) : (
                                    <span style={{ color: '#059669', fontWeight: '700', fontSize: '0.875rem' }}>✓ COMPLETED</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
