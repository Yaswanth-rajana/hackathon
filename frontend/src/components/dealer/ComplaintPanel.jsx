import { MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import dealerApi from '../../services/dealerApi';
import { useAlert } from '../../context/AlertContext';
import { useState } from 'react';
import ConfirmationDialog from '../common/ConfirmationDialog';

export default function ComplaintPanel({ complaints, setComplaints }) {
    const { showAlert } = useAlert();
    const [resolvingId, setResolvingId] = useState(null);
    const [showConfirmId, setShowConfirmId] = useState(null);

    const handleResolve = async () => {
        if (!showConfirmId) return;
        const id = showConfirmId;

        setShowConfirmId(null);
        setResolvingId(id);

        // Optimistic Update
        const previous = [...complaints];
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' } : c));

        try {
            await dealerApi.patch(`/dealer/complaints/${id}/resolve`);
            showAlert('Complaint resolved successfully.', 'success');
        } catch (err) {
            // Revert on failure
            setComplaints(previous);
            showAlert('Failed to resolve complaint.', 'error');
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> RECENT COMPLAINTS
                </h2>
                <span className="bg-[#B91C1C] text-white text-xs font-bold px-2 py-0.5 rounded-sm">
                    {complaints?.filter(c => ['open', 'pending', 'new'].includes((c.status || '').toLowerCase())).length || 0} Open
                </span>
            </div>

            <div className="p-0 flex-grow overflow-auto max-h-[300px]">
                {!complaints || complaints.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center justify-center h-full">
                        <CheckCircle className="w-8 h-8 text-green-500 mb-2 opacity-50" />
                        No complaints found.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-[#D1D5DB] text-gray-600 text-xs uppercase font-semibold sticky top-0">
                            <tr>
                                <th className="px-4 py-2">ID</th>
                                <th className="px-4 py-2">Type</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {complaints.map((c) => (
                                <tr key={c.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{(c.id || '').substring(0, 12)}</td>
                                    <td className="px-4 py-3 text-gray-900 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            {(c.complaint_type === 'stock_diverted' || c.type === 'stock_diverted') && <AlertCircle className="w-3.5 h-3.5 text-[#B91C1C]" />}
                                            {(c.complaint_type || c.type || 'Unknown').replace(/_/g, ' ')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm border ${(c.status || '').toLowerCase() === 'resolved'
                                            ? 'bg-[#F0FDF4] text-[#1B5E20] border-[#1B5E20]/20'
                                            : 'bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/20'
                                            }`}>
                                            {c.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {(c.status || '').toLowerCase() !== 'resolved' && (
                                            <button
                                                onClick={() => setShowConfirmId(c.id)}
                                                disabled={resolvingId === c.id}
                                                className="text-xs font-semibold text-[#005A9C] hover:text-[#003366] hover:underline disabled:opacity-50"
                                            >
                                                {resolvingId === c.id ? 'Processing...' : 'Resolve'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmationDialog
                isOpen={!!showConfirmId}
                title="Resolve Complaint"
                message="Are you sure you want to mark this complaint as resolved? Ensure all physical verifications are complete."
                confirmText="Mark Resolved"
                onConfirm={handleResolve}
                onCancel={() => setShowConfirmId(null)}
            />
        </div>
    );
}
