import { useState, useEffect, useCallback } from 'react';
import { Share, CheckCircle, Info, AlertTriangle, Wallet, ShieldCheck, History, ExternalLink, Lock } from 'lucide-react';
import dealerApi from '../../services/dealerApi';
import { useAlert } from '../../context/AlertContext';
import ConfirmationDialog from '../common/ConfirmationDialog';

const ProgressBar = ({ current, total, color = "bg-[#003366]" }) => {
    const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;
    return (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
            <div
                className={`h-full ${color} transition-all duration-500 ease-out`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};

export default function DistributionPanel({ beneficiary, onDistributionSuccess }) {
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(false);
    const [fetchingEntitlement, setFetchingEntitlement] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [lastTxn, setLastTxn] = useState(null);
    const [auditHistory, setAuditHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const [entitlement, setEntitlement] = useState({ wheat: 0, rice: 0, sugar: 0 });
    const [received, setReceived] = useState({ wheat: 0, rice: 0, sugar: 0 });

    const [formData, setFormData] = useState({
        wheat: '',
        rice: '',
        sugar: '',
        cash_collected: '',
        payment_mode: 'free',
        notes: ''
    });

    const fetchData = useCallback(async () => {
        if (!beneficiary) return;
        setFetchingEntitlement(true);
        try {
            const [entRes, recRes, histRes] = await Promise.all([
                dealerApi.get(`/dealer/entitlement/${beneficiary.ration_card}`),
                dealerApi.get(`/dealer/received/${beneficiary.ration_card}`),
                dealerApi.get(`/dealer/history/${beneficiary.ration_card}`)
            ]);
            setEntitlement(entRes.data);
            setReceived(recRes.data);

            // Map backend history to frontend format
            const history = histRes.data.history.map(tx => ({
                id: tx.transaction_id,
                date: new Date(tx.timestamp).toLocaleDateString(),
                type: tx.transaction_type === 'CASH_TRANSFER' ? 'CASH' : 'GROCERY',
                block: tx.block_index,
                notes: tx.notes
            }));
            setAuditHistory(history);
        } catch (err) {
            showAlert('Failed to synchronize data', 'error');
        } finally {
            setFetchingEntitlement(false);
        }
    }, [beneficiary, showAlert]);

    // Fetch Entitlement & History when beneficiary changes
    useEffect(() => {
        if (beneficiary) {
            fetchData();
            setFormData({
                wheat: '', rice: '', sugar: '',
                cash_collected: '', payment_mode: 'free', notes: ''
            });
            setLastTxn(null);
            setShowHistory(false);
        }
    }, [beneficiary, fetchData]);

    const remaining = {
        wheat: Math.max(0, entitlement.wheat - received.wheat),
        rice: Math.max(0, entitlement.rice - received.rice),
        sugar: Math.max(0, entitlement.sugar - received.sugar)
    };

    const isSettled = (remaining.wheat === 0 && remaining.rice === 0 && remaining.sugar === 0) ||
        (auditHistory.some(t => t.type === 'CASH_TRANSFER'));

    const isCashMode = formData.payment_mode === 'cash_compensation';

    const isShort = !isCashMode && beneficiary && (
        (formData.wheat !== '' && Number(formData.wheat) < remaining.wheat) ||
        (formData.rice !== '' && Number(formData.rice) < remaining.rice) ||
        (formData.sugar !== '' && Number(formData.sugar) < remaining.sugar)
    );

    // Simple Risk Pattern: More than 1 short distribution recorded (mocked for demo)
    const hasRisk = auditHistory.filter(t => t.notes && t.notes !== '').length >= 2;

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (value !== '' && Number(value) < 0) return;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleValidationAndConfirm = () => {
        if (!beneficiary) return;
        if (isSettled) {
            showAlert('Month is already settled.', 'warning');
            return;
        }

        const wheatNum = Number(formData.wheat) || 0;
        const riceNum = Number(formData.rice) || 0;
        const sugarNum = Number(formData.sugar) || 0;
        const cashNum = Number(formData.cash_collected) || 0;

        if (isCashMode) {
            if (cashNum <= 0) return showAlert('Enter valid compensation amount.', 'warning');
            if (!formData.notes) return showAlert('Justification required.', 'warning');
        } else {
            if (wheatNum === 0 && riceNum === 0 && sugarNum === 0) return showAlert('Enter quantities to distribute.', 'warning');
            if (wheatNum > remaining.wheat || riceNum > remaining.rice || sugarNum > remaining.sugar) {
                return showAlert('Exceeds remaining entitlement.', 'error');
            }
            if (isShort && !formData.notes) return showAlert('Reason required for short distribution.', 'warning');
        }

        setShowConfirm(true);
    };

    const executeDistribution = async () => {
        setShowConfirm(false);
        setLoading(true);
        setLastTxn(null);

        const payload = {
            ration_card: beneficiary.ration_card,
            wheat: isCashMode ? 0 : (Number(formData.wheat) || 0),
            rice: isCashMode ? 0 : (Number(formData.rice) || 0),
            sugar: isCashMode ? 0 : (Number(formData.sugar) || 0),
            cash_collected: Number(formData.cash_collected) || 0,
            payment_mode: formData.payment_mode,
            notes: formData.notes
        };

        try {
            const response = await dealerApi.post('/dealer/distribute', payload);
            showAlert('Transaction Secured on Blockchain', 'success');
            setLastTxn(response.data);

            setFormData({ wheat: '', rice: '', sugar: '', cash_collected: '', payment_mode: 'free', notes: '' });

            // Refresh counts and history from backend
            await fetchData();

            if (onDistributionSuccess) onDistributionSuccess();
        } catch (err) {
            showAlert(err.response?.data?.detail || 'Execution failed.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col font-sans">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3 flex justify-between items-center">
                <h2 className="text-xs font-bold text-[#003366] uppercase tracking-wider flex items-center gap-2">
                    <Share className="w-4 h-4" /> DISTRIBUTION HUB
                </h2>
                {beneficiary && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-0.5 rounded-sm text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                            <History className="w-3 h-3" /> AUDIT TRACE
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1 ${beneficiary.mobile_verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            <ShieldCheck className="w-3 h-3" /> {beneficiary.mobile_verified ? 'ID VERIFIED' : 'ID PENDING'}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4 flex-grow flex flex-col overflow-y-auto">
                {!beneficiary ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-sm p-6 text-center italic">
                        <Lock className="w-8 h-8 mb-2 opacity-20" />
                        Awaiting beneficiary lookup to unlock panel...
                    </div>
                ) : isSettled && !lastTxn ? (
                    <div className="flex-grow flex flex-col items-center justify-center bg-green-50 border border-green-200 rounded-sm p-8 text-center animate-in fade-in duration-700">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-10 h-10 text-green-600 animate-bounce" />
                        </div>
                        <h3 className="text-xl font-black text-green-800 uppercase tracking-tighter mb-1">Month Settled</h3>
                        <p className="text-sm text-green-700 font-medium">Full entitlement delivered for the current cycle.</p>
                        <div className="mt-6 pt-6 border-t border-green-200 w-full text-[10px] text-green-600 uppercase font-bold tracking-widest">
                            No Further Distribution Allowed
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full gap-4">
                        {/* Risk Indicator */}
                        {hasRisk && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-2 flex items-center gap-2 animate-pulse mb-1">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-[10px] font-black text-red-700 uppercase tracking-tight">⚠ Elevated Risk: Unusual Distribution Pattern Captured</span>
                            </div>
                        )}

                        {/* Entitlement Table with Progress Bars */}
                        <div className="space-y-3 p-3 bg-gray-50 border border-gray-200 rounded-sm">
                            {['wheat', 'rice', 'sugar'].map(item => (
                                <div key={item}>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] font-black text-[#003366] uppercase">{item}</span>
                                        <div className="text-right">
                                            <div className="text-[9px] text-gray-500 leading-none">
                                                Entitled: {entitlement[item]}kg | Received: {received[item]}kg
                                            </div>
                                            <div className="text-[11px] font-black text-[#003366]">
                                                Remaining: {remaining[item]}kg
                                            </div>
                                        </div>
                                    </div>
                                    <ProgressBar current={received[item]} total={entitlement[item]} />
                                </div>
                            ))}
                        </div>

                        {/* Audit History Panel */}
                        {showHistory && (
                            <div className="bg-[#003366] text-white p-3 rounded-sm text-[10px] animate-in slide-in-from-top-2">
                                <h4 className="font-bold border-b border-white/20 pb-1 mb-2 flex justify-between">
                                    <span>RECENT AUDIT TRACE</span>
                                    <span className="text-blue-300">BLOCKCHAIN SECURED</span>
                                </h4>
                                {auditHistory.length === 0 ? (
                                    <div className="py-2 text-center text-white/50 italic">No transactions this cycle</div>
                                ) : (
                                    <div className="space-y-2">
                                        {auditHistory.map(txn => (
                                            <div key={txn.id} className="flex justify-between items-start border-b border-white/10 pb-1 last:border-0">
                                                <div>
                                                    <span className="font-bold text-blue-200">{txn.date}</span> • {txn.type}
                                                    {txn.notes && <div className="text-[8px] opacity-70 italic">Reason: {txn.notes}</div>}
                                                </div>
                                                <div className="font-mono text-right">#{txn.block}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Input Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            {['wheat', 'rice', 'sugar'].map(item => (
                                <div key={item}>
                                    <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Distribute {item}</label>
                                    <input
                                        type="number"
                                        name={item}
                                        max={remaining[item]}
                                        disabled={isCashMode || fetchingEntitlement || isSettled}
                                        value={formData[item]}
                                        onChange={handleInputChange}
                                        className="w-full border-2 border-gray-200 rounded-sm px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-[#003366] disabled:bg-gray-100 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Payment & Mode */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase">Payment Mode</label>
                                <select
                                    name="payment_mode"
                                    value={formData.payment_mode}
                                    onChange={handleInputChange}
                                    disabled={isSettled}
                                    className="w-full border-2 border-gray-200 rounded-sm px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-[#003366] bg-white transition-all"
                                >
                                    <option value="free">Free Distribution</option>
                                    <option value="subsidized">Subsidized Sale</option>
                                    <option value="cash_compensation">Cash Compensation</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-600 mb-1 uppercase tracking-tight">
                                    {isCashMode ? 'DBT Value (₹)' : 'Collection (₹)'}
                                </label>
                                <input
                                    type="number"
                                    name="cash_collected"
                                    value={formData.cash_collected}
                                    onChange={handleInputChange}
                                    disabled={isSettled}
                                    className="w-full border-2 border-gray-200 rounded-sm px-2 py-1.5 text-sm font-bold focus:outline-none focus:border-[#003366] transition-all"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Governance Rules Panel */}
                        {(isShort || isCashMode) && (
                            <div className="border border-blue-200 bg-blue-50 rounded-sm p-3 border-l-4 border-l-blue-600 animate-in slide-in-from-right-4">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-800 mb-2 uppercase italic tracking-tighter">
                                    <Info className="w-3.5 h-3.5" /> Mandatory Governance Recording Required
                                </div>
                                <label className="block text-[10px] font-bold text-blue-700 mb-1">
                                    Official Justification:
                                </label>
                                <select
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="w-full border border-blue-300 rounded-sm px-2 py-1.5 text-xs font-medium focus:outline-none bg-white mb-1"
                                >
                                    <option value="">-- Click to Select Reason --</option>
                                    {isCashMode ? (
                                        <>
                                            <option value="Direct Benefit Transfer Policy">Direct Benefit Transfer Policy</option>
                                            <option value="Beneficiary Request (Cash Preference)">Beneficiary Cash Preference</option>
                                            <option value="Commodity Out of Stock">Supply Chain Constraint</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="Stock Shortage at POS">Stock Shortage at POS</option>
                                            <option value="Beneficiary Refused Partial">Beneficiary Denied Full Quantity</option>
                                            <option value="Quality Variance Check">Quality Variance Check</option>
                                            <option value="Identity Confirmation Delay">Identity Verification Delay</option>
                                        </>
                                    )}
                                    <option value="Other">Other (System Override)</option>
                                </select>
                            </div>
                        )}

                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <button
                                onClick={handleValidationAndConfirm}
                                disabled={loading || fetchingEntitlement || !beneficiary.mobile_verified || isSettled}
                                className={`w-full font-black py-3.5 px-4 rounded-sm transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-md ${isCashMode
                                    ? 'bg-blue-800 hover:bg-blue-900 text-white'
                                    : 'bg-[#1B5E20] hover:bg-[#154619] text-white'
                                    } disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none translate-y-0 active:translate-y-1`}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                        BLOCKCHAIN MINING...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        {isCashMode ? 'Authorize & Seed Block' : 'Validate & Commit Ration'}
                                    </>
                                )}
                            </button>
                            {!beneficiary.mobile_verified && (
                                <p className="text-[10px] text-red-600 mt-2 text-center font-black uppercase tracking-widest">
                                    Identity Verification Locked
                                </p>
                            )}
                        </div>

                        {lastTxn && (
                            <div className="mt-2 p-4 border-2 border-green-600 bg-green-50 rounded-sm text-[10px] animate-in zoom-in-95 duration-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-1 bg-green-600 text-white font-black text-[8px] uppercase tracking-tighter transform rotate-0 origin-top-right">
                                    LIVE PROOF
                                </div>
                                <div className="flex items-center gap-1.5 font-black text-green-800 mb-3 border-b-2 border-green-200 pb-2 uppercase tracking-widest">
                                    <CheckCircle className="w-4 h-4 text-green-600 animate-pulse" /> Verified On-Chain
                                </div>
                                <div className="space-y-1.5 font-mono text-[9px]">
                                    <div className="flex justify-between"><span className="text-green-700/60 font-bold uppercase">Transaction:</span> <span className="font-black text-green-900">{lastTxn.transaction_id}</span></div>
                                    <div className="flex justify-between"><span className="text-green-700/60 font-bold uppercase">Block Index:</span> <span className="font-black text-green-900">{lastTxn.block_index}</span></div>
                                    <div className="text-green-700/60 font-bold uppercase mt-2 mb-0.5">Merkle Hash Path:</div>
                                    <div className="bg-white p-1.5 border border-green-200 text-[#003366] break-all group-hover:bg-green-100 transition-colors">
                                        {lastTxn.block_hash}
                                    </div>
                                </div>
                                <button className="mt-4 w-full border-2 border-green-700 text-green-800 font-black py-2 rounded-sm hover:bg-green-700 hover:text-white transition-all flex items-center justify-center gap-1.5 uppercase tracking-tighter">
                                    <ExternalLink className="w-3.5 h-3.5" /> View in Blockchain Explorer
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={showConfirm}
                title={isCashMode ? "🚨 Confirm Blockchain Injection" : "🛡 Confirm Distribution"}
                message={
                    <div className="text-left space-y-3">
                        <p className="font-medium text-gray-700">You are about to finalize a high-integrity transaction for <span className="font-black text-[#003366] underline">{beneficiary?.name}</span>.</p>
                        <div className="bg-gray-100 p-2 rounded-sm border border-gray-200 space-y-1">
                            {isCashMode ? (
                                <p className="text-xs font-bold text-blue-800 uppercase">Type: Cash Compensation (₹{formData.cash_collected})</p>
                            ) : (
                                <>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase">Distributing Quantities:</p>
                                    <div className="grid grid-cols-3 gap-2 text-xs font-black text-[#003366]">
                                        <span>W: {formData.wheat || 0}kg</span>
                                        <span>R: {formData.rice || 0}kg</span>
                                        <span>S: {formData.sugar || 0}kg</span>
                                    </div>
                                </>
                            )}
                            {isShort && <p className="text-[10px] font-bold text-red-600 uppercase mt-2 italic">⚠ Shortage Reason: {formData.notes}</p>}
                        </div>
                        <p className="text-[11px] font-black text-red-700 border-2 border-red-100 p-2 text-center rounded-sm bg-red-50">
                            THIS TRANSACTION WILL BE PERMANENTLY RECORDED ON THE IMMUTABLE RATIONSHIELD LEDGER.
                        </p>
                    </div>
                }
                confirmText="Sign & Authorize"
                onConfirm={executeDistribution}
                onCancel={() => setShowConfirm(false)}
            />
        </div>
    );
}
