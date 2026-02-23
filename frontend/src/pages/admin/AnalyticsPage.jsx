import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
    LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import { SEVERITY_CHART_COLORS } from '../../utils/severityMapper';

export default function AnalyticsPage() {
    const { token } = useAuth();

    const [fraudDist, setFraudDist] = useState(null);
    const [monthlyTrend, setMonthlyTrend] = useState(null);
    const [anomalyTrend, setAnomalyTrend] = useState(null);
    const [district, setDistrict] = useState('');
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAnalytics = async () => {
        try {
            setLoading(true); setError(null);
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const headers = { 'Authorization': `Bearer ${token}` };
            const distQuery = district ? `?district=${district}` : '';
            const anomQuery = district ? `?district=${district}&days=${days}` : `?days=${days}`;

            const [resDist, resTrend, resAnom] = await Promise.all([
                fetch(`${baseUrl}/api/admin/analytics/fraud-distribution${distQuery}`, { headers }),
                fetch(`${baseUrl}/api/admin/analytics/monthly-trend${distQuery}`, { headers }),
                fetch(`${baseUrl}/api/admin/analytics/anomaly-trend${anomQuery}`, { headers })
            ]);

            if (!resDist.ok || !resTrend.ok || !resAnom.ok) throw new Error('Failed to fetch analytics');
            setFraudDist(await resDist.json());
            setMonthlyTrend(await resTrend.json());
            setAnomalyTrend(await resAnom.json());
        } catch (err) {
            setError('Could not load analytics data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnalytics(); }, [district, days]);

    const formatPieData = (distribution) => {
        if (!distribution) return [];
        return Object.entries(distribution).map(([name, value]) => ({ name, value }));
    };

    const filteredTrend = monthlyTrend?.trends ? monthlyTrend.trends.slice(-12) : [];

    // Dynamic confidence: min(100, anomaly_count × 5)
    const totalAnomalyCount = anomalyTrend?.top_recurring_anomalies
        ?.reduce((sum, a) => sum + (a.count || 0), 0) ?? 0;
    const confidenceScore = Math.min(100, totalAnomalyCount * 5);

    const cardStyle = {
        border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem',
        backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    };

    return (
        <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>📊 Deep Analytics</h2>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>District-level anomaly intelligence and fraud pattern analysis</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select value={district} onChange={(e) => setDistrict(e.target.value)}
                        style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }}>
                        <option value="">All Districts</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Ranga Reddy">Ranga Reddy</option>
                        <option value="Medchal">Medchal</option>
                    </select>
                </div>
            </div>

            {error && (
                <div style={{ padding: '0.875rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    ⚠️ {error} <button onClick={fetchAnalytics} style={{ marginLeft: '0.75rem', textDecoration: 'underline', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.875rem' }}>Retry</button>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '300px', borderRadius: '0.5rem' }} />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

                    {/* Fraud Distribution Donut */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Fraud Type Distribution</h3>
                        {fraudDist?.total_anomalies === 0 || !fraudDist?.distribution ? (
                            <div style={{ height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d1d5db', borderRadius: '0.5rem' }}>
                                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</span>
                                <p style={{ color: '#6b7280', margin: 0, fontWeight: '600' }}>No anomalies this period</p>
                                <p style={{ color: '#9ca3af', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Distribution will populate when data arrives.</p>
                            </div>
                        ) : (
                            <div style={{ height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={formatPieData(fraudDist.distribution)} cx="50%" cy="50%"
                                            innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {formatPieData(fraudDist.distribution).map((_, index) => (
                                                <Cell key={index} fill={SEVERITY_CHART_COLORS[index % SEVERITY_CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>Total Anomalies: <strong>{fraudDist?.total_anomalies ?? 0}</strong></p>
                    </div>

                    {/* Historical Trend */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Historical Fraud Trend (12 Months)</h3>
                        {filteredTrend.length === 0 ? (
                            <div style={{ height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #d1d5db', borderRadius: '0.5rem', backgroundColor: '#fafafa' }}>
                                {/* Sketch-like chart skeleton */}
                                <svg width="80%" height="60%" viewBox="0 0 200 80" style={{ opacity: 0.25 }}>
                                    <polyline points="0,60 30,40 60,50 90,20 120,35 150,15 180,25 200,10"
                                        fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 2" />
                                    <line x1="0" y1="70" x2="200" y2="70" stroke="#d1d5db" strokeWidth="1" />
                                </svg>
                                <p style={{ color: '#6b7280', margin: '0.5rem 0 0', fontWeight: '600', fontSize: '0.875rem' }}>No trend data available yet</p>
                                <p style={{ color: '#9ca3af', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>Trend will appear after historical data accumulates.</p>
                            </div>
                        ) : (
                            <div style={{ height: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={filteredTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <Line type="monotone" dataKey="cases" stroke={SEVERITY_CHART_COLORS[0]} strokeWidth={2} name="Anomalies" />
                                        <Line type="monotone" dataKey="avg_risk" stroke={SEVERITY_CHART_COLORS[1]} strokeWidth={2} name="Avg Risk" />
                                        <CartesianGrid stroke="#f3f4f6" strokeDasharray="5 5" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <RechartsTooltip />
                                        <Legend />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Anomaly Intelligence – full width */}
                    <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', margin: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Anomaly Intelligence</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {/* Metadata band */}
                                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280', backgroundColor: '#f9fafb', padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}>
                                    <span>Confidence Score: <strong style={{ color: '#374151' }}>{confidenceScore}%</strong></span>
                                    <span style={{ color: '#d1d5db' }}>|</span>
                                    <span>Data Window: <strong style={{ color: '#374151' }}>Last {days} Days</strong></span>
                                </div>
                                <select value={days} onChange={(e) => setDays(Number(e.target.value))}
                                    style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8125rem' }}>
                                    <option value={7}>Last 7 Days</option>
                                    <option value={30}>Last 30 Days</option>
                                    <option value={90}>Last 90 Days</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Top Recurring Types</h4>
                                {!anomalyTrend?.top_recurring_anomalies?.length ? (
                                    <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No anomaly types found for this window.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {anomalyTrend.top_recurring_anomalies.map((anom, idx) => (
                                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                                                <span style={{ fontWeight: '500', color: '#1f2937' }}>{anom.anomaly_type?.replace(/_/g, ' ')}</span>
                                                <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold' }}>{anom.count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Repeat Offending Shops</h4>
                                {!anomalyTrend?.repeat_offenders?.length ? (
                                    <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No repeat offenders in this window.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {anomalyTrend.repeat_offenders.map((shop, idx) => (
                                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' }}>
                                                <span style={{ fontWeight: '500', color: '#1f2937' }}>Shop {shop.shop_id}</span>
                                                <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold' }}>{shop.violation_count} violations</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
