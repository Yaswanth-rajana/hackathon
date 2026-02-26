import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Bell, Shield, AlertTriangle, Info, Search,
    Filter, Clock, MapPin, ChevronRight, Eye,
    CheckCircle2, AlertCircle, ExternalLink,
    MoreVertical, X, ArrowRight, User, BrainCircuit, Brain
} from 'lucide-react';
import { useDistrict } from '../../context/DistrictContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminWebSocket } from '../../context/WebSocketContext';

const SEVERITY_STYLES = {
    CRITICAL: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-100',
        stripe: 'bg-red-500',
        icon: <AlertCircle size={14} className="text-red-600" />
    },
    HIGH: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-100',
        stripe: 'bg-orange-500',
        icon: <AlertTriangle size={14} className="text-orange-600" />
    },
    MEDIUM: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-100',
        stripe: 'bg-yellow-500',
        icon: <Info size={14} className="text-yellow-600" />
    },
    INFO: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-100',
        stripe: 'bg-blue-500',
        icon: <Bell size={14} className="text-blue-600" />
    }
};

const STATUS_COLORS = {
    OPEN: 'bg-red-100 text-red-800',
    ACKNOWLEDGED: 'bg-blue-100 text-blue-800',
    INVESTIGATING: 'bg-amber-100 text-amber-800',
    RESOLVED: 'bg-green-100 text-green-800',
    ESCALATED: 'bg-purple-100 text-purple-800'
};

