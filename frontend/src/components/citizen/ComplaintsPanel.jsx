import React, { useState, useEffect } from 'react';
import { citizenActions } from '../../services/citizenApi';
import { MessageSquareWarning, PlusCircle, CheckCircle, Scale, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

export default function ComplaintsPanel() {
    const [complaints, setComplaints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ complaint_type: 'quality', description: '', shop_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert } = useAlert();

    const fetchComplaints = async () => {
        setIsLoading(true);
        try {
            const data = await citizenActions.getComplaints();
            setComplaints(data);
        } catch (err) {
            showAlert("Failed to load complaints", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.description.length < 10) {
            showAlert("Please provide a more detailed description (min 10 characters).", "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await citizenActions.fileComplaint(formData);
            showAlert(`Grievance filed successfully. Reference ID: CMP${result.id || '001'}`, "success");
            setShowForm(false);
            setFormData({ complaint_type: 'quality', description: '', shop_id: '' });
            fetchComplaints();
        } catch (err) {
            showAlert(err.response?.data?.detail || "Failed to submit grievance", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeCount = complaints.filter(c => c.status !== 'resolved').length;
    const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-rose-600">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-50 rounded-2xl">
                        <Scale className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Public Grievance Portal</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Report irregularities for investigation</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <span className="block text-xl font-black text-rose-600">{activeCount}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Active</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-xl font-black text-emerald-500">{resolvedCount}</span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Resolved</span>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm ${showForm ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-100'
                            }`}
                    >
                        {showForm ? 'Cancel' : <><PlusCircle className="w-4 h-4" /> File New Grievance</>}
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-10 bg-[#FFF9F9] p-8 rounded-2xl border border-rose-100 shadow-inner">
                    <h4 className="text-sm font-black text-rose-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                        <MessageSquareWarning className="w-4 h-4 underline" />
                        Grievance Submission Form
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Grievance Category</label>
                            <select
                                value={formData.complaint_type}
                                onChange={e => setFormData({ ...formData, complaint_type: e.target.value })}
                                className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-3.5 border bg-white font-medium"
                            >
                                <option value="quality">Food Quality Issues</option>
                                <option value="quantity">Short Measure / Under-weighing</option>
                                <option value="behavior">Unprofessional Dealer Behavior</option>
                                <option value="availability">Stock Hoarding / Unavailability</option>
                                <option value="other">Other Protocol Violations</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Store ID (Defaults to Assigned)</label>
                            <input
                                type="text"
                                value={formData.shop_id}
                                onChange={e => setFormData({ ...formData, shop_id: e.target.value })}
                                placeholder="Enter FPS ID"
                                className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-3.5 border bg-white font-medium"
                            />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Detail Description (Minimum 10 Characters)</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                                rows={4}
                                className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-4 border bg-white font-medium leading-relaxed"
                                placeholder="Provide specific details about the incident, items involved, and time..."
                            />
                            <p className="text-[10px] text-rose-400 font-bold italic">Character Count: {formData.description.length}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            type="submit"
                            disabled={isSubmitting || formData.description.length < 10}
                            className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-rose-200 transition-all disabled:opacity-50 disabled:shadow-none"
                        >
                            {isSubmitting ? 'Registering...' : 'Register Official Grievance'}
                        </button>
                        <div className="px-4 py-4 bg-white border border-rose-100 rounded-xl flex items-center gap-3 text-rose-800 text-[10px] font-bold uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Directly sent to District Collectorate
                        </div>
                    </div>
                </form>
            )}

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    {[1, 2].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl"></div>)}
                </div>
            ) : complaints.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-500" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Safe Record: No Complaints</p>
                    <p className="text-xs text-gray-400">Everything seems to be working correctly with your distributions.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {complaints.map(complaint => (
                        <div key={complaint.id} className="p-5 border border-gray-100 rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-rose-200 hover:shadow-md transition-all">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-900 font-black text-[9px] uppercase tracking-[0.15em] rounded">
                                        {complaint.complaint_type}
                                    </span>
                                    <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest px-1">
                                        CMP{complaint.id.toString().padStart(3, '0')}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-gray-700 leading-relaxed mb-3 pr-4">{complaint.description}</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(complaint.created_at).toLocaleDateString()}
                                    </div>
                                    {complaint.shop_id && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                                            <Store className="w-3.5 h-3.5" />
                                            {complaint.shop_id}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${complaint.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        complaint.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                            'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>
                                    {complaint.status.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
