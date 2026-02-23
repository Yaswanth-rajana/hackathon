import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

export default function PerformancePage() {
    const { token } = useAuth();

    const [compliance, setCompliance] = useState(null);
    const [resolution, setResolution] = useState(null);
    const [district, setDistrict] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPerformance = async () => {
        try {
            setLoading(true); setError(null);
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const headers = { 'Authorization': `Bearer ${token}` };
            const query = district ? `?district=${district}` : '';

            const [resComp, resRes] = await Promise.all([
                fetch(`${baseUrl}/api/admin/analytics/compliance-by-mandal${query}`, { headers }),
                fetch(`${baseUrl}/api/admin/analytics/resolution-metrics${query}`, { headers })
            ]);

            if (!resComp.ok || !resRes.ok) throw new Error('Failed to fetch performance data');

            const compData = await resComp.json();
            const resData = await resRes.json();

            if (compData.compliance_by_mandal) {
                compData.compliance_by_mandal.sort((a, b) => b.compliance_score - a.compliance_score);
            }

            setCompliance(compData);
            setResolution(resData);
        } catch (err) {
            setError('Could not load performance metrics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPerformance(); }, [district]);

    const renderCustomBarLabel = ({ x, y, width, value }) => (
        <text x={x + width / 2} y={y - 5} fill="#6b7280" textAnchor="middle" dy={-4} fontSize={11}>{`${value}%`}</text>
    );

    const cardStyle = {
        border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem',
        backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    };

    const metricCard = (label, value, accent) => (
        <div style={{ padding: '1.25rem', borderRadius: '0.5rem', border: `1px solid ${accent.border}`, backgroundColor: accent.bg, minHeight: '100px' }}>
            <p style={{ fontSize: '0.7rem', color: accent.labelColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>{label}</p>
            <p style={{ fontSize: '1.875rem', fontWeight: '800', color: accent.valueColor, margin: 0 }}>{value}</p>
            {/* Trend: only shown when comparison data is available from backend */}
            {accent.trend !== undefined && (
                <p style={{ fontSize: '0.75rem', color: accent.trend >= 0 ? '#dc2626' : '#16a34a', marginTop: '0.375rem', fontWeight: '600' }}>
                    {accent.trend >= 0 ? `↑ +${accent.trend}%` : `↓ ${accent.trend}%`} vs last period
                </p>
            )}
            {accent.trend === undefined && (
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.375rem' }}>No comparative data available.</p>
            )}
        </div>
    );

    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>🗂 Performance Benchmarking</h2>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0 0' }}>Mandal compliance scores and complaint resolution metrics</p>
                </div>
                <select value={district} onChange={(e) => setDistrict(e.target.value)}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }}>
                    <option value="">All Districts</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Ranga Reddy">Ranga Reddy</option>
                    <option value="Medchal">Medchal</option>
                </select>
            </div>

            {error && (
                <div style={{ padding: '0.875rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '100px' }} />)}
                    </div>
                    <div className="skeleton" style={{ height: '350px' }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Resolution metrics — trend only when previous data exists from API */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        {metricCard('Avg Resolution Time',
                            resolution?.avg_resolution_hours ? `${resolution.avg_resolution_hours} hrs` : 'N/A',
                            { bg: '#f0fdf4', border: '#bbf7d0', labelColor: '#166534', valueColor: '#15803d', trend: resolution?.resolution_trend_pct }
                        )}
                        {metricCard('Complaint Backlog',
                            resolution?.backlog_size ?? 0,
                            { bg: '#fef2f2', border: '#fecaca', labelColor: '#991b1b', valueColor: '#dc2626', trend: resolution?.backlog_trend_pct }
                        )}
                        {metricCard('Fastest Mandal',
                            resolution?.fastest_resolving_mandal || 'N/A',
                            { bg: '#eff6ff', border: '#bfdbfe', labelColor: '#1e40af', valueColor: '#1d4ed8' }
                        )}
                        {metricCard('Slowest Mandal',
                            resolution?.slowest_resolving_mandal || 'N/A',
                            { bg: '#fefce8', border: '#fef08a', labelColor: '#854d0e', valueColor: '#a16207' }
                        )}
                    </div>

                    {/* Compliance Bar Chart */}
                    <div style={{ ...cardStyle }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', marginBottom: '1.25rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Mandal Compliance Scores</h3>
                        {!compliance?.compliance_by_mandal?.length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1rem' }}>
                                {/* Bar chart skeleton */}
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '100px', marginBottom: '1rem', opacity: 0.3 }}>
                                    {[60, 80, 45, 90, 55, 70].map((h, i) => (
                                        <div key={i} style={{ width: '24px', height: `${h}%`, backgroundColor: '#d1d5db', borderRadius: '4px 4px 0 0' }} />
                                    ))}
                                </div>
                                <p style={{ fontWeight: '600', color: '#374151', margin: 0 }}>Compliance data pending</p>
                                <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem', textAlign: 'center' }}>Compliance data will populate once risk scoring completes.</p>
                            </div>
                        ) : (
                            <div style={{ height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={compliance.compliance_by_mandal} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="mandal" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={70} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                        <Bar dataKey="compliance_score" fill="#10b981" radius={[4, 4, 0, 0]} barSize={36} label={renderCustomBarLabel} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