const AlertsPage = () => {
    const { selectedDistrict } = useDistrict();
    const { user } = useAuth();
    const { lastMessage } = useAdminWebSocket();

    const [alerts, setAlerts] = useState([]);
    const [stats, setStats] = useState({ critical: 0, high: 0, medium: 0, info: 0 });
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [filters, setFilters] = useState({
        severity: '',
        status: '',
        dateRange: '24h'
    });

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const params = {
                district: selectedDistrict !== "Andhra Pradesh (HQ)" ? selectedDistrict : null,
                severity: filters.severity || null,
                status: filters.status || null,
                limit: 50
            };
            const [alertsRes, statsRes] = await Promise.all([
                axios.get('/api/admin/alerts', { params }),
                axios.get('/api/admin/alerts/stats', { params: { district: params.district } })
            ]);
            setAlerts(alertsRes.data.items || []);
            setStats(statsRes.data || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, INFO: 0 });
        } catch (error) {
            console.error("Failed to fetch alerts:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedDistrict, filters]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // WebSocket refresh
    useEffect(() => {
        if (lastMessage?.type === 'NEW_ALERT') {
            fetchAlerts();
        }
    }, [lastMessage, fetchAlerts]);

    const handleStatusUpdate = async (alertId, newStatus) => {
        try {
            await axios.patch(`/api/admin/alerts/${alertId}/status`, {
                status: newStatus,
                acknowledged_by: user?.name
            });
            fetchAlerts();
            if (selectedAlert?.id === alertId) {
                const updated = await axios.get(`/api/admin/alerts/${alertId}`);
                setSelectedAlert(updated.data);
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            alert(error.response?.data?.detail || "Action failed. Check governance workflow rules.");
        }
    };

    const handleCreateInspection = async () => {
        if (!selectedAlert) return;
        try {
            await axios.post('/api/admin/governance/inspections', {
                shop_id: selectedAlert.entity_id,
                triggered_by: 'anomaly',
                trigger_reference: selectedAlert.id,
                inspector_id: user?.id || 'ADMIN_USER',
                priority: selectedAlert.severity === 'CRITICAL' ? 'critical' : (selectedAlert.severity === 'HIGH' ? 'high' : 'normal')
            }, { withCredentials: true });
            alert('Inspection tracking initialized successfully!');
            setSelectedAlert(null);
        } catch (error) {
            console.error("Failed to create inspection:", error);
            alert("Failed to create inspection.");
        }
    };

    const StatusBadge = ({ status }) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${STATUS_COLORS[status]}`}>
            {status}
        </span>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#1E3A8A]">Alerts & Notifications</h1>
                    <div className="flex items-center gap-2 text-sm text-[#6B7280] mt-1">
                        <MapPin size={14} />
                        <span>District Monitoring: <b>{selectedDistrict}</b></span>
                        <span className="mx-2">•</span>
                        <Clock size={14} />
                        <span>Last Updated: Just now</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#374151] focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                        value={filters.severity}
                        onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                    >
                        <option value="">All Severities</option>
                        <option value="critical">Critical Only</option>
                        <option value="high">High Severity</option>
                        <option value="medium">Medium</option>
                        <option value="info">Informational</option>
                    </select>

                    <select
                        className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#374151] focus:ring-2 focus:ring-[#1E3A8A] outline-none"
                        value={filters.dateRange}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Critical Alerts', count: stats?.CRITICAL || 0, key: 'CRITICAL' },
                    { label: 'High Alerts', count: stats?.HIGH || 0, key: 'HIGH' },
                    { label: 'Medium Alerts', count: stats?.MEDIUM || 0, key: 'MEDIUM' },
                    { label: 'Informational', count: stats?.INFO || 0, key: 'INFO' }
                ].map((item) => (
                    <div key={item.key} className={`bg-white rounded-xl border-l-4 ${SEVERITY_STYLES[item.key]?.stripe.replace('bg-', 'border-') || 'border-gray-100'} shadow-sm p-4 border border-[#E5E7EB]`}>
                        <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">{item.label}</p>
                        <h3 className="text-2xl font-bold text-[#1F2937] mt-1">{item.count}</h3>
                    </div>
                ))}
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider w-32">Severity</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Entity</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Detected By</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Time</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                            {loading ? (
                                <tr><td colSpan="8" className="px-6 py-8 text-center text-[#6B7280]">Loading alerts...</td></tr>
                            ) : (!alerts || alerts.length === 0) ? (
                                <tr><td colSpan="8" className="px-6 py-8 text-center text-[#6B7280]">No active alerts for this selection.</td></tr>
                            ) : (
                                alerts.map((alert) => (
                                    <tr key={alert.id} className="hover:bg-[#F9FAFB] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${SEVERITY_STYLES[alert.severity]?.bg || 'bg-gray-50'} ${SEVERITY_STYLES[alert.severity]?.text || 'text-gray-700'} ${SEVERITY_STYLES[alert.severity]?.border || 'border-gray-100'} text-[10px] font-bold uppercase`}>
                                                {SEVERITY_STYLES[alert.severity]?.icon || <Bell size={14} />}
                                                {alert.severity}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[13px] font-semibold text-[#1F2937]">{alert.type.replace(/_/g, ' ')}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-[#1E3A8A]">{alert.entity_id}</span>
                                                <span className="text-[10px] text-[#9CA3AF]">{alert.district}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-[13px] text-[#4B5563] truncate">{alert.description}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                                                {alert.detected_by === 'ML' ? <BrainCircuit size={14} className="text-[#8B5CF6]" /> : <Shield size={14} />}
                                                {alert.detected_by}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-[12px] text-[#6B7280]">
                                                <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="text-[10px] text-[#9CA3AF]">{new Date(alert.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={alert.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedAlert(alert)}
                                                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1E3A8A] hover:underline"
                                            >
                                                View <ChevronRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alert Detail Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className={`px-6 py-4 border-b flex justify-between items-center ${SEVERITY_STYLES[selectedAlert.severity]?.bg || 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-white border ${SEVERITY_STYLES[selectedAlert.severity]?.border || 'border-gray-100'}`}>
                                    {SEVERITY_STYLES[selectedAlert.severity]?.icon || <Bell size={14} />}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#1F2937] leading-tight flex items-center gap-2">
                                        Alert Details: {selectedAlert.id}
                                        <StatusBadge status={selectedAlert.status} />
                                    </h2>
                                    <p className="text-xs text-[#6B7280]">{selectedAlert.type.replace(/_/g, ' ')}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                                <X size={20} className="text-[#6B7280]" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Affected Entity</label>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-[#F3F4F6] rounded text-[#1E3A8A]">
                                            <Shield size={16} />
                                        </div>
                                        <span className="text-sm font-bold text-[#1F2937]">{selectedAlert.entity_id}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Jurisdiction</label>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-[#F3F4F6] rounded text-[#1E3A8A]">
                                            <MapPin size={16} />
                                        </div>
                                        <span className="text-sm font-bold text-[#1F2937]">{selectedAlert.district}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Description</label>
                                <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
                                    <p className="text-sm text-[#374151] leading-relaxed italic">
                                        "{selectedAlert.description}"
                                    </p>
                                </div>
                            </div>

                            {/* Blockchain Integration */}
                            {selectedAlert.block_index && (
                                <div className="p-4 bg-gradient-to-r from-[#171717] to-[#262626] rounded-xl text-white">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Fingerprint size={18} className="text-blue-400" />
                                            <span className="text-sm font-bold tracking-tight">Ledger Traceability</span>
                                        </div>
                                        <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">Signed</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Blockchain Reference</p>
                                            <p className="text-sm font-mono font-bold">Block #{selectedAlert.block_index}</p>
                                        </div>
                                        <button className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-white/5 py-2 px-3 rounded-lg border border-white/10">
                                            Verify Integrity <ExternalLink size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Audit Trail */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider border-b border-[#F3F4F6] pb-2">Audit Trace</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                            <div className="w-0.5 h-full bg-gray-100" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#1F2937]">Alert Created</p>
                                            <p className="text-xs text-[#6B7280]">Detected by {selectedAlert.detected_by} system</p>
                                            <p className="text-[10px] text-[#9CA3AF]">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {selectedAlert.acknowledged_by && (
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                <div className="w-0.5 h-full bg-gray-100" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[#1F2937]">Officer Acknowledged</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <User size={12} className="text-[#6B7280]" />
                                                    <span className="text-xs text-[#4B5563]">{selectedAlert.acknowledged_by}</span>
                                                </div>
                                                <p className="text-[10px] text-[#9CA3AF]">{new Date(selectedAlert.updated_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                    {selectedAlert.resolved_at && (
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[#1F2937]">Issue Resolved</p>
                                                <p className="text-xs text-[#6B7280]">Case closed for {selectedAlert.entity_id}</p>
                                                <p className="text-[10px] text-[#9CA3AF]">{new Date(selectedAlert.resolved_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer (Governance Actions) */}
                        <div className="p-6 bg-[#F9FAFB] border-t flex justify-between items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Current Status</span>
                                <span className="text-sm font-bold text-[#1F2937]">{selectedAlert.status}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                {selectedAlert.status === 'OPEN' && (
                                    <button
                                        onClick={() => handleStatusUpdate(selectedAlert.id, 'ACKNOWLEDGED')}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1E3A8A] text-white text-sm font-bold rounded-xl hover:bg-[#1e3a8aed] transition-all shadow-md active:scale-95"
                                    >
                                        <CheckCircle2 size={16} />
                                        Acknowledge
                                    </button>
                                )}
                                {selectedAlert.status === 'ACKNOWLEDGED' && (
                                    <button
                                        onClick={() => handleStatusUpdate(selectedAlert.id, 'INVESTIGATING')}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md active:scale-95"
                                    >
                                        <Search size={16} />
                                        Move to Investigation
                                    </button>
                                )}
                                {selectedAlert.status === 'INVESTIGATING' && (
                                    <>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedAlert.id, 'ESCALATED')}
                                            className="px-4 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all"
                                        >
                                            Escalate
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(selectedAlert.id, 'RESOLVED')}
                                            className="px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all"
                                        >
                                            Mark Resolved
                                        </button>
                                        <button
                                            onClick={handleCreateInspection}
                                            className="px-4 py-2.5 bg-[#1E3A8A] text-white text-sm font-bold rounded-xl hover:bg-[#1e3a8a]/90 shadow-md transition-all flex items-center gap-2"
                                        >
                                            <Shield size={16} />
                                            Create Inspection
                                        </button>
                                    </>
                                )}
                                {selectedAlert.status === 'ESCALATED' && (
                                    <button
                                        onClick={() => handleStatusUpdate(selectedAlert.id, 'INVESTIGATING')}
                                        className="px-4 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-all"
                                    >
                                        Return to Investigation
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertsPage;
