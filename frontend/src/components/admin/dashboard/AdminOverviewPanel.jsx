import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import api from '../../../api/api';
import { useAdminWebSocket } from '../../../context/WebSocketContext';

import StatsBar from './StatsBar';
import LiveAlerts from './LiveAlerts';
import HeatMap from './HeatMap';
import HighRiskShopsTable from './HighRiskShopsTable';
import BlockchainRecent from './BlockchainRecent';

const AdminOverviewPanel = forwardRef(({ showHeader = true, title = "Admin Overview Dashboard" }, ref) => {
    const [summary, setSummary] = useState({ data: null, loading: true, error: null });
    const [alerts, setAlerts] = useState({ data: [], total: 0, loading: true, error: null, page: 1, limit: 10 });
    const [heatmap, setHeatmap] = useState({ data: [], loading: true, error: null });
    const [shops, setShops] = useState({ data: [], loading: true, error: null, page: 1, limit: 10 });
    const [blockchain, setBlockchain] = useState({ data: [], loading: true, error: null });

    // WebSocket for "Live Flash" behavior
    const { lastMessage } = useAdminWebSocket();
    const [flashShop, setFlashShop] = useState(null);

    const fetchSummary = async () => {
        try {
            setSummary(prev => ({ ...prev, loading: true, error: null }));
            const res = await api.get('/admin/dashboard/summary');
            setSummary({ data: res.data, loading: false, error: null });
        } catch (err) {
            setSummary(prev => ({ ...prev, loading: false, error: err.message }));
        }
    };

    const fetchAlerts = async (pageArg = alerts.page) => {
        try {
            setAlerts(prev => ({ ...prev, loading: true, error: null, page: pageArg }));
            const res = await api.get(`/admin/dashboard/alerts?page=${pageArg}&limit=${alerts.limit}`);
            setAlerts(prev => ({ ...prev, data: res.data.data, total: res.data.total, loading: false, error: null }));
        } catch (err) {
            setAlerts(prev => ({ ...prev, loading: false, error: err.message }));
        }
    };

    const fetchHeatmap = async () => {
        try {
            setHeatmap(prev => ({ ...prev, loading: true, error: null }));
            const res = await api.get('/admin/dashboard/heatmap');
            setHeatmap({ data: res.data, loading: false, error: null });
        } catch (err) {
            setHeatmap(prev => ({ ...prev, loading: false, error: err.message }));
        }
    };

    const fetchHighRiskShops = async (pageArg = shops.page) => {
        try {
            setShops(prev => ({ ...prev, loading: true, error: null, page: pageArg }));
            const res = await api.get(`/admin/dashboard/high-risk-shops?page=${pageArg}&limit=${shops.limit}`);
            setShops(prev => ({ ...prev, data: res.data.data, loading: false, error: null }));
        } catch (err) {
            setShops(prev => ({ ...prev, loading: false, error: err.message }));
        }
    };

    const fetchBlockchain = async () => {
        try {
            setBlockchain(prev => ({ ...prev, loading: true, error: null }));
            const res = await api.get('/admin/dashboard/blockchain-recent');
            setBlockchain({ data: res.data, loading: false, error: null });
        } catch (err) {
            setBlockchain(prev => ({ ...prev, loading: false, error: err.message }));
        }
    };

    const loadAll = () => {
        fetchSummary();
        fetchAlerts(1);
        fetchHeatmap();
        fetchHighRiskShops(1);
        fetchBlockchain();
    };

    useImperativeHandle(ref, () => ({
        refresh: loadAll
    }));

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Monitor WebSocket messages for live updates
    useEffect(() => {
        if (lastMessage && (lastMessage.type === 'NEW_ANOMALY' || lastMessage.type === 'ML_ALERT')) {
            loadAll();
            // Trigger flash effect for the shop
            if (lastMessage.entity_id) {
                setFlashShop(lastMessage.entity_id);
                setTimeout(() => setFlashShop(null), 5000);
            }
        }
    }, [lastMessage]);

    const handleDismissAlert = async (id) => {
        try {
            await api.patch(`/admin/dashboard/alerts/${id}/dismiss`);
            fetchAlerts(alerts.page);
            fetchSummary();
        } catch (err) {
            console.error("Failed to dismiss alert", err);
        }
    };

    const executeExport = async () => {
        try {
            const res = await api.get('/admin/dashboard/high-risk-shops/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'high_risk_shops.csv');
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (err) {
            console.error("Export failed", err);
        }
    };

    return (
        <div className={`${showHeader ? 'p-4 md:p-8' : 'p-0'} bg-gray-50`}>
            {/* Live Anomaly Banner */}
            {lastMessage && lastMessage.type === 'NEW_ANOMALY' && (
                <div className="mb-6 animate-bounce">
                    <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">🚨</span>
                            <div>
                                <h3 className="font-bold text-lg">CRITICAL ANOMALY DETECTED</h3>
                                <p className="text-red-100 italic">Shop ID: {lastMessage.entity_id} — System state updating...</p>
                            </div>
                        </div>
                        <div className="text-sm font-mono bg-red-700 px-3 py-1 rounded">
                            BLOCK_MINED: TRUE
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6">
                {showHeader && (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
                            <p className="text-gray-500 text-sm mt-1">District-level monitoring with AI fraud detection and blockchain verification.</p>
                        </div>
                        <button
                            onClick={loadAll}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <span className="text-lg leading-none">↻</span> Refresh Data
                        </button>
                    </div>
                )}

                <StatsBar
                    summary={summary.data}
                    loading={summary.loading}
                    error={summary.error}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 min-h-[400px]">
                        <LiveAlerts
                            alerts={alerts.data}
                            loading={alerts.loading}
                            error={alerts.error}
                            onDismiss={handleDismissAlert}
                            page={alerts.page}
                            setPage={fetchAlerts}
                            limit={alerts.limit}
                            total={alerts.total}
                        />
                    </div>
                    <div className="lg:col-span-2 min-h-[400px]">
                        <div className={flashShop ? 'ring-4 ring-red-500 rounded-xl transition-all duration-500' : ''}>
                            <HeatMap
                                heatmapData={heatmap.data}
                                loading={heatmap.loading}
                                error={heatmap.error}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="min-h-[400px]">
                        <div className={flashShop ? 'ring-4 ring-red-500 ring-opacity-50 rounded-xl animate-pulse' : ''}>
                            <HighRiskShopsTable
                                shops={shops.data}
                                loading={shops.loading}
                                error={shops.error}
                                onExport={executeExport}
                                page={shops.page}
                                setPage={fetchHighRiskShops}
                            />
                        </div>
                    </div>
                    <div className="min-h-[400px]">
                        <BlockchainRecent
                            transactions={blockchain.data}
                            loading={blockchain.loading}
                            error={blockchain.error}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default AdminOverviewPanel;
