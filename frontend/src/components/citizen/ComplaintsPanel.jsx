import React, { useState, useEffect, useRef } from 'react';
import { citizenActions } from '../../services/citizenApi';
import { MessageSquareWarning, PlusCircle, CheckCircle, Scale, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

export default function ComplaintsPanel() {
    const [complaints, setComplaints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        complaint_type: 'quality',
        description: '',
        shop_id: '',
        severity: 'minor',
        is_anonymous: false,
        attachment_url: null
    });
    const [selectedAttachment, setSelectedAttachment] = useState(null);
    const [shopData, setShopData] = useState(null);
    const [lastSubmission, setLastSubmission] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const { showAlert } = useAlert();

    const fetchComplaints = async () => {
        setIsLoading(true);
        try {
            const [complaintsData, shopInfo, profile] = await Promise.all([
                citizenActions.getComplaints(),
                citizenActions.getShop(),
                citizenActions.getProfile()
            ]);
            setComplaints(complaintsData);
            setShopData(shopInfo);
            setFormData(prev => ({ ...prev, shop_id: profile?.shop_id || '' }));
        } catch (err) {
            showAlert("Failed to load dashboard data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchComplaints();
    }, []);

    const handleAttachmentChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxBytes = 5 * 1024 * 1024;
        if (file.size > maxBytes) {
            showAlert("File size exceeds 5MB limit.", "warning");
            e.target.value = '';
            return;
        }

        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            showAlert("Only image/video files are allowed.", "warning");
            e.target.value = '';
            return;
        }

        setSelectedAttachment(file);
        setFormData(prev => ({ ...prev, attachment_url: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanDesc = formData.description.trim();
        if (cleanDesc.length < 10) {
            showAlert("Please provide a more detailed description (min 10 characters).", "warning");
            return;
        }

        setIsSubmitting(true);
        try {
            let attachmentUrl = formData.attachment_url || null;
            if (selectedAttachment) {
                const uploaded = await citizenActions.uploadComplaintAttachment(selectedAttachment);
                attachmentUrl = uploaded?.url || null;
            }

            const result = await citizenActions.fileComplaint({
                ...formData,
                description: cleanDesc,
                attachment_url: attachmentUrl
            });
            setLastSubmission(result);
            showAlert(`Grievance filed successfully. Recorded on-chain at Block #${result.block_index}`, "success");
            setShowForm(false);
            setFormData({
                complaint_type: 'quality',
                description: '',
                shop_id: formData.shop_id || '',
                severity: 'minor',
                is_anonymous: false,
                attachment_url: null
            });
            setSelectedAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                <form onSubmit={handleSubmit} className="mb-10 bg-[#FFF9F9] p-8 rounded-2xl border border-rose-100 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Scale className="w-32 h-32 text-rose-900" />
                    </div>

                    <h4 className="text-sm font-black text-rose-900 mb-6 uppercase tracking-widest flex items-center gap-2 relative z-10">
                        <MessageSquareWarning className="w-4 h-4" />
                        Official Grievance Submission
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 relative z-10">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Grievance Category</label>
                            <select
                                value={formData.complaint_type}
                                onChange={e => setFormData({ ...formData, complaint_type: e.target.value })}
                                className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-3.5 border bg-white font-bold"
                            >
                                <option value="quality">Food Quality Issues</option>
                                <option value="quantity">Short Measure / Under-weighing</option>
                                <option value="behavior">Unprofessional Dealer Behavior</option>
                                <option value="availability">Stock Hoarding / Unavailability</option>
                                <option value="other">Other Protocol Violations</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Store ID (Auto-Filled)</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={formData.shop_id}
                                    onChange={e => setFormData({ ...formData, shop_id: e.target.value })}
                                    placeholder="Enter FPS ID"
                                    className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-3.5 border bg-gray-50/50 font-bold"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <ShieldCheck className="w-4 h-4 text-rose-300" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Severity Level</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'minor', label: 'Minor', color: 'bg-emerald-500', text: 'text-emerald-700' },
                                    { id: 'major', label: 'Major', color: 'bg-amber-500', text: 'text-amber-700' },
                                    { id: 'urgent', label: 'Urgent', color: 'bg-rose-600', text: 'text-rose-700' }
                                ].map(level => (
                                    <button
                                        key={level.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, severity: level.id })}
                                        className={`py-2 px-1 rounded-lg border text-[9px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 ${formData.severity === level.id
                                            ? `border-gray-900 bg-white shadow-sm`
                                            : `border-transparent bg-gray-100 text-gray-400 opacity-60`
                                            }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${level.color}`} />
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Anonymous Mode</label>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, is_anonymous: !prev.is_anonymous }))}
                                className={`w-full flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${formData.is_anonymous ? 'bg-rose-50 border-rose-200' : 'bg-white border-rose-100'
                                    }`}
                                aria-pressed={formData.is_anonymous}
                            >
                                <span className={`text-[10px] font-bold ${formData.is_anonymous ? 'text-rose-900' : 'text-gray-400'}`}>
                                    {formData.is_anonymous ? 'Identity Shielded' : 'Identity Shared'}
                                </span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.is_anonymous ? 'bg-rose-600' : 'bg-gray-200'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${formData.is_anonymous ? 'left-4.5' : 'left-0.5'}`} />
                                </div>
                            </button>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Detailed Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                                rows={3}
                                className="w-full text-sm border-rose-100 rounded-xl focus:ring-rose-500 focus:border-rose-500 p-4 border bg-white font-medium leading-relaxed"
                                placeholder="Describe the issue specifically. Include date, time, and specific items..."
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-rose-900 mb-1 uppercase tracking-widest">Attach Evidence (Optional)</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={handleAttachmentChange}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-1 w-full flex justify-center px-6 pt-5 pb-6 border-2 border-rose-100 border-dashed rounded-xl hover:bg-rose-50/30 transition-colors cursor-pointer group"
                            >
                                <div className="space-y-1 text-center">
                                    <PlusCircle className="mx-auto h-8 w-8 text-rose-300 group-hover:text-rose-500 transition-colors" />
                                    <div className="flex text-[10px] text-rose-600 font-bold uppercase tracking-widest">
                                        <span>{selectedAttachment ? 'Change File' : 'Upload Image/Video'}</span>
                                    </div>
                                    <p className="text-[9px] text-rose-400">
                                        {selectedAttachment ? `${selectedAttachment.name} (${Math.ceil(selectedAttachment.size / 1024)} KB)` : 'Max size 5MB'}
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-rose-200 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Registering Grievance...' : 'Submit Certified Grievance'}
                        </button>
                        <div className="px-4 py-4 bg-white border border-rose-100 rounded-xl flex items-center gap-3 text-rose-800 text-[9px] font-black uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Escalated to D.C. Oversight
                        </div>
                    </div>

                    {formData.is_anonymous && (
                        <p className="mt-3 text-[9px] text-rose-400 italic font-medium leading-tight">
                            * Anonymous Mode hide details from dealer, but district officials retain access for investigation.
                        </p>
                    )}
                </form>
            )}

            {lastSubmission && !showForm && (
                <div className="mb-10 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl animate-bounce-subtle">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Complaint Registered Successfully</h4>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Reference ID: {lastSubmission.id}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-emerald-100/50 mb-4">
                        <div>
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mb-1">Status</p>
                            <p className="text-[10px] font-black text-emerald-800 uppercase">Investigating</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mb-1">Expected By</p>
                            <p className="text-[10px] font-black text-emerald-800 uppercase">3-5 Working Days</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mb-1">Block Index</p>
                            <p className="text-[10px] font-monospace font-bold text-emerald-800">#{lastSubmission.block_index}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mb-1">On-Chain</p>
                            <div className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span className="text-[9px] font-bold text-emerald-800 uppercase">Verified</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Hash:</p>
                            <p className="text-[9px] font-monospace text-emerald-700 opacity-60 truncate w-32 md:w-auto">{lastSubmission.block_hash}</p>
                        </div>
                        <button
                            onClick={() => setLastSubmission(null)}
                            className="text-[9px] font-black text-emerald-700 uppercase tracking-widest hover:underline"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    {[1, 2].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl"></div>)}
                </div>
            ) : complaints.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-500" />
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">✔ No active grievances</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">Your assigned shop (ID: {shopData?.id || '...'}) is operating normally.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {complaints.map(complaint => (
                        <div key={complaint.id} className="p-5 border border-gray-100 rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-rose-200 hover:shadow-md transition-all">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${complaint.severity === 'urgent' ? 'bg-rose-600' : complaint.severity === 'major' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                        <span className={`font-black text-[9px] uppercase tracking-[0.15em] ${complaint.severity === 'urgent' ? 'text-rose-600' : complaint.severity === 'major' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {complaint.severity || 'normal'}
                                        </span>
                                    </div>
                                    <span className="text-gray-300 font-bold">•</span>
                                    <span className="px-2 py-0.5 bg-gray-50 text-gray-700 font-black text-[9px] uppercase tracking-[0.15em] rounded">
                                        {complaint.complaint_type}
                                    </span>
                                    <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest px-1">
                                        {complaint.id}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-gray-700 leading-relaxed mb-3 pr-4">{complaint.description}</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(complaint.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                                        < ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        On-Chain Block #{complaint.block_index}
                                    </div>
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
