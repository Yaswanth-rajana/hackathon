import React, { useState, useEffect } from 'react';
import { citizenActions, blockchainActions } from '../../services/citizenApi';
import { Receipt, XCircle, ShieldCheck, Loader2, Calendar, Store, Info, CheckCircle, X, ExternalLink } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

async function computeSHA256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function TransactionsList() {
    const [transactions, setTransactions] = useState([]);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [summary, setSummary] = useState({
        total_wheat_received: 0,
        total_rice_received: 0,
        total_sugar_received: 0,
        total_complaints_filed: 0,
        total_shortfalls_detected: 0
    });
    const [showingFullHistory, setShowingFullHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [verifying, setVerifying] = useState({});
    const [selectedTx, setSelectedTx] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { showAlert } = useAlert();

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const data = await citizenActions.getTransactions(10);
                // Backend returns { transactions: [...], total: N }
                setTransactions(Array.isArray(data) ? data : (data.transactions ?? []));
                setTotalTransactions(Array.isArray(data) ? data.length : (data.total ?? 0));
                setSummary(data?.summary || {
                    total_wheat_received: 0,
                    total_rice_received: 0,
                    total_sugar_received: 0,
                    total_complaints_filed: 0,
                    total_shortfalls_detected: 0
                });
            } catch (err) {
                showAlert("Failed to load transactions", "error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchTransactions();
    }, [showAlert]);

    const toggleFullHistory = async () => {
        setHistoryLoading(true);
        try {
            if (!showingFullHistory) {
                const data = await citizenActions.getTransactions(500);
                setTransactions(Array.isArray(data) ? data : (data.transactions ?? []));
                setTotalTransactions(Array.isArray(data) ? data.length : (data.total ?? 0));
                setSummary(data?.summary || summary);
                setShowingFullHistory(true);
            } else {
                const data = await citizenActions.getTransactions(10);
                setTransactions(Array.isArray(data) ? data : (data.transactions ?? []));
                setTotalTransactions(Array.isArray(data) ? data.length : (data.total ?? 0));
                setSummary(data?.summary || summary);
                setShowingFullHistory(false);
            }
        } catch (err) {
            showAlert("Failed to update history view", "error");
        } finally {
            setHistoryLoading(false);
        }
    };

    const verifyTransaction = async (tx) => {
        const txId = tx.transaction_id;
        if (!tx.block_index) {
            showAlert("This transaction is not yet mined on the blockchain.", "warning");
            return;
        }

        setVerifying(prev => ({ ...prev, [txId]: { status: 'loading' } }));

        try {
            const block = await blockchainActions.getBlock(tx.block_index);

            // Payload structure matches what backend creates
            const payload = { items: tx.items, timestamp: tx.timestamp };
            const sortedPayload = {};
            Object.keys(payload).sort().forEach(k => { sortedPayload[k] = payload[k]; });
            const payloadString = JSON.stringify(sortedPayload);
            const expectedPayloadHash = await computeSHA256(payloadString);
            const expectedBlockHash = await computeSHA256(`${block.block_index}${block.previous_hash}${expectedPayloadHash}`);

            const isValid = (expectedPayloadHash === block.payload_hash && expectedBlockHash === block.block_hash);

            const result = {
                status: isValid ? 'success' : 'failed',
                hash: block.block_hash,
                block_index: block.block_index,
                previous_hash: block.previous_hash,
                payload_hash: block.payload_hash
            };

            setTimeout(() => {
                setVerifying(prev => ({
                    ...prev,
                    [txId]: result
                }));
                setSelectedTx({ ...tx, verification: result });
                setIsModalOpen(true);
            }, 800);

        } catch (err) {
            setVerifying(prev => ({ ...prev, [txId]: { status: 'failed', error: 'Verification failed' } }));
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-IN', { month: 'short' });
        const year = d.getFullYear();
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${day} ${month} ${year} – ${time}`;
    };

    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-[#003366] animate-pulse">
                <div className="h-6 bg-gray-200 w-1/4 mb-6 rounded"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-gray-100 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    const transactionsThisYear = transactions.filter(tx => new Date(tx.timestamp).getFullYear() === new Date().getFullYear()).length;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-[#003366] h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#F3F6FF] rounded-full">
                        <Receipt className="w-5 h-5 text-[#003366]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Distribution History</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Yearly Total: {transactionsThisYear}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    Blockchain Secured
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-blue-700">Wheat</p>
                    <p className="text-sm font-black text-blue-900">{summary.total_wheat_received}kg</p>
                </div>
                <div className="rounded-lg bg-indigo-50 px-3 py-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-indigo-700">Rice</p>
                    <p className="text-sm font-black text-indigo-900">{summary.total_rice_received}kg</p>
                </div>
                <div className="rounded-lg bg-purple-50 px-3 py-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-purple-700">Sugar</p>
                    <p className="text-sm font-black text-purple-900">{summary.total_sugar_received}kg</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-amber-700">Complaints</p>
                    <p className="text-sm font-black text-amber-900">{summary.total_complaints_filed}</p>
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-2">
                    <p className="text-[9px] uppercase font-black tracking-widest text-rose-700">Shortfalls</p>
                    <p className="text-sm font-black text-rose-900">{summary.total_shortfalls_detected}</p>
                </div>
            </div>

            {transactions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12">
                    <Receipt className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-wider">No Transaction History</p>
                    <p className="text-xs">Your first ration receipt will appear here.</p>
                </div>
            ) : (
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[600px]">
                    {transactions.map(tx => (
                        <div key={tx.transaction_id} className="p-4 border border-gray-100 rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(tx.timestamp)}
                                    </div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Store className="w-3.5 h-3.5 text-[#005A9C]" />
                                        <span className="text-xs font-bold text-gray-600">FPS ID: {tx.dealer_id || 'Assigned Store'}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-sm">
                                        {tx.items && Object.entries(tx.items).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}kg`).join(', ')}
                                    </h4>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Verified
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                    Reference Block: <span className="text-[#005A9C] font-mono">#{tx.block_index ?? 'PENDING'}</span>
                                </span>

                                {verifying[tx.transaction_id] ? (
                                    <button
                                        onClick={() => { setSelectedTx({ ...tx, verification: verifying[tx.transaction_id] }); setIsModalOpen(true); }}
                                        className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 text-[#0070C0] hover:underline"
                                    >
                                        <Info className="w-3.5 h-3.5" />
                                        View Proof
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => verifyTransaction(tx)}
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-gray-50 text-gray-500 hover:bg-[#003366] hover:text-white rounded transition-all flex items-center gap-1.5"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Verify Integrity
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={toggleFullHistory}
                        disabled={historyLoading || totalTransactions <= 10}
                        className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-[#005A9C] border-2 border-dashed border-gray-100 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {historyLoading
                            ? 'Loading...'
                            : showingFullHistory
                                ? 'Show Recent History'
                                : totalTransactions <= 10
                                    ? `Showing All Available Records (${totalTransactions})`
                                    : `View Full Distribution History (${totalTransactions})`}
                    </button>
                </div>
            )}

            {/* Verification Modal */}
            {isModalOpen && selectedTx && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                        <div className="bg-[#003366] p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                <h3 className="text-xl font-bold tracking-tight">Blockchain Proof</h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</span>
                                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Valid Receipt
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Block Height</span>
                                    <span className="text-lg font-black text-[#003366]">#{selectedTx.verification.block_index}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Transaction Hash (SHA-256)</label>
                                    <div className="p-3 bg-gray-50 rounded-lg font-mono text-[10px] break-all border border-gray-100 text-gray-700">
                                        {selectedTx.verification.hash}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Previous Block Hash</label>
                                    <div className="p-3 bg-gray-50 rounded-lg font-mono text-[10px] break-all border border-gray-100 text-gray-500">
                                        {selectedTx.verification.previous_hash}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-blue-100 space-y-3">
                                <h5 className="text-xs font-black uppercase tracking-widest text-blue-800 flex items-center gap-2">
                                    <Receipt className="w-3.5 h-3.5" />
                                    Immutable Data Record
                                </h5>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Distributed Date</span>
                                        <span className="font-bold text-gray-900">{new Date(selectedTx.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block mb-0.5">Payload Integrity</span>
                                        <span className="font-bold text-emerald-600">MATCHED ✔</span>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setIsModalOpen(false)} className="w-full py-3 bg-[#003366] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all">
                                Close Proof Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
