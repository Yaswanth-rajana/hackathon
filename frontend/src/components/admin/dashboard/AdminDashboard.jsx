import React, { useState, useEffect } from 'react';
import api from '../../../api/api';

import StatsBar from './StatsBar';
import LiveAlerts from './LiveAlerts';
import HeatMap from './HeatMap';
import HighRiskShopsTable from './HighRiskShopsTable';
import BlockchainRecent from './BlockchainRecent';

const AdminDashboard = () => {
    const [summary, setSummary] = useState({ data: null, loading: true, error: null });
    const [alerts, setAlerts] = useState({ data: [], total: 0, loading: true, error: null, page: 1, limit: 10 });
    const [heatmap, setHeatmap] = useState({ data: [], loading: true, error: null });
    const [shops, setShops] = useState({ data: [], loading: true, error: null, page: 1, limit: 10 });
    const [blockchain, setBlockchain] = useState({ data: [], loading: true, error: null });

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
        // Parallel fetching gracefully degrades on individual failure due to internal try/catch
        Promise.all([
            fetchSummary(),
            fetchAlerts(1),
            fetchHeatmap(),
            fetchHighRiskShops(1),
            fetchBlockchain()
        ]);
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDismissAlert = async (id) => {
        try {
            await api.patch(`/admin/dashboard/alerts/${id}/dismiss`);
            // Re-fetch alerts specifically after dismissal to get next page sequence right
            fetchAlerts(alerts.page);
            // Also refetch summary since active alerts might affect top-level stats conceptually
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
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Overview Dashboard</h1>
                        <p className="text-gray-500 text-sm mt-1">District-level monitoring with AI fraud detection and blockchain verification.</p>
                    </div>
                    <button
                        onClick={loadAll}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <span className="text-lg leading-none">↻</span> Refresh Data
                    </button>
                </div>

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
                        <HeatMap
                            heatmapData={heatmap.data}
                            loading={heatmap.loading}
                            error={heatmap.error}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="min-h-[400px]">
                        <HighRiskShopsTable
                            shops={shops.data}
                            loading={shops.loading}
                            error={shops.error}
                            onExport={executeExport}
                            page={shops.page}
                            setPage={fetchHighRiskShops}
                        />
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
};

export default AdminDashboard;
