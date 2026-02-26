import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/api';
import toast from 'react-hot-toast';
import { TrendingUp, Bell, Clock, ShieldAlert } from 'lucide-react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { useAdminWebSocket } from '../../../context/WebSocketContext';

const PredictiveTrendsPage = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [recommendationMeta, setRecommendationMeta] = useState(null);
    const [committing, setCommitting] = useState(false);
    const { lastMessage } = useAdminWebSocket();

    useEffect(() => {
        fetchForecast();
        fetchRecommendations();
    }, []);

    useEffect(() => {
        if (lastMessage?.type === 'ML_ALERT' && lastMessage.shop_id === 'DEMO_001') {
            fetchForecast();
            fetchRecommendations();
        }
    }, [lastMessage]);

    const fetchForecast = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/ml/shop/DEMO_001/forecast');
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommendations = async () => {
        try {
            const res = await api.get('/admin/ml/shop/DEMO_001/recommendations');
            setRecommendations(res.data.recommended_actions || []);
            setRecommendationMeta({
                decisionRiskScore: res.data.decision_risk_score,
                decisionBasis: res.data.decision_basis
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleCommitMitigationPlan = async () => {
        if (committing) return;

        const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        const highestPriority = recommendations
            .map((r) => r.priority)
            .sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b))[0] || 'LOW';

        const minutesToSchedule = highestPriority === 'CRITICAL' ? 15 : highestPriority === 'HIGH' ? 60 : 120;
        const scheduledDate = new Date(Date.now() + minutesToSchedule * 60 * 1000).toISOString();

        const decisionRisk = recommendationMeta?.decisionRiskScore ?? Math.round(projectedLast);
        const decisionBasis = recommendationMeta?.decisionBasis || (criticalProjection ? 'projected_7d' : 'current');

        try {
            setCommitting(true);
            await api.post('/admin/audits/schedule', {
                shop_id: 'DEMO_001',
                scheduled_date: scheduledDate,
                priority: highestPriority,
                notes: `Mitigation plan committed from Predictive Trends. Decision risk=${decisionRisk}% (basis=${decisionBasis}).`
            });
            toast.success(`Mitigation committed: ${highestPriority} audit scheduled`);
        } catch (err) {
            const detail = err?.response?.data?.detail;
            toast.error(typeof detail === 'string' ? detail : 'Failed to commit mitigation plan');
        } finally {
            setCommitting(false);
        }
    };

    const chartData = useMemo(() => {
        const rows = data?.chart_data || [];
        return rows.map((d) => {
            const isProjected = d.type === 'projected';
            const bandSpread = isProjected ? Math.max(4, Math.round(d.risk * 0.08)) : 0;
            return {
                ...d,
                risk_actual: d.type === 'actual' ? d.risk : null,
                risk_projected: d.type === 'projected' ? d.risk : null,
                risk_band: isProjected ? [Math.max(0, d.risk - bandSpread), Math.min(100, d.risk + bandSpread)] : null
            };
        });
    }, [data]);

    const projectedLast = [...chartData].reverse().find((x) => x.type === 'projected')?.risk || 0;
    const criticalProjection = projectedLast >= 70;

    return (
        <div className="gov-intel-page p-6 bg-slate-950 min-h-screen text-slate-100 rounded-2xl">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-cyan-500/20 rounded-xl border border-cyan-400/30">
                    <TrendingUp className="text-cyan-300" size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Predictive Risk Trends</h1>
                    <p className="text-slate-400 mt-1">Projected Risk (No Intervention)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <h2 className="font-bold text-sm">Historical Trend + Confidence Band</h2>
                        <div className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                            Projection Assumes No Intervention
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="h-96 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: 10, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
                                    />
                                    <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" />
                                    <Area type="monotone" dataKey="risk_band" stroke="none" fill="#22d3ee" fillOpacity={0.15} />
                                    <Line type="monotone" dataKey="risk_actual" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
                                    <Line type="monotone" dataKey="risk_projected" stroke="#38bdf8" strokeWidth={3} strokeDasharray="7 4" dot={{ r: 3 }} connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-xs text-slate-400 mt-3">
                            Shaded region shows forecast confidence band (low to high confidence range).
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className={`p-7 rounded-2xl border ${criticalProjection ? 'bg-red-950/40 border-red-500/40' : 'bg-slate-900 border-slate-800'}`}>
                        {criticalProjection && <ShieldAlert size={34} className="text-red-400 mb-3" />}
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Escalation Probability</div>
                        <div className="text-6xl font-black">{Math.round(projectedLast)}%</div>
                        <p className="text-xs text-slate-300 mt-3">
                            {criticalProjection
                                ? 'Critical trajectory detected under no-intervention scenario.'
                                : 'Projected trend remains in controllable range.'}
                        </p>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                            <Bell size={16} className="text-cyan-300" />
                            <h2 className="font-bold text-xs uppercase tracking-wide">Recommended Actions</h2>
                        </div>
                        <div className="p-4 space-y-2">
                            {recommendations.length > 0 ? recommendations.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                                        item.priority === 'CRITICAL'
                                            ? 'bg-red-950/30 border-red-500/30 text-red-200'
                                            : item.priority === 'HIGH'
                                                ? 'bg-orange-950/30 border-orange-500/30 text-orange-200'
                                                : 'bg-slate-800 border-slate-700 text-slate-200'
                                    }`}
                                >
                                    <div className="w-5 h-5 rounded-full bg-slate-700 text-[10px] font-black flex items-center justify-center">{idx + 1}</div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black">{item.action}</span>
                                        <span className="text-[9px] uppercase tracking-widest opacity-70">{item.priority}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-xs text-slate-500 py-6 text-center">{loading ? 'Loading...' : 'No recommendations.'}</div>
                            )}
                            {recommendationMeta?.decisionRiskScore != null && (
                                <div className="text-[10px] text-slate-400 pt-1">
                                    Decision risk: {Math.round(recommendationMeta.decisionRiskScore)}% ({recommendationMeta.decisionBasis === 'projected_7d' ? 'projected 7d' : 'current'})
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800">
                            <button
                                onClick={handleCommitMitigationPlan}
                                disabled={committing}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                            >
                                <Clock size={14} />
                                {committing ? 'Committing...' : 'Commit Mitigation Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictiveTrendsPage;
