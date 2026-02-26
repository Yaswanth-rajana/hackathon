import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/api';
import {
    Activity,
    History,
    Zap,
    ShieldAlert,
    Link,
    Search,
    Shield
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAdminWebSocket } from '../../../context/WebSocketContext';
import { format } from 'date-fns';

const TickingCounter = ({ value, prefix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);
    useEffect(() => {
        let frame;
        const start = performance.now();
        const end = Number(value || 0);
        const step = (t) => {
            const p = Math.min((t - start) / 1000, 1);
            setDisplayValue(Math.floor(end * p));
            if (p < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [value]);
    return <span>{prefix}{displayValue.toLocaleString()}</span>;
};

const FraudDetectionInsightsPage = () => {
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState(null);
    const [forensic, setForensic] = useState(null);
    const [shopState, setShopState] = useState(null);
    const { lastMessage } = useAdminWebSocket();

    useEffect(() => {
        fetchInsights();
    }, []);

    useEffect(() => {
        if (lastMessage?.type === 'ML_ALERT' && lastMessage.shop_id === 'DEMO_001') fetchInsights();
    }, [lastMessage]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchInsights();
        }, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            const [explRes, forenRes, shopsRes] = await Promise.all([
                api.get('/admin/ml/shop/DEMO_001/explanation'),
                api.get('/admin/ml/shop/DEMO_001/forensic'),
                api.get('/admin/dashboard/high-risk-shops?page=1&limit=50')
            ]);
            setExplanation(explRes.data);
            setForensic(forenRes.data);
            const demo = (shopsRes.data?.data || []).find(s => s.shop_id === 'DEMO_001');
            setShopState(demo || null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getEventIcon = (type) => {
        if (type === 'SIMULATION') return <Zap className="text-cyan-300" size={14} />;
        if (type === 'DETECTION') return <ShieldAlert className="text-orange-300" size={14} />;
        if (type === 'BLOCKCHAIN') return <Link className="text-emerald-300" size={14} />;
        return <Activity className="text-slate-400" size={14} />;
    };

    const patternSignature = useMemo(() => {
        const entries = Object.entries(explanation?.contributions || {});
        if (!entries.length) return 'Pattern signature unavailable';
        const [topKey, topVal] = entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
        if (topKey.includes('stock')) return `Coordinated Distribution Manipulation (${Math.round(topVal)} influence)`;
        if (topKey.includes('ghost')) return `Synthetic Beneficiary Infiltration (${Math.round(topVal)} influence)`;
        if (topKey.includes('complaint')) return `Public Sentiment Distortion (${Math.round(topVal)} influence)`;
        return `Multi-vector Fraud Signal (${Math.round(topVal)} influence)`;
    }, [explanation]);

    const timeline = useMemo(() => {
        const events = Array.isArray(forensic?.timeline) ? [...forensic.timeline] : [];
        return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [forensic]);

    const formatSimulationDetails = (evt) => {
        const details = evt?.details || {};
        const intensity = details.intensity || 'N/A';
        const count = details.count ?? details.affected_rows;
        const monthYear = details.month_year ? ` | Month: ${details.month_year}` : '';
        const inflation = details.inflation_factor ? ` | Factor: ${details.inflation_factor}x` : '';
        return `Intensity: ${intensity}${count != null ? ` | Count: ${count}` : ''}${monthYear}${inflation}`;
    };

    return (
        <div className="gov-intel-page p-6 bg-slate-950 min-h-screen text-slate-100 rounded-2xl">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-red-500/20 rounded-xl border border-red-400/30">
                    <Activity className="text-red-300" size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Fraud Detection Insights</h1>
                    <p className="text-slate-400 mt-1">Forensic clarity, impact quantification, and enforcement traceability</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300 mb-4">Fraud Impact Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Total Ghost Accounts</div>
                        <div className="text-3xl font-black mt-1"><TickingCounter value={forensic?.impact?.total_ghosts || 0} /></div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Estimated Yearly Leakage</div>
                        <div className="text-3xl font-black mt-1"><TickingCounter value={forensic?.impact?.estimated_leakage || 0} prefix="₹" /></div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">System Confidence</div>
                        <div className="text-3xl font-black mt-1 text-cyan-300">{explanation?.confidence || 0}%</div>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Enforcement Action</div>
                        <div className={`text-lg font-black mt-2 ${
                            (shopState?.dealer_status || '').toLowerCase() === 'suspended' ? 'text-red-300' : 'text-emerald-300'
                        }`}>
                            {(shopState?.dealer_status || '').toLowerCase() === 'suspended' ? 'Auto Suspended' : 'Monitoring'}
                        </div>
                    </div>
                </div>
                <div className="mt-4 text-sm bg-slate-800 border border-slate-700 rounded-xl p-3">
                    <span className="text-slate-400">Pattern Signature: </span>
                    <span className="font-black text-orange-300">{patternSignature}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col min-h-[500px]">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <History size={18} className="text-cyan-300" />
                            <h2 className="font-bold">Forensic Investigation Feed</h2>
                        </div>
                        <span className="text-[10px] font-black bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded uppercase tracking-widest">Live</span>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto max-h-[500px]">
                        <div className="space-y-6 relative before:absolute before:inset-0 before:left-2.5 before:w-0.5 before:bg-slate-800 before:ml-[3px]">
                            {timeline.length > 0 ? timeline.map((evt) => (
                                <div key={evt.id} className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center z-10">
                                        {getEventIcon(evt.type)}
                                    </div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{evt.type}</span>
                                        <span className="text-[10px] font-bold text-slate-500">{format(new Date(evt.timestamp), 'HH:mm:ss')}</span>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                                        <div className="text-sm font-bold">{evt.event}</div>
                                        <div className="text-xs text-slate-400">
                                            {evt.type === 'SIMULATION' && formatSimulationDetails(evt)}
                                            {evt.type === 'DETECTION' && `${evt.details.description}`}
                                            {evt.type === 'BLOCKCHAIN' && `Verified in Block #${evt.details.block}`}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 text-slate-500 italic text-sm">{loading ? 'Loading...' : 'No signals recorded.'}</div>
                            )}
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-800 text-center">
                        <button className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1 mx-auto hover:text-slate-200 transition-colors">
                            <Search size={14} /> Full Cross-Chain Investigation
                        </button>
                    </div>
                </div>

                <div className="md:col-span-7 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-300" />
                        <h2 className="font-bold">Behavioral Feature Contribution</h2>
                    </div>
                    <div className="p-6">
                        <div className="h-[360px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={explanation ? Object.entries(explanation.contributions || {}).map(([name, value]) => ({
                                        name: name.replace('_', ' ').toUpperCase(),
                                        score: value
                                    })) : []}
                                    margin={{ left: 20, right: 30, top: 10, bottom: 10 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#1e293b" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.05em' }}
                                        width={140}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }} />
                                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                                        {explanation && Object.entries(explanation.contributions || {}).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry[1] > 20 ? '#ef4444' : '#22d3ee'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Shield className="text-cyan-300" size={18} />
                                <div>
                                    <div className="text-xs font-bold">Autonomous Auditor Confirmed</div>
                                    <div className="text-[10px] text-slate-500 font-mono">Unsupervised Isolation Forest Pipeline</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-cyan-300">{explanation?.confidence || 0}% Confidence</div>
                                <div className="h-1.5 w-32 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-cyan-400 transition-all duration-700" style={{ width: `${explanation?.confidence || 0}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FraudDetectionInsightsPage;
