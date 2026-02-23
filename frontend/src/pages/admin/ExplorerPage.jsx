import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import { Database, ShieldCheck, Clock, Hash, ShieldAlert } from 'lucide-react';

const ExplorerPage = () => {
    const [blocks, setBlocks] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState(null);

    const fetchBlocks = async (p = 1) => {
        try {
            setLoading(true);
            const res = await api.get(`/blockchain/blocks?page=${p}&limit=${limit}`);
            setBlocks(res.data.data || []);
            setTotal(res.data.total || 0);
            setPage(p);
        } catch (err) {
            console.error('Failed to fetch blocks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        try {
            setVerifying(true);
            const res = await api.get('/blockchain/verify');
            setVerifyStatus(res.data.status);
            setTimeout(() => setVerifyStatus(null), 5000);
        } catch (err) {
            console.error('Chain verification failed:', err);
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        fetchBlocks(1);
    }, []);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Database className="w-6 h-6 text-blue-600" /> Blockchain Explorer
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Independent verification of the immutable ration distribution ledger.
                    </p>
                </div>
                <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 shadow-sm ${verifying
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                        }`}
                >
                    {verifying ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            Verifying Integrity...
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="w-4 h-4" /> Verify Chain Integrity
                        </>
                    )}
                </button>
            </div>

            {verifyStatus && (
                <div className={`p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${verifyStatus === 'VALID'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                    {verifyStatus === 'VALID' ? (
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                    ) : (
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                    )}
                    <div className="font-semibold">
                        Chain Integrity Status: {verifyStatus}
                        <p className="text-xs font-normal opacity-80">
                            {verifyStatus === 'VALID'
                                ? 'All block hashes and cryptographic signatures matched perfectly.'
                                : 'WARNING: Potential chain mutation detected. Contact security immediately.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-gray-500 font-semibold uppercase text-xs tracking-wider">
                            <th className="py-3 px-6">Index</th>
                            <th className="py-3 px-6">Block Hash</th>
                            <th className="py-3 px-6">Timestamp</th>
                            <th className="py-3 px-6">Transaction ID</th>
                            <th className="py-3 px-6">Validator</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                                        <span className="text-gray-400 font-medium">Reconstructing Chain...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : blocks.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-20 text-center text-gray-500 italic">
                                    Genesis block not yet confirmed.
                                </td>
                            </tr>
                        ) : (
                            blocks.map((block) => (
                                <tr key={block.index} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="py-4 px-6 border-l-4 border-blue-500/0 hover:border-blue-500 font-bold text-gray-900">
                                        #{block.index}
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Hash className="w-3 h-3 text-gray-400" />
                                                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                    {block.hash}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-50">
                                                <small className="text-[10px] text-gray-400 font-mono">Prev: {block.previous_hash}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-gray-500 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 opacity-40" />
                                            {new Date(block.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {block.transactions && block.transactions.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {block.transactions.map((tx, idx) => (
                                                    <span key={idx} className="font-mono text-xs text-gray-600 block">
                                                        {tx.transaction_id || 'System Event'}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">Genesis Payload</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-tighter">
                                            {block.validator || 'Node-0-Primary'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm">
                    <div className="text-gray-500">
                        Showing <span className="font-semibold text-gray-900">{(page - 1) * limit + 1}</span> to{' '}
                        <span className="font-semibold text-gray-900">{Math.min(page * limit, total)}</span> of{' '}
                        <span className="font-semibold text-gray-900">{total}</span> blocks
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => fetchBlocks(page - 1)}
                            className="px-3 py-1 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm font-medium"
                        >
                            Previous
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => fetchBlocks(page + 1)}
                            className="px-3 py-1 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm font-medium"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExplorerPage;
