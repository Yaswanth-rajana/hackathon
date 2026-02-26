import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Gavel, Hexagon, PlayCircle, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import api from '../../api/api';
import adminSimulationApi from '../../api/adminSimulation';
import { useAdminWebSocket } from '../../context/WebSocketContext';
import { useDistrict } from '../../context/DistrictContext';

const DEMO_SHOP_ID = 'DEMO_001';

const getGaugeColor = (score) => {
    if (score >= 75) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    return '#22c55e';
};

const getHeatClass = (level) => {
    if (level === 'CRITICAL') return 'bg-red-700/80 border-red-500 text-white';
    if (level === 'HIGH') return 'bg-orange-600/80 border-orange-500 text-white';
    if (level === 'MEDIUM') return 'bg-yellow-500/80 border-yellow-300 text-slate-900';
    return 'bg-emerald-700/40 border-emerald-500 text-emerald-100';
};

const RiskGauge = ({ risk, delta }) => {
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (Math.max(0, Math.min(100, risk)) / 100) * circumference;
    const color = getGaugeColor(risk);

    return (
        <div className="bg-[#11293e] border border-[#244765] rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3">Risk Gauge</div>
            <div className="flex items-center gap-6">
                <div className="relative w-44 h-44">
                    <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
                        <circle cx="90" cy="90" r={radius} stroke="#294763" strokeWidth="14" fill="none" />
                        <circle
                            cx="90"
                            cy="90"
                            r={radius}
                            stroke={color}
                            strokeWidth="14"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-700"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-4xl font-black" style={{ color }}>{Math.round(risk)}%</div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">Risk Score</div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="text-sm text-slate-300">Delta</div>
                    <div className={`text-2xl font-black ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400">
                        {risk >= 75 ? 'Critical signal window' : risk >= 50 ? 'Escalated surveillance' : 'Normal monitoring'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LiveMonitorPage = () => {
    const { connected, lastMessage } = useAdminWebSocket();
    const { selectedDistrict } = useDistrict();

    const [risk, setRisk] = useState(0);
    const [delta, setDelta] = useState(0);
    const [blockIndex, setBlockIndex] = useState(null);
    const [enforcement, setEnforcement] = useState({ mode: 'warning', reason: 'No critical action yet' });
    const [shopStatus, setShopStatus] = useState('active');
    const [heatmap, setHeatmap] = useState([]);
    const [activeMandal, setActiveMandal] = useState('');
    const [runningSim, setRunningSim] = useState(false);
    const [events, setEvents] = useState([]);

    const mandalByShopRef = useRef({});
    const seenSimulationEventsRef = useRef(new Set());
    const feedEndRef = useRef(null);

    const addEvent = (message, level = 'info') => {
        setEvents((prev) => [
            ...prev,
            {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                message,
                level,
                timestamp: new Date().toISOString()
            }
        ].slice(-100));
    };

    const applyAuditSnapshot = (snapshot) => {
        if (!snapshot) return;
        const nextRisk = Number(snapshot.risk_score ?? snapshot.current_risk ?? risk);
        const nextDelta = Number(snapshot.delta ?? 0);
        const nextBlock = snapshot.enforcement_block_index ?? snapshot.block_index ?? blockIndex;
        const nextStatus = String(snapshot.shop_status ?? shopStatus ?? 'active').toLowerCase();
        const autoEnforced = Boolean(snapshot.auto_enforced);

        setRisk(nextRisk);
        setDelta(nextDelta);
        setBlockIndex(nextBlock ?? null);
        setShopStatus(nextStatus);

        addEvent(`Risk escalated to ${nextRisk.toFixed(1)}% (delta ${nextDelta >= 0 ? '+' : ''}${nextDelta.toFixed(1)}%)`, 'alert');
        if (nextBlock != null) {
            addEvent(`Blockchain block #${nextBlock} mined for audit trail`, 'blockchain');
        } else {
            refreshLastKnownBlock();
        }
        if (autoEnforced || nextStatus === 'under_review') {
            setEnforcement({
                mode: 'suspended',
                reason: 'Critical risk threshold breached. Dealer auto-suspended.'
            });
            addEvent('Auto-enforcement executed: dealer suspended and shop under review', 'enforcement');
        } else {
            setEnforcement({
                mode: 'warning',
                reason: 'Early warning active. Intervention recommended.'
            });
        }
    };

    const refreshRiskBaseline = async () => {
        try {
            const res = await api.get('/admin/ml/risk-comparison');
            const row = (res.data || []).find((r) => r.shop_id === DEMO_SHOP_ID);
            if (!row) return;
            const nextRisk = Number(row.after || 0);
            const nextDelta = Number(row.change || 0);
            setRisk(nextRisk);
            setDelta(nextDelta);
        } catch {
            // no-op: live monitor should keep running even if one request fails
        }
    };

    const refreshHeatmap = async () => {
        try {
            const res = await api.get('/admin/dashboard/heatmap');
            setHeatmap(Array.isArray(res.data) ? res.data : []);
        } catch {
            setHeatmap([]);
        }
    };

    const refreshMandalMap = async () => {
        try {
            const res = await api.get('/admin/dashboard/high-risk-shops?page=1&limit=100');
            const rows = res.data?.data || [];
            const next = {};
            rows.forEach((r) => {
                if (r.shop_id) next[r.shop_id] = r.mandal || 'Unassigned';
            });
            mandalByShopRef.current = next;

            const demo = rows.find((r) => r.shop_id === DEMO_SHOP_ID);
            if (demo) {
                const status = String(demo.shop_status || 'active').toLowerCase();
                setShopStatus(status);
                if (status === 'under_review' || String(demo.dealer_status || '').toLowerCase() === 'suspended') {
                    setEnforcement({
                        mode: 'suspended',
                        reason: 'Critical risk threshold breached. Dealer auto-suspended.'
                    });
                }
            }
        } catch {
            mandalByShopRef.current = {};
        }
    };

    const refreshLastKnownBlock = async () => {
        try {
            const res = await api.get('/admin/dashboard/blockchain-recent');
            const rows = Array.isArray(res.data) ? res.data : [];
            const demoTx = rows.find((tx) => tx.shop_id === DEMO_SHOP_ID && tx.block_index != null);
            if (demoTx?.block_index != null) {
                setBlockIndex(Number(demoTx.block_index));
            }
        } catch {
            // no-op
        }
    };

    const syncSimulationEvents = async () => {
        try {
            const res = await adminSimulationApi.getEvents(DEMO_SHOP_ID);
            const rows = Array.isArray(res.data) ? [...res.data].reverse() : [];
            rows.forEach((row) => {
                const key = `${row.timestamp}|${row.msg}`;
                if (seenSimulationEventsRef.current.has(key)) return;
                seenSimulationEventsRef.current.add(key);
                addEvent(row.msg, 'simulation');
            });
        } catch {
            // no-op
        }
    };

    useEffect(() => {
        refreshRiskBaseline();
        refreshHeatmap();
        refreshMandalMap();
        refreshLastKnownBlock();
        syncSimulationEvents();

        const baselineTimer = setInterval(refreshRiskBaseline, 12000);
        const heatmapTimer = setInterval(refreshHeatmap, 15000);
        const mapTimer = setInterval(refreshMandalMap, 15000);
        const blockTimer = setInterval(refreshLastKnownBlock, 15000);
        const simTimer = setInterval(syncSimulationEvents, 5000);
        return () => {
            clearInterval(baselineTimer);
            clearInterval(heatmapTimer);
            clearInterval(mapTimer);
            clearInterval(blockTimer);
            clearInterval(simTimer);
        };
    }, []);

    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [events]);

    useEffect(() => {
        if (!lastMessage) return;

        const payload = lastMessage.payload || {};
        const eventType = lastMessage.type || payload.type || lastMessage.event;
        if (eventType !== 'ML_ALERT') return;

            const currentRisk = Number(lastMessage.current_risk ?? payload.current_risk ?? risk);
            const currentDelta = Number(lastMessage.delta ?? payload.delta ?? 0);
            const currentBlock = lastMessage.enforcement_block_index ?? payload.enforcement_block_index ?? lastMessage.block_index ?? payload.block_index ?? null;
        const currentShop = lastMessage.shop_id ?? payload.shop_id ?? DEMO_SHOP_ID;
        const autoEnforced = Boolean(lastMessage.auto_enforced ?? payload.auto_enforced);
        const status = (lastMessage.shop_status ?? payload.shop_status ?? 'active').toLowerCase();
        const mappedMandal = mandalByShopRef.current[currentShop] || 'Unassigned';

            setRisk(currentRisk);
            setDelta(currentDelta);
            setBlockIndex(currentBlock);
            setShopStatus(status);
        setActiveMandal(mappedMandal);
        setTimeout(() => setActiveMandal(''), 2000);

        addEvent(`Risk escalated to ${currentRisk.toFixed(1)}% (delta ${currentDelta >= 0 ? '+' : ''}${currentDelta.toFixed(1)}%)`, 'alert');
        if (currentBlock != null) {
            addEvent(`Blockchain block #${currentBlock} mined for ML alert`, 'blockchain');
        } else {
            refreshLastKnownBlock();
        }
            if (autoEnforced || status === 'under_review') {
            setEnforcement({
                mode: 'suspended',
                reason: 'Critical risk threshold breached. Dealer auto-suspended.'
            });
            addEvent('Auto-enforcement executed: dealer suspended and shop under review', 'enforcement');
            } else {
            setEnforcement({
                mode: 'warning',
                reason: 'Early warning active. Intervention recommended.'
            });
            }
        }, [lastMessage]);

    const systemStatus = useMemo(() => {
        if (!connected) return { label: 'System Offline', tone: 'text-red-400', icon: WifiOff };
        if (enforcement.mode === 'suspended' || shopStatus === 'under_review') return { label: 'Critical Action Executed', tone: 'text-red-300', icon: ShieldAlert };
        if (risk >= 50) return { label: 'Monitoring', tone: 'text-amber-300', icon: AlertTriangle };
        return { label: 'System Stable', tone: 'text-emerald-300', icon: Wifi };
    }, [connected, enforcement.mode, risk, shopStatus]);

    const runHighSimulation = async () => {
        if (runningSim) return;
        setRunningSim(true);
        try {
            addEvent('High-intensity simulation started', 'simulation');
            const monthYear = new Date().toISOString().slice(0, 7);
            await adminSimulationApi.injectGhosts(DEMO_SHOP_ID, 'HIGH', 42);
            await adminSimulationApi.injectComplaints(DEMO_SHOP_ID, 'HIGH', 42);
            await adminSimulationApi.injectStockMismatch(DEMO_SHOP_ID, 'HIGH', monthYear);
            const auditRes = await adminSimulationApi.runAudit(DEMO_SHOP_ID);
            applyAuditSnapshot(auditRes?.data || {});
            addEvent('High-intensity simulation completed', 'simulation');
            await refreshRiskBaseline();
            await refreshMandalMap();
            await refreshLastKnownBlock();
            await syncSimulationEvents();
        } catch (err) {
            addEvent(`Simulation failed: ${err?.response?.data?.detail || err.message}`, 'error');
        } finally {
            setRunningSim(false);
        }
    };

    const StatusIcon = systemStatus.icon;

    return (
        <div className="!bg-[#0B1C2D] !border-0 rounded-xl text-white p-5 md:p-6 space-y-4 min-h-[calc(100vh-210px)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Live Corruption Detection Mode</h1>
                    <p className="text-slate-300 text-sm">Unified real-time fraud lifecycle monitor for {selectedDistrict}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${systemStatus.tone}`}>
                        <StatusIcon size={16} />
                        {systemStatus.label}
                    </div>
                    <button
                        onClick={runHighSimulation}
                        disabled={runningSim}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border border-cyan-400/50 bg-cyan-500/10 text-cyan-200 text-xs font-bold uppercase tracking-wider disabled:opacity-60"
                    >
                        <PlayCircle size={15} />
                        {runningSim ? 'Running...' : 'Run High Simulation'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-4">
                    <RiskGauge risk={risk} delta={delta} />
                </div>

                <div className="xl:col-span-5 bg-[#11293e] border border-[#244765] rounded-xl p-5">
                    <div className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3">Heatmap Highlight</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {heatmap.length === 0 && (
                            <div className="col-span-full text-sm text-slate-400">No mandal risk data available.</div>
                        )}
                        {heatmap.map((region) => {
                            const isActive = activeMandal && region.mandal === activeMandal;
                            return (
                                <div
                                    key={region.mandal}
                                    className={`border rounded-lg p-3 transition-all ${getHeatClass(region.risk_level)} ${isActive ? 'ring-2 ring-cyan-300 scale-[1.02] animate-pulse' : ''}`}
                                >
                                    <div className="text-xs font-bold truncate">{region.mandal}</div>
                                    <div className="text-2xl font-black mt-1">{region.avg_score}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="xl:col-span-3 bg-[#11293e] border border-[#244765] rounded-xl p-5">
                    <div className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3">System Status</div>
                    <div className={`flex items-center gap-2 font-black ${systemStatus.tone}`}>
                        <StatusIcon size={17} />
                        {systemStatus.label}
                    </div>
                    <div className="mt-4 text-sm text-slate-300">WebSocket: {connected ? 'Connected' : 'Disconnected'}</div>
                    <div className="text-sm text-slate-300">Risk Level: {risk >= 75 ? 'Critical' : risk >= 50 ? 'Elevated' : 'Low'}</div>
                    <div className="text-sm text-slate-300">Latest Block: {blockIndex ?? 'N/A'}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-8 bg-[#11293e] border border-[#244765] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs uppercase tracking-wider text-slate-300 font-bold">Live Event Feed</div>
                        <Activity size={14} className="text-cyan-300" />
                    </div>
                    <div className="h-[360px] overflow-y-auto pr-1 space-y-2">
                        {events.length === 0 && (
                            <div className="text-sm text-slate-400">Waiting for simulation or ML alert events...</div>
                        )}
                        {events.map((evt) => (
                            <div key={evt.id} className="bg-[#0c2235] border border-[#27435c] rounded-lg p-3">
                                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                                    <span className="uppercase tracking-wider">{evt.level}</span>
                                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-sm text-slate-100">{evt.message}</div>
                            </div>
                        ))}
                        <div ref={feedEndRef} />
                    </div>
                </div>

                <div className="xl:col-span-4 bg-[#11293e] border border-[#244765] rounded-xl p-5">
                    <div className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-3">Enforcement Status</div>
                    {enforcement.mode === 'suspended' || shopStatus === 'under_review' ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-300 font-black">
                                <Gavel size={16} />
                                DEALER SUSPENDED
                            </div>
                            <div className="text-sm text-slate-200">{enforcement.reason}</div>
                            <div className="text-sm text-slate-300">Block: {blockIndex != null ? `#${blockIndex}` : 'Pending'}</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-amber-300 font-black">
                                <AlertTriangle size={16} />
                                EARLY WARNING
                            </div>
                            <div className="text-sm text-slate-200">{enforcement.reason}</div>
                            <div className="text-sm text-slate-300">Intervention suggested before escalation.</div>
                        </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#244765]">
                        <div className="text-xs uppercase tracking-wider text-slate-300 font-bold mb-2">Blockchain Mining Event</div>
                        <div className="flex items-center gap-2 text-cyan-200">
                            <Hexagon size={15} />
                            {blockIndex != null ? `Block #${blockIndex} mined` : 'No recent block mined'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveMonitorPage;
