import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

export default function ForecastPage() {
    const { token } = useAuth();

    const [district, setDistrict] = useState('');
    const [demandData, setDemandData] = useState(null);
    const [riskData, setRiskData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchForecasts = async () => {
        try {
            setLoading(true); setError(null);
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const headers = { 'Authorization': `Bearer ${token}` };
            const query = district ? `?district=${district}` : '';

            const [resDemand, resRisk] = await Promise.all([
                fetch(`${baseUrl}/api/admin/forecast/demand${query}`, { headers }),
                fetch(`${baseUrl}/api/admin/forecast/risk${query}`, { headers })
            ]);

            if (!resDemand.ok || !resRisk.ok) throw new Error('Failed to fetch forecast data');
            setDemandData(await resDemand.json());
            setRiskData(await resRisk.json());
        } catch (err) {
            setError('Could not load forecast modules.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchForecasts(); }, [district]);

    const getCombinedChartData = () => {
        if (!demandData || demandData.status === 'insufficient_data') return [];
        const combined = [];
        demandData.historical?.forEach(h => combined.push({ month: h.month, historical_demand: h.demand, projected_demand: null }));
        demandData.forecast?.forEach(f => combined.push({ month: f.month, historical_demand: null, projected_demand: f.projected_demand }));
        return combined;
    };

    const determineRiskColor = (level) => {
        if (level === 'CRITICAL') return '#ef4444';
        if (level === 'HIGH') return '#f97316';
        return '#10b981';
    };

    const isInsufficientData = demandData?.status === 'insufficient_data';
    const chartData = getCombinedChartData();

    const cardStyle = {
        border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem',
        backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    };

    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>🔮 Predictive Intelligence & Forecasts</h2>
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0 0' }}>Demand projection and fraud risk trajectory analysis</p>
                </div>
                <select value={district} onChange={(e) => setDistrict(e.target.value)}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.875rem' }}>
                    <option value="">All Regions</option>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: '350px' }} />)}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

                    {/* Demand Forecast Chart */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', margin: '0 0 0.375rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Ration Demand Projection (Next 3 Months)</h3>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>Based on 6-month moving average with seasonal multipliers.</p>

                        {isInsufficientData ? (
                            <div style={{ height: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #d1d5db', borderRadius: '0.5rem', backgroundColor: '#fafafa' }}>
                                <svg width="70%" height="55%" viewBox="0 0 200 80" style={{ opacity: 0.2 }}>
                                    <polyline points="0,60 50,40 100,50 150,20 200,30" fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 3" />
                                    <line x1="0" y1="70" x2="200" y2="70" stroke="#d1d5db" strokeWidth="1" />
                                </svg>
                                <p style={{ fontWeight: '600', color: '#374151', margin: '0.5rem 0 0', fontSize: '0.875rem' }}>Insufficient historical data</p>
                                <p style={{ color: '#9ca3af', margin: '0.25rem 0 0', fontSize: '0.75rem' }}>{demandData?.message || 'More data needed for projection.'}</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ height: '250px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <RechartsTooltip />
                                            <Area type="monotone" dataKey="historical_demand" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHistorical)" name="Historical" />
                                            <Area type="monotone" dataKey="projected_demand" stroke="#8b5cf6" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorProjected)" name="Projected" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', borderLeft: '4px solid #3b82f6' }}>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#1e3a8a' }}><strong>Insight:</strong> {demandData?.trend_analysis}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fraud Risk Trajectory */}
                    <div style={cardStyle}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', margin: '0 0 0.375rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Fraud Risk Trajectory (30-Day Outlook)</h3>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 1rem 0' }}>Emerging risk assessment based on anomaly growth velocity.</p>

                        {riskData && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 0.375rem' }}>Emerging Risk Level</p>
                                        {isInsufficientData ? (
                                            <>
                                                <h4 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#6b7280' }}>N/A</h4>
                                                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>Forecast Confidence: LOW<br /><em>Insufficient historical baseline</em></p>
                                            </>
                                        ) : (
                                            <h4 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, color: determineRiskColor(riskData.risk_assessment) }}>
                                                {riskData.risk_assessment}
                                            </h4>
                                        )}
                                    </div>
                                    {!isInsufficientData && (
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 0.375rem' }}>Growth Velocity</p>
                                            <span style={{
                                                display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: '700',
                                                backgroundColor: riskData.growth_rate_percent > 0 ? '#fee2e2' : '#d1fae5',
                                                color: riskData.growth_rate_percent > 0 ? '#b91c1c' : '#059669',
                                                fontSize: '0.875rem',
                                            }}>
                                                {riskData.growth_rate_percent > 0 ? '+' : ''}{riskData.growth_rate_percent}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {!isInsufficientData && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                                        {[
                                            { label: 'PREV 30 DAYS', value: riskData.previous_30_days },
                                            { label: 'LAST 30 DAYS', value: riskData.current_30_days },
                                            { label: 'NEXT 30 (PROJ)', value: riskData.projected_next_30_days, highlight: true }
                                        ].map((col) => (
                                            <div key={col.label} style={{
                                                padding: '0.875rem', backgroundColor: col.highlight ? `${determineRiskColor(riskData.risk_assessment)}12` : '#ffffff',
                                                border: `1px solid ${col.highlight ? determineRiskColor(riskData.risk_assessment) + '40' : '#e5e7eb'}`, borderRadius: '0.5rem',
                                            }}>
                                                <p style={{ fontSize: '0.65rem', color: '#6b7280', margin: '0 0 0.25rem', fontWeight: '700', textTransform: 'uppercase' }}>{col.label}</p>
                                                <p style={{ fontSize: '1.25rem', fontWeight: '800', color: col.highlight ? determineRiskColor(riskData.risk_assessment) : '#374151', margin: 0 }}>{col.value}</p>
                                                <p style={{ fontSize: '0.65rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>anomalies</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!isInsufficientData && riskData.risk_assessment === 'CRITICAL' && (
                                    <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', color: '#b91c1c', fontSize: '0.875rem' }}>
                                        <p style={{ margin: '0 0 0.75rem', fontWeight: '700' }}>⚠️ Action Required</p>
                                        <p style={{ margin: '0 0 1rem', color: '#7f1d1d' }}>Fraud velocity is accelerating rapidly. Immediate task force deployment recommended for identified repeat offender shops.</p>
                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => {
                                                    const date = new Date().toISOString().split('T')[0];
                                                    alert(`Schedule Immediate Audit\nDate: ${date}\nPriority: critical\n\nNavigate to Audits page to confirm.`);
                                                }}
                                                style={{ padding: '0.5rem 1rem', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.8125rem' }}>
                                                🚨 Schedule Immediate Audit
                                            </button>
                                            <a href="/admin" style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '0.375rem', fontWeight: '700', fontSize: '0.8125rem', textDecoration: 'none', display: 'inline-block' }}>
                                                View Contributing Shops →
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
