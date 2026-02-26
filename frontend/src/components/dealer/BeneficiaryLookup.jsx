import { useState } from 'react';
import { Search, UserCheck, Phone, Users, ShieldCheck } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import dealerApi from '../../services/dealerApi';

export default function BeneficiaryLookup({ onBeneficiaryFound }) {
    const [rationCard, setRationCard] = useState('');
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState(false);
    const [beneficiary, setBeneficiary] = useState(null);
    const [mobileInput, setMobileInput] = useState('');
    const { showAlert } = useAlert();

    const handleLookup = async (e) => {
        if (e) e.preventDefault();
        if (!rationCard.trim()) {
            showAlert('Please enter a Ration Card number', 'warning');
            return;
        }

        setLoading(true);
        // We don't clear beneficiary immediately to prevent UI flicker if found again
        // but it's okay for lookup.
        setBeneficiary(null);

        try {
            const response = await dealerApi.get(`/dealer/beneficiary/${rationCard}`);
            setBeneficiary(response.data);
            if (onBeneficiaryFound) {
                onBeneficiaryFound(response.data);
            }
        } catch (err) {
            if (err.response?.status === 404) {
                showAlert('Beneficiary not found for this Ration Card.', 'error');
            } else {
                showAlert(err.response?.data?.detail || 'Failed to fetch beneficiary details.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLinkMobile = async () => {
        if (!/^\d{10}$/.test(mobileInput)) {
            showAlert('Please enter a valid 10-digit mobile number', 'warning');
            return;
        }

        setLinking(true);
        try {
            await dealerApi.patch(`/dealer/beneficiary/${beneficiary.ration_card}/link-mobile`, {
                mobile: mobileInput
            });
            showAlert('Mobile linked and verified successfully', 'success');
            // Refresh details
            handleLookup();
        } catch (err) {
            showAlert(err.response?.data?.detail || 'Failed to link mobile', 'error');
        } finally {
            setLinking(false);
        }
    };

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <Search className="w-4 h-4" /> BENEFICIARY LOOKUP
                </h2>
            </div>

            <div className="p-4 flex-grow flex flex-col overflow-y-auto">
                <form onSubmit={handleLookup} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                        placeholder="Enter Ration Card Number"
                        value={rationCard}
                        onChange={(e) => setRationCard(e.target.value.toUpperCase())}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#003366] hover:bg-[#002244] text-white px-4 py-2 rounded-sm text-sm font-medium transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            'VERIFY'
                        )}
                    </button>
                </form>

                {beneficiary ? (
                    <div className="mt-2 text-sm flex-grow flex flex-col gap-4">
                        <div className="border border-[#1B5E20]/20 bg-[#F0FDF4]/50 rounded-sm p-3">
                            <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2 flex items-center justify-between">
                                CARD DETAILS
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${beneficiary.account_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {beneficiary.account_status}
                                </span>
                            </h3>

                            <div className="space-y-2.5">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 font-medium text-xs">Head of Family</span>
                                    <span className="font-medium text-right flex items-center gap-1">
                                        {beneficiary.name} <UserCheck className="w-3.5 h-3.5 text-[#1B5E20]" />
                                    </span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 font-medium text-xs">Family Members</span>
                                    <span className="font-medium flex items-center gap-1">
                                        {beneficiary.family_members} <Users className="w-3.5 h-3.5 text-gray-500" />
                                    </span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <span className="text-gray-500 font-medium text-xs">Phone Linked</span>
                                    <span className="font-medium flex items-center gap-1">
                                        {beneficiary.mobile_verified ? (
                                            <span className="text-[#1B5E20] flex items-center gap-1">Yes <Phone className="w-3.5 h-3.5" /></span>
                                        ) : (
                                            <span className="text-[#B45309]">No</span>
                                        )}
                                    </span>
                                </div>

                                <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                                    <span className="text-gray-500 font-medium text-xs">Card ID</span>
                                    <span className="font-mono text-[11px] font-semibold text-[#003366]">
                                        {beneficiary.ration_card}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Linking Flow */}
                        {!beneficiary.mobile_verified && (
                            <div className="border border-blue-200 bg-blue-50/50 rounded-sm p-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                <h4 className="text-[11px] font-bold text-blue-800 mb-2 uppercase flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Identity Link Required
                                </h4>
                                <div className="flex gap-2">
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        placeholder="10-digit mobile"
                                        className="flex-1 border border-blue-300 rounded-sm px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        value={mobileInput}
                                        onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ''))}
                                    />
                                    <button
                                        onClick={handleLinkMobile}
                                        disabled={linking}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-[11px] font-bold transition-all disabled:opacity-50"
                                    >
                                        {linking ? 'LINKING...' : 'LINK MOBILE'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-blue-600 mt-2 italic">
                                    * Linking mobile is required for POS transaction authorization.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-2 text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-sm p-4 flex-grow flex items-center justify-center text-center leading-relaxed">
                        Enter a valid Ration Card number<br />to verify details for distribution.
                    </div>
                )}
            </div>
        </div>
    );
}
