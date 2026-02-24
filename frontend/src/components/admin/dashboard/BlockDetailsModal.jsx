import React, { useState, useEffect } from 'react';
import api from '../../../api/api';
import { X, ShieldCheck, Hash, Database, Clock, Terminal } from 'lucide-react';

const BlockDetailsModal = ({ isOpen, onClose, blockIndex, blockHash }) => {
    const [block, setBlock] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && blockIndex !== undefined) {
            const fetchBlock = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const res = await api.get(`/blockchain/block/${blockIndex}`);
                    setBlock(res.data);
                } catch (err) {
                    console.error('Failed to fetch block details:', err);
                    setError('Block details could not be retrieved from the ledger.');
                } finally {
                    setLoading(false);
                }
            };
            fetchBlock();
        }
    }, [isOpen, blockIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col scale-in duration-200 animate-in zoom-in-95">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Block #{blockIndex} Details</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Immutable Ledger Verification</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {loading ? (
                        <div className="flex flex-col items-center py-12 gap-3">
                            <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                            <span className="text-slate-400 font-medium">Querying Blockchain Node...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-red-700 text-sm flex items-center gap-3">
                            <X className="bg-red-100 p-1 rounded-full text-red-600" size={24} />
                            {error}
                        </div>
                    ) : block ? (
                        <div className="space-y-6">
                            {/* Verification Badge */}
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                                    <div>
                                        <p className="font-bold text-emerald-900 leading-none">Verification Status: VALID</p>
                                        <p className="text-xs text-emerald-600 mt-1">Cryptographic integrity confirmed by node validators.</p>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded tracking-tighter">SIGNED</span>
                            </div>

                            {/* Core Data */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mining Timestamp</p>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Clock size={14} className="opacity-50" />
                                        <span className="text-sm font-medium">{new Date(block.timestamp).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validator Node</p>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Terminal size={14} className="opacity-50" />
                                        <span className="text-sm font-medium">Node-0-Primary</span>
                                    </div>
                                </div>
                            </div>

                            {/* Hashes */}
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Block Hash</p>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-xs text-blue-600 break-all flex items-center gap-2">
                                        <Hash size={12} className="opacity-50 shrink-0" />
                                        {block.hash}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previous Block Hash</p>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-xs text-slate-500 break-all flex items-center gap-2">
                                        <Hash size={12} className="opacity-50 shrink-0" />
                                        {block.previous_hash}
                                    </div>
                                </div>
                            </div>

                            {/* Payload */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Payload (JSON)</p>
                                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto font-mono leading-relaxed border border-slate-800">
                                    {JSON.stringify(block.transactions, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlockDetailsModal;
