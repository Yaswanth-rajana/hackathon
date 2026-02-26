import React, { useState, useRef, useEffect } from 'react';
import adminSimulationApi from '../../api/adminSimulation';
import AdminOverviewPanel from '../../components/admin/dashboard/AdminOverviewPanel';
import BlockDetailsModal from '../../components/admin/dashboard/BlockDetailsModal';
import { Play, RotateCcw, Zap, Ghost, Package, MessageSquare, Brain, Terminal, ChevronDown, ChevronUp, AlertCircle, FileSearch, Wifi, WifiOff } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { useAdminWebSocket } from '../../context/WebSocketContext';

const SimulationPage = () => {
    const dashboardRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [pendingRequest, setPendingRequest] = useState(false);
    const [shopId] = useState('DEMO_001'); // Default demo shop
    const [selectedBlock, setSelectedBlock] = useState(null);
    const { showAlert } = useAlert();
    const { connected, registerOnConnect } = useAdminWebSocket();

    // Control States
    const [ghostCount, setGhostCount] = useState(50);
    const [inflationFactor, setInflationFactor] = useState(1.2);
    const [complaintCount, setComplaintCount] = useState(10);

    // Simulation Logs
    const [logs, setLogs] = useState([
        { time: new Date().toLocaleTimeString(), msg: "Simulation ready. Target Shop: DEMO_001", type: 'info' }
    ]);

    const addLog = (msg, type = 'info', extra = {}) => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type, ...extra }, ...prev].slice(0, 50));
    };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await adminSimulationApi.getEvents(shopId);
                const historicalLogs = res.data.map(e => ({
                    time: new Date(e.timestamp).toLocaleTimeString(),
                    msg: e.msg,
                    type: e.type.includes('reset') ? 'reset' : (e.type.includes('injection') ? 'success' : 'info')
                }));
                setLogs(historicalLogs);
            } catch (err) {
                console.error("Failed to fetch sim history", err);
            }
        };
        fetchHistory();
    }, [shopId]);

    // Auto-refresh on WebSocket reconnect
    useEffect(() => {
        if (registerOnConnect) {
            const unregister = registerOnConnect(() => {
                if (dashboardRef.current) {
                    console.log("WebSocket reconnected, triggering UI resync...");
                    dashboardRef.current.refresh();
                    addLog("System Link restored. Synchronizing UI...", 'info');
                }
            });
            return unregister;
        }
    }, [registerOnConnect]);

    // Emergency Reset Handler (CTRL + SHIFT + R)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                // DEMO_MODE guard is normally on backend, but we check here too if available
                handleReset();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleInjectGhosts = async () => {
        if (pendingRequest) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            await adminSimulationApi.injectGhosts(shopId, ghostCount, Math.floor(Math.random() * 1000));
            addLog(`Injected ${ghostCount} ghost beneficiaries into ${shopId}`, 'success');
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Ghost injection failed: ${err.message}`, 'error');
            showAlert(`Ghost injection failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    const handleInjectMismatch = async () => {
        if (pendingRequest) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
            await adminSimulationApi.injectStockMismatch(shopId, inflationFactor, monthYear);
            addLog(`Injected ${inflationFactor}x stock mismatch for ${monthYear}`, 'success');
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Stock mismatch injection failed: ${err.message}`, 'error');
            showAlert(`Stock mismatch injection failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    const handleInjectComplaints = async () => {
        if (pendingRequest) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            await adminSimulationApi.injectComplaints(shopId, complaintCount, Math.floor(Math.random() * 1000));
            addLog(`Injected ${complaintCount} complaint spikes`, 'success');
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Complaint spike injection failed: ${err.message}`, 'error');
            showAlert(`Complaint spike injection failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    const runScenario = async (intensity) => {
        if (pendingRequest) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            addLog(`Running ${intensity.toUpperCase()} intensity scenario...`, 'scenario');

            let ghosts = 20, complaints = 5, mismatch = 1.0;
            if (intensity === 'medium') { ghosts = 100; complaints = 20; mismatch = 1.3; }
            if (intensity === 'high') { ghosts = 250; complaints = 60; mismatch = 1.7; }

            const monthYear = new Date().toISOString().slice(0, 7);

            await Promise.all([
                adminSimulationApi.injectGhosts(shopId, ghosts, 42),
                adminSimulationApi.injectComplaints(shopId, complaints, 42),
                mismatch > 1.0 ? adminSimulationApi.injectStockMismatch(shopId, mismatch, monthYear) : Promise.resolve()
            ]);

            addLog(`Scenario ${intensity.toUpperCase()} deployed successfully.`, 'success');
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Scenario failed: ${err.message}`, 'error');
            showAlert(`Scenario failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    const handleRunAudit = async () => {
        if (pendingRequest) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            addLog("Executing AI Audit...", 'audit');
            const res = await adminSimulationApi.runAudit(shopId);
            addLog(`Audit Complete. Risk Score: ${res.data.risk_score}% | Result: ${res.data.severity}`, 'audit-res');

            if (res.data.block_index !== null) {
                addLog(`Immutable ML_ALERT block mined to Ledger.`, 'blockchain', {
                    blockIndex: res.data.block_index,
                    blockHash: res.data.block_hash
                });
            } else {
                addLog(`Audit negative. No anomaly detected.`, 'info');
            }

            // The OverviewPanel will automatically refresh due to WebSocket event from backend
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Audit failed: ${err.message}`, 'error');
            showAlert(`Audit failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    const handleReset = async () => {
        if (pendingRequest) return;
        if (!window.confirm("RESET DEMO: This will purge all simulated data for this shop. Continue?")) return;
        try {
            setPendingRequest(true);
            setLoading(true);
            await adminSimulationApi.resetDemo(shopId);
            addLog(`Shop ${shopId} restored to clean state.`, 'reset');
            if (dashboardRef.current) dashboardRef.current.refresh();
        } catch (err) {
            addLog(`Reset failed: ${err.message}`, 'error');
            showAlert(`Reset failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setPendingRequest(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Mission Control Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap size={120} className="text-yellow-400" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <Zap className="text-yellow-400 fill-yellow-400" />
                            Admin Simulation Mission Control
                            <div className={`ml-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${connected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                {connected ? 'SYSTEM LINK ACTIVE' : 'SYSTEM LINK ERROR'}
                                {!connected && <WifiOff size={12} />}
                            </div>
                        </h1>
                        <p className="text-slate-400 mt-2 max-w-2xl">
                            Stress test RationShield's AI & Blockchain layers. Inject fraud scenarios at scale and watch the system's real-time defensive reaction.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleReset}
                            disabled={loading || pendingRequest}
                            className={`flex items-center gap-2 px-5 py-3 ${loading || pendingRequest ? 'bg-slate-700 text-slate-500' : 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400'} rounded-xl font-bold transition-all`}
                        >
                            <RotateCcw size={18} />
                            RESET DEMO
                        </button>
                        <button
                            onClick={handleRunAudit}
                            disabled={loading || pendingRequest}
                            className={`flex items-center gap-2 px-8 py-3 ${loading || pendingRequest ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'} rounded-xl font-bold shadow-lg shadow-blue-900/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all`}
                        >
                            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Brain size={20} />}
                            RUN AI AUDIT
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* SECTION 1 & 2: Control Panel */}
                <div className="xl:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Ghost Injection Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-blue-400 transition-colors">
                            <div className="flex items-center gap-3 mb-6 text-slate-500 transition-colors group-hover:text-blue-600">
                                <Ghost size={24} />
                                <h3 className="font-bold">Ghost Beneficiaries</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Injection Count</span>
                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 rounded">{ghostCount}</span>
                                </div>
                                <input
                                    type="range" min="10" max="300" step="10"
                                    value={ghostCount}
                                    onChange={(e) => setGhostCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <button
                                    onClick={handleInjectGhosts}
                                    disabled={loading || pendingRequest}
                                    className={`w-full py-2 ${loading || pendingRequest ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700'} font-semibold rounded-lg transition-all border border-slate-200 hover:border-blue-600`}
                                >
                                    Inject Ghosts
                                </button>
                            </div>
                        </div>

                        {/* Stock Mismatch Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-purple-400 transition-colors">
                            <div className="flex items-center gap-3 mb-6 text-slate-500 transition-colors group-hover:text-purple-600">
                                <Package size={24} />
                                <h3 className="font-bold">Stock Mismatch</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Inflation Factor</span>
                                    <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 rounded">{inflationFactor}x</span>
                                </div>
                                <input
                                    type="range" min="1.1" max="2.0" step="0.1"
                                    value={inflationFactor}
                                    onChange={(e) => setInflationFactor(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <button
                                    onClick={handleInjectMismatch}
                                    disabled={loading || pendingRequest}
                                    className={`w-full py-2 ${loading || pendingRequest ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 hover:bg-purple-600 hover:text-white text-slate-700'} font-semibold rounded-lg transition-all border border-slate-200 hover:border-purple-600`}
                                >
                                    Inflate Stock
                                </button>
                            </div>
                        </div>

                        {/* Complaint Spike Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 group hover:border-amber-400 transition-colors">
                            <div className="flex items-center gap-3 mb-6 text-slate-500 transition-colors group-hover:text-amber-600">
                                <MessageSquare size={24} />
                                <h3 className="font-bold">Complaint Spike</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Complaint Count</span>
                                    <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 rounded">{complaintCount}</span>
                                </div>
                                <input
                                    type="range" min="5" max="100" step="5"
                                    value={complaintCount}
                                    onChange={(e) => setComplaintCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                />
                                <button
                                    onClick={handleInjectComplaints}
                                    disabled={loading || pendingRequest}
                                    className={`w-full py-2 ${loading || pendingRequest ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 hover:bg-amber-600 hover:text-white text-slate-700'} font-semibold rounded-lg transition-all border border-slate-200 hover:border-amber-600`}
                                >
                                    Force Complaints
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Random Scenario Engine */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                <Play size={20} className="text-emerald-600" />
                                Random Scenario Engine
                            </h3>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Advanced Orchestration</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => runScenario('low')}
                                disabled={loading || pendingRequest}
                                className={`p-4 rounded-xl border ${loading || pendingRequest ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50'} transition-all flex flex-col gap-1 items-start group`}
                            >
                                <span className="text-emerald-700 font-bold group-hover:scale-110 transition-transform">🟢 LOW IMPACT</span>
                                <span className="text-xs text-slate-500 text-left">20 ghosts + 5 complaints</span>
                            </button>
                            <button
                                onClick={() => runScenario('medium')}
                                disabled={loading || pendingRequest}
                                className={`p-4 rounded-xl border ${loading || pendingRequest ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 border-slate-100 hover:border-amber-500 hover:bg-amber-50'} transition-all flex flex-col gap-1 items-start group`}
                            >
                                <span className="text-amber-700 font-bold group-hover:scale-110 transition-transform">🟡 MEDIUM IMPACT</span>
                                <span className="text-xs text-slate-500 text-left">100 ghosts + 20 complaints + 1.3x mismatch</span>
                            </button>
                            <button
                                onClick={() => runScenario('high')}
                                disabled={loading || pendingRequest}
                                className={`p-4 rounded-xl border ${loading || pendingRequest ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-slate-50 border-slate-100 hover:border-red-500 hover:bg-red-50'} transition-all flex flex-col gap-1 items-start group`}
                            >
                                <span className="text-red-700 font-bold group-hover:scale-110 transition-transform">🔴 HIGH IMPACT (WOW)</span>
                                <span className="text-xs text-slate-500 text-left">250 ghosts + 60 complaints + 1.7x mismatch</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simulation Logs */}
                <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                        <Terminal size={20} className="text-emerald-400" />
                        <h3 className="text-white font-bold uppercase tracking-widest text-sm">Real-Time Simulation Log</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs max-h-[400px] scrollbar-hide">
                        {logs.map((log, i) => (
                            <div key={i} className={`flex items-center justify-between gap-3 border-l-2 pl-3 py-1 ${log.type === 'error' ? 'border-red-500 text-red-400' :
                                log.type === 'success' ? 'border-emerald-500 text-emerald-400' :
                                    log.type === 'audit' ? 'border-blue-500 text-blue-400 transition-all animate-pulse' :
                                        log.type === 'audit-res' ? 'border-indigo-500 text-indigo-300 font-bold italic' :
                                            log.type === 'reset' ? 'border-amber-500 text-amber-400' :
                                                log.type === 'blockchain' ? 'border-blue-400 text-blue-300' :
                                                    'border-slate-600 text-slate-400'
                                }`}>
                                <div className="flex gap-3">
                                    <span className="opacity-50 font-light whitespace-nowrap">[{log.time}]</span>
                                    <span>{log.msg}</span>
                                </div>
                                {log.blockIndex !== undefined && (
                                    <button
                                        onClick={() => setSelectedBlock({ index: log.blockIndex, hash: log.blockHash })}
                                        className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded border border-blue-500/30 transition-all text-[10px]"
                                    >
                                        <FileSearch size={12} />
                                        VIEW BLOCK
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* LIVE SYSTEM VIEW (Embedded Overview) */}
            <div className="border-t-2 border-slate-200 pt-12 mt-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                            <Play size={24} className="text-blue-600 fill-blue-600" />
                            Live System Reaction View
                        </h2>
                        <p className="text-slate-500">Monitor the AI Engine and Blockchain Ledger in real-time as simulation progresses.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full animate-pulse">
                        LIVE SYNC ACTIVE
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden min-h-[800px]">
                    <AdminOverviewPanel ref={dashboardRef} showHeader={false} />
                </div>
            </div>

            {/* Block Details Modal */}
            <BlockDetailsModal
                isOpen={!!selectedBlock}
                onClose={() => setSelectedBlock(null)}
                blockIndex={selectedBlock?.index}
                blockHash={selectedBlock?.hash}
            />
        </div>
    );
};

export default SimulationPage;
