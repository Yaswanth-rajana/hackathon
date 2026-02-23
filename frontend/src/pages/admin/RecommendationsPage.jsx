import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function RecommendationsPage() {
    const { token } = useAuth();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState(new Set());

    // Full IST timestamp — deterministic, not system-timezone-dependent
    const evaluationTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/recommendations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setRecommendations(await res.json() || []);
        } catch (err) {
            console.error('Failed to fetch recommendations:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRecommendations(); }, []);

    const handleScheduleAudit = async (shop_id, priority) => {
        const date = prompt('Scheduled Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (!date) return;

        setProcessingIds(prev => new Set(prev).add(shop_id));
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/admin/audits/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ shop_id, scheduled_date: new Date(date).toISOString(), priority, notes: 'AI Recommended Audit' })
            });
            if (res.ok) { alert('Audit scheduled from recommendation!'); fetchRecommendations(); }
            else throw new Error('Failed to schedule audit');
        } catch { alert('Failed to schedule audit.'); }
        finally {
            setProcessingIds(prev => { const n = new Set(prev); n.delete(shop_id); return n; });
        }
    };

    return (
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ✨ AI Audit Recommendations
                </h2>
                {/* Metadata band */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.2rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                        Last evaluated: <strong style={{ color: '#374151' }}>{evaluationTimestamp}</strong>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.2rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #fde68a' }}>
                        Risk threshold applied: <strong>≥ 85</strong>
                    </span>
                </div>
                <p style={{ color: '#6b7280', margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
                    Automated scheduling recommendations based on compound risk indicators and behavioral anomalies.
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ padding: '1rem', border: '1px solid #fde68a', borderRadius: '0.5rem', backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div className="skeleton" style={{ height: '14px', width: '35%' }} />
                                <div className="skeleton" style={{ height: '11px', width: '60%' }} />
                            </div>
                            <div className="skeleton" style={{ height: '32px', width: '120px', alignSelf: 'center' }} />
                        </div>
                    ))}
                </div>
            ) : recommendations.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', textAlign: 'center', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛡️</span>
                    <p style={{ fontWeight: '700', color: '#15803d', margin: 0, fontSize: '1rem' }}>No high-priority recommendations</p>
                    <p style={{ color: '#4ade80', margin: '0.375rem 0 0', fontSize: '0.875rem' }}>Sector is stable. No shops exceed the risk threshold of ≥ 85.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recommendations.map((r, idx) => (
                        <div key={idx} style={{ padding: '1rem', border: '1px solid #fed7aa', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffbeb', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontWeight: '700', color: '#92400e', margin: '0 0 0.375rem', fontSize: '0.9375rem' }}>
                                    Shop {r.shop_id} — {r.shop_name}
                                </h3>
                                <p style={{ fontSize: '0.8125rem', color: '#b45309', margin: '0 0 0.125rem' }}><strong>Priority:</strong> {r.priority?.toUpperCase()}</p>
                                <p style={{ fontSize: '0.8125rem', color: '#78350f', margin: '0 0 0.125rem' }}><strong>Triggers:</strong> {r.reason}</p>
                                <p style={{ fontSize: '0.8125rem', color: '#92400e', margin: 0, fontWeight: '700' }}>Confidence Score: {r.confidence}%</p>
                            </div>
                            <button disabled={processingIds.has(r.shop_id)} onClick={() => handleScheduleAudit(r.shop_id, r.priority)}
                                style={{ padding: '0.5rem 1rem', backgroundColor: processingIds.has(r.shop_id) ? '#fcd34d' : '#f59e0b', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: processingIds.has(r.shop_id) ? 'not-allowed' : 'pointer', fontWeight: '700', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                                {processingIds.has(r.shop_id) ? 'Scheduling…' : 'Schedule Audit'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
