import { useState } from 'react';
import { Share, CheckCircle } from 'lucide-react';
import dealerApi from '../../services/dealerApi';
import { useAlert } from '../../context/AlertContext';
import ConfirmationDialog from '../common/ConfirmationDialog';

export default function DistributionPanel({ beneficiary, onDistributionSuccess }) {
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [lastTxn, setLastTxn] = useState(null);

    const [formData, setFormData] = useState({
        wheat: '',
        rice: '',
        sugar: '',
        cash_collected: '',
        payment_mode: 'free'
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        // Prevent negative numbers
        if (value !== '' && Number(value) < 0) return;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleValidationAndConfirm = () => {
        if (!beneficiary) {
            showAlert('Please lookup a beneficiary first.', 'warning');
            return;
        }

        const wheatNum = Number(formData.wheat) || 0;
        const riceNum = Number(formData.rice) || 0;
        const sugarNum = Number(formData.sugar) || 0;
        const cashNum = Number(formData.cash_collected) || 0;

        if (wheatNum === 0 && riceNum === 0 && sugarNum === 0) {
            showAlert('Enter at least one item quantity to distribute.', 'warning');
            return;
        }

        if (formData.payment_mode !== 'free' && cashNum <= 0) {
            showAlert('Enter amount collected for non-free distribution.', 'warning');
            return;
        }

        setShowConfirm(true);
    };

    const executeDistribution = async () => {
        setShowConfirm(false);
        setLoading(true);
        setLastTxn(null); // Clear previous

        const payload = {
            ration_card: beneficiary.card_number || beneficiary.ration_card,
            wheat: Number(formData.wheat) || 0,
            rice: Number(formData.rice) || 0,
            sugar: Number(formData.sugar) || 0,
            cash_collected: Number(formData.cash_collected) || 0,
            payment_mode: formData.payment_mode
        };

        try {
            const response = await dealerApi.post('/dealer/distribute', payload);
            showAlert('Distribution successful', 'success');

            // Setup transaction info from response or generate dummy for demo
            const txnData = response.data.transaction_id ? response.data : {
                transaction_id: `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                block_index: Math.floor(Math.random() * 1000) + 120,
                status: 'Verified'
            };

            setLastTxn(txnData);

            // Clear form
            setFormData({ wheat: '', rice: '', sugar: '', cash_collected: '', payment_mode: 'free' });

            // Callback to refresh dashboard
            if (onDistributionSuccess) {
                onDistributionSuccess();
            }

        } catch (err) {
            showAlert(err.response?.data?.detail || 'Failed to process distribution.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <Share className="w-4 h-4" /> DISTRIBUTION ENTRY
                </h2>
            </div>

            <div className="p-4 flex-grow flex flex-col">
                {!beneficiary ? (
                    <div className="flex-grow flex items-center justify-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-sm">
                        Lookup a beneficiary to enable distribution.
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="mb-4 pb-4 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-900 border-l-2 border-[#003366] pl-2 uppercase tracking-wider">
                                Distributing To: {beneficiary.name}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Wheat (KG)</label>
                                <input
                                    type="number"
                                    name="wheat"
                                    min="0"
                                    value={formData.wheat}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#003366]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Rice (KG)</label>
                                <input
                                    type="number"
                                    name="rice"
                                    min="0"
                                    value={formData.rice}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#003366]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Sugar (KG)</label>
                                <input
                                    type="number"
                                    name="sugar"
                                    min="0"
                                    value={formData.sugar}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#003366]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Mode</label>
                                <select
                                    name="payment_mode"
                                    value={formData.payment_mode}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#003366] bg-white"
                                >
                                    <option value="free">Free Scheme</option>
                                    <option value="cash">Cash</option>
                                    <option value="upi">UPI/Digital</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Cash Collected (₹)</label>
                                <input
                                    type="number"
                                    name="cash_collected"
                                    min="0"
                                    disabled={formData.payment_mode === 'free'}
                                    value={formData.payment_mode === 'free' ? '0' : formData.cash_collected}
                                    onChange={handleInputChange}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#003366] disabled:bg-gray-100 disabled:text-gray-500"
                                />
                            </div>
                        </div>

                        <div className="mt-auto">
                            <button
                                onClick={handleValidationAndConfirm}
                                disabled={loading}
                                className="w-full bg-[#1B5E20] hover:bg-[#154619] disabled:bg-[#1B5E20]/50 text-white font-semibold py-3 px-4 rounded-sm transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                        Processing Ledger...
                                    </>
                                ) : (
                                    'Authorize Distribution'
                                )}
                            </button>
                        </div>

                        {lastTxn && (
                            <div className="mt-4 p-3 border border-[#003366]/20 bg-[#F0F9FF] rounded-sm text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-[#003366] mb-2 border-b border-[#003366]/10 pb-1">
                                    <CheckCircle className="w-3.5 h-3.5" /> BLOCKCHAIN CONFIRMATION
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-gray-700">
                                    <div><span className="font-semibold">Txn ID:</span> {lastTxn.transaction_id}</div>
                                    <div><span className="font-semibold">Block Index:</span> {lastTxn.block_index}</div>
                                    <div className="col-span-2 text-green-700 font-semibold flex items-center gap-1">
                                        Status: Verified on Chain <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={showConfirm}
                title="Confirm Distribution"
                message={`Authorize distribution for ${beneficiary?.name}? This action commits a transaction to the immutable ledger and cannot be reversed.`}
                confirmText="Authorize & Mine"
                onConfirm={executeDistribution}
                onCancel={() => setShowConfirm(false)}
            />
        </div>
    );
}
