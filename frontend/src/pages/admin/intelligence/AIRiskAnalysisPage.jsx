import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/api';
import {
    Shield,
    RotateCw,
    TrendingUp,
    TrendingDown,
    Activity,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAdminWebSocket } from '../../../context/WebSocketContext';

const AIRiskAnalysisPage = () => {
    const [loading, setLoading] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [shops, setShops] = useState([]);
    const [explanation, setExplanation] = useState(null);
    const [openModal, setOpenModal] = useState(false);
    const [pulsingShopId, setPulsingShopId] = useState(null);
    const [selectedShopId, setSelectedShopId] = useState('DEMO_001');
    const [momentum, setMomentum] = useState({ label: 'Stable', tone: 'stable' });
    const { lastMessage } = useAdminWebSocket();

    useEffect(() => {
        fetchComparison();
    }, []);

    useEffect(() => {
        if (lastMessage?.type === 'ML_ALERT' || lastMessage?.type === 'NEW_ANOMALY') {
            if (lastMessage.toast_message) toast(lastMessage.toast_message, { duration: 5000 });
            if (lastMessage.shop_id) {
                setPulsingShopId(lastMessage.shop_id);
                setSelectedShopId(lastMessage.shop_id);
                fetchComparison();
                setTimeout(() => setPulsingShopId(null), 3000);
            }
        }
    }, [lastMessage]);

    useEffect(() => {
        if (!selectedShopId) return;
        fetchExplanation(selectedShopId);
        fetchMomentum(selectedShopId);
    }, [selectedShopId]);

    const fetchComparison = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/ml/risk-comparison');
            const rows = Array.isArray(res.data) ? res.data : [];
            setShops(rows);
            if (rows.length > 0 && !rows.find(s => s.shop_id === selectedShopId)) {
                setSelectedShopId(rows[0].shop_id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchExplanation = async (shopId) => {
        try {
            const res = await api.get(`/admin/ml/shop/${shopId}/explanation`);
            setExplanation(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMomentum = async (shopId) => {
        try {
            const res = await api.get(`/admin/ml/shop/${shopId}/forecast`);
            const actual = (res.data?.chart_data || []).filter(p => p.type === 'actual');
            if (actual.length < 3) {
                setMomentum({ label: 'Stable', tone: 'stable' });
                return;
            }
            const last3 = actual.slice(-3);
            const slope = (last3[2].risk - last3[0].risk) / 2;
            if (slope >= 5) setMomentum({ label: 'Rapid Escalation', tone: 'up' });
            else if (slope <= -3) setMomentum({ label: 'Cooling Down', tone: 'down' });
            else setMomentum({ label: 'Stable', tone: 'stable' });
        } catch (err) {
            console.error(err);
        }
    };

    const handleRecalculate = async (shopId) => {
        try {
            setRecalculating(true);
            const res = await api.post(`/admin/ml/recalculate?shop_id=${shopId}`);
            if (res.data.status === 'success') toast.success(`Audit Complete: ${res.data.delta_percent} Change`);
            await fetchComparison();
            await fetchExplanation(shopId);
            await fetchMomentum(shopId);
        } catch (err) {
            console.error(err);
            toast.error('Global Audit Failed');
        } finally {
            setRecalculating(false);
        }
    };

    const getRiskColor = (score) => {
        if (score >= 85) return '#ef4444';
        if (score >= 70) return '#f97316';
        if (score >= 50) return '#eab308';
        return '#22c55e';
    };

    const selectedShop = useMemo(
        () => shops.find(s => s.shop_id === selectedShopId) || shops[0],
        [shops, selectedShopId]
    );

    const breakdown = useMemo(() => {
        const raw = explanation?.contributions || {};
        const keyMap = [
            ['ghost_score', 'Ghost Beneficiaries'],
            ['stock_score', 'Stock Mismatch'],
            ['complaint_score', 'Complaint Spike'],
            ['timing_score', 'Timing Pattern']
        ];
        const total = keyMap.reduce((sum, [k]) => sum + Number(raw[k] || 0), 0) || 1;
        return keyMap.map(([k, label]) => ({
            label,
            value: Number(raw[k] || 0),
            pct: Math.round((Number(raw[k] || 0) / total) * 100)
        }));
    }, [explanation]);

    const actions = useMemo(() => {
        const risk = Number(selectedShop?.after || 0);
        const fastEsc = momentum.tone === 'up';
        return [
            { label: 'Immediate Audit', on: risk >= 70 || fastEsc },
            { label: 'Freeze Allocation', on: risk >= 80 },
            { label: 'Suspend Dealer', on: risk >= 85 },
            { label: 'Notify Collector', on: risk >= 75 || fastEsc }
        ];
    }, [selectedShop, momentum]);

    return (
        <div className="gov-intel-page p-6 bg-slate-950 min-h-screen text-slate-100 rounded-2xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-cyan-500/20 rounded-xl border border-cyan-400/30">
                    <Shield className="text-cyan-300" size={30} />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Governance Intelligence Engine</h1>
                    <p className="text-slate-400 text-sm">Explainable risk composition, momentum, and executive action layer</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold flex items-center gap-2"><Activity size={16} className="text-cyan-300" /> Risk Composition Breakdown</h2>
                        <button
                            onClick={() => handleRecalculate(selectedShop?.shop_id || 'DEMO_001')}
                            disabled={recalculating}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                        >
                            <RotateCw size={14} className={recalculating ? 'animate-spin' : ''} />
                            {recalculating ? 'Recalculating...' : 'Run AI Audit'}
                        </button>
                    </div>
                    <div className="w-full h-4 rounded-full overflow-hidden bg-slate-800 flex">
                        {breakdown.map((b, i) => (
                            <div
                                key={b.label}
                                className={`${i === 0 ? 'bg-cyan-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-pink-500' : 'bg-violet-500'}`}
                                style={{ width: `${Math.max(2, b.pct)}%` }}
                                title={`${b.label}: ${b.pct}%`}
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                        {breakdown.map((b, i) => (
                            <div key={b.label} className="text-xs p-2 rounded bg-slate-800 border border-slate-700">
                                <div className={`font-black ${i === 0 ? 'text-cyan-300' : i === 1 ? 'text-orange-300' : i === 2 ? 'text-pink-300' : 'text-violet-300'}`}>{b.pct}%</div>
                                <div className="text-slate-400">{b.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h2 className="font-bold mb-3">Risk Momentum</h2>
                    <div className={`text-lg font-black flex items-center gap-2 ${
                        momentum.tone === 'up' ? 'text-red-400 animate-pulse' : momentum.tone === 'down' ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                        {momentum.tone === 'up' ? <TrendingUp size={16} /> : momentum.tone === 'down' ? <TrendingDown size={16} /> : null}
                        {momentum.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">Computed from last 3 risk snapshots.</div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 text-sm font-bold">Real-time Risk Snapshot</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-800">
                                <th className="px-6 py-4">Shop</th>
                                <th className="px-6 py-4 text-center">Prev</th>
                                <th className="px-6 py-4 text-center">Current</th>
                                <th className="px-6 py-4 text-center">Delta</th>
                                <th className="px-6 py-4 text-center">Level</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {shops.length === 0 && !loading && (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No audit data available</td></tr>
                            )}
                            <AnimatePresence>
                                {shops.map((shop) => (
                                    <motion.tr
                                        key={shop.shop_id}
                                        onClick={() => setSelectedShopId(shop.shop_id)}
                                        className={`cursor-pointer hover:bg-slate-800/60 ${selectedShopId === shop.shop_id ? 'bg-slate-800/70' : ''}`}
                                        animate={{ opacity: 1 }}
                                        initial={{ opacity: 0.7 }}
                                        style={{ boxShadow: pulsingShopId === shop.shop_id ? 'inset 0 0 0 1px rgba(239,68,68,.5)' : 'none' }}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-bold">{shop.shop_id}</div>
                                            <div className="text-[10px] text-slate-500 uppercase">{shop.shop_name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-400 font-mono">{shop.before}%</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-2xl font-black" style={{ color: getRiskColor(shop.after) }}>{shop.after}%</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-black ${
                                                shop.change > 0 ? 'bg-red-500/20 text-red-300' : shop.change < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                                            }`}>
                                                {shop.change > 0 ? '+' : ''}{shop.change}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs font-black">
                                            {shop.after >= 85 ? 'CRITICAL' : shop.after >= 70 ? 'HIGH' : shop.after >= 50 ? 'MEDIUM' : 'STABLE'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedShopId(shop.shop_id); setOpenModal(true); }}
                                                className="px-3 py-2 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20"
                                            >
                                                Forensic Breakdown
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="font-bold mb-3">Executive Decision Panel</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    {actions.map((a) => (
                        <div key={a.label} className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider border ${a.on ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                            {a.on ? '☑' : '☐'} {a.label}
                        </div>
                    ))}
                </div>
            </div>

            {openModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase tracking-wider">ML Risk Breakdown: {selectedShopId}</h3>
                            <button onClick={() => setOpenModal(false)} className="p-1 hover:bg-slate-800 rounded"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-900 border border-slate-800 rounded p-3">
                                    <div className="text-[10px] uppercase text-slate-500 font-black">Anomaly Probability</div>
                                    <div className="text-2xl font-black">{explanation?.risk_score || 0}%</div>
                                </div>
                                <div className="bg-slate-900 border border-slate-800 rounded p-3">
                                    <div className="text-[10px] uppercase text-slate-500 font-black">Model Confidence</div>
                                    <div className="text-2xl font-black text-cyan-300">{explanation?.confidence || 0}%</div>
                                </div>
                            </div>
                            {breakdown.map((b) => (
                                <div key={b.label} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded p-2 text-xs">
                                    <span>{b.label}</span><span className="font-black">{b.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIRiskAnalysisPage;
