import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Plus, FileText, CheckCircle2, AlertTriangle,
    MapPin, Clock, Upload, ArrowRight, X
} from 'lucide-react';
import { useAdminWebSocket } from '../../../context/WebSocketContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const InspectionsPage = () => {
    const [inspections, setInspections] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, confirmed_fraud_pct: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active'); // active | completed

    // Modal state
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [findingsText, setFindingsText] = useState('');
    const [actionText, setActionText] = useState('');

    useEffect(() => {
        fetchInspections();
        fetchStats();
    }, []);

    const fetchInspections = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/governance/inspections`, { withCredentials: true });
            setInspections(res.data);
        } catch (err) {
            console.error("Failed to fetch inspections", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/governance/inspections/stats`, { withCredentials: true });
            setStats(res.data);
        } catch (err) {
            console.error("Failed to fetch inspection stats", err);
        }
    };

    const handleStart = async (id) => {
        try {
            await axios.patch(`${API_URL}/api/admin/governance/inspections/${id}/start`, {}, { withCredentials: true });
            fetchInspections();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const handleComplete = async () => {
        if (!selectedInspection) return;
        try {
            await axios.patch(`${API_URL}/api/admin/governance/inspections/${selectedInspection.id}/complete`, {
                findings: findingsText,
                evidence_urls: ["s3/evidence-mock.jpg"]
            }, { withCredentials: true });
            setActionModalOpen(false);
            setSelectedInspection(null);
            setFindingsText('');
            fetchInspections();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAction = async () => {
        if (!selectedInspection) return;
        try {
            await axios.patch(`${API_URL}/api/admin/governance/inspections/${selectedInspection.id}/action`, {
                action_taken: actionText
            }, { withCredentials: true });
            setActionModalOpen(false);
            setSelectedInspection(null);
            setActionText('');
            fetchInspections();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredInspections = inspections.filter(i => {
        if (activeTab === 'active') return ['scheduled', 'in_progress'].includes(i.status);
        return ['completed', 'action_taken'].includes(i.status);
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[#1E3A8A]">Governance Inspections</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage field operations, record findings, and enforce actions</p>
                </div>
                <button className="flex items-center gap-2 bg-[#1E3A8A] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#1e3a8a]/90">
                    <Plus size={18} /> New Inspection
                </button>
            </div>

            {/* OVERVIEW CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Inspections', value: stats.total, icon: <FileText size={20} className="text-blue-600" />, bg: 'bg-blue-50' },
                    { label: 'Active', value: stats.active, icon: <Clock size={20} className="text-orange-600" />, bg: 'bg-orange-50' },
                    { label: 'Completed', value: stats.completed, icon: <CheckCircle2 size={20} className="text-green-600" />, bg: 'bg-green-50' },
                    { label: 'Fraud Confirmed %', value: `${stats.confirmed_fraud_pct}%`, icon: <AlertTriangle size={20} className="text-red-600" />, bg: 'bg-red-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* TABS & LIST */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active' ? 'border-[#1E3A8A] text-[#1E3A8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Active Inspections
                    </button>
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'completed' ? 'border-[#1E3A8A] text-[#1E3A8A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Completed & Actions
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 flex justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search ID, Shop..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <Filter size={16} /> Filters
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-900 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">ID & Shop</th>
                                <th className="px-6 py-4 font-semibold">Triggered By</th>
                                <th className="px-6 py-4 font-semibold">Priority</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading tracking...</td></tr>
                            ) : filteredInspections.length === 0 ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No inspections found in this category.</td></tr>
                            ) : (
                                filteredInspections.map(ins => (
                                    <tr key={ins.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{ins.id}</div>
                                            <div className="text-xs text-gray-500">{ins.shop_id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                                                {ins.triggered_by}
                                            </span>
                                            <div className="text-[10px] text-gray-500 mt-1">{ins.trigger_reference}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${ins.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                                    ins.priority === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}
                                            >
                                                {ins.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium capitalize">{ins.status.replace('_', ' ')}</div>
                                            {ins.blockchain_txn_id && (
                                                <div className="text-[10px] text-blue-600 mt-0.5">Tx: {ins.blockchain_txn_id}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {ins.status === 'scheduled' && (
                                                <button onClick={() => handleStart(ins.id)} className="text-sm font-semibold text-[#1E3A8A] hover:underline">Start</button>
                                            )}
                                            {ins.status === 'in_progress' && (
                                                <button onClick={() => { setSelectedInspection(ins); setActionModalOpen(true); }} className="text-sm font-semibold text-green-600 hover:underline">Complete</button>
                                            )}
                                            {ins.status === 'completed' && (
                                                <button onClick={() => { setSelectedInspection(ins); setActionModalOpen(true); }} className="text-sm font-semibold text-amber-600 hover:underline">Take Action</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ACTION MODAL */}
            {actionModalOpen && selectedInspection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">
                                {selectedInspection.status === 'in_progress' ? 'Complete Inspection' : 'Enforce Action'}
                            </h3>
                            <button onClick={() => setActionModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 font-bold uppercase">Inspection ID</p>
                                <p className="font-mono text-gray-900">{selectedInspection.id}</p>
                                <p className="text-xs text-gray-500 font-bold uppercase mt-3">Shop ID</p>
                                <p className="font-medium text-[#1E3A8A]">{selectedInspection.shop_id}</p>
                            </div>

                            {selectedInspection.status === 'in_progress' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Findings Summary</label>
                                        <textarea
                                            rows={4}
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] outline-none"
                                            placeholder="e.g. Ghost beneficiaries confirmed, stock mismatch found..."
                                            value={findingsText}
                                            onChange={e => setFindingsText(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Evidence (Mock UI)</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                                            <Upload size={24} className="mb-2" />
                                            <span className="text-sm">Click to upload photos</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                        <p className="text-xs text-orange-800 font-bold uppercase mb-1">Confirmed Findings</p>
                                        <p className="text-sm text-orange-900 italic">"{selectedInspection.findings}"</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Recommended Action</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A] outline-none"
                                            value={actionText}
                                            onChange={e => setActionText(e.target.value)}
                                        >
                                            <option value="">Select an action...</option>
                                            <option value="Suspend dealer for 30 days">Suspend dealer for 30 days</option>
                                            <option value="Issue warning notice">Issue warning notice</option>
                                            <option value="Recommend FIR">Recommend FIR</option>
                                            <option value="No action required">No action required</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setActionModalOpen(false)}
                                className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={selectedInspection.status === 'in_progress' ? handleComplete : handleAction}
                                className="px-5 py-2 bg-[#1E3A8A] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-[#1e3a8a]/90 flex items-center gap-2"
                            >
                                Submit <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default InspectionsPage;
