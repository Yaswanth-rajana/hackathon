import { useState } from 'react';
import { Search, UserCheck, Phone, Users } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import dealerApi from '../../services/dealerApi';

export default function BeneficiaryLookup({ onBeneficiaryFound }) {
    const [rationCard, setRationCard] = useState('');
    const [loading, setLoading] = useState(false);
    const [beneficiary, setBeneficiary] = useState(null);
    const { showAlert } = useAlert();

    const handleLookup = async (e) => {
        e.preventDefault();
        if (!rationCard.trim()) {
            showAlert('Please enter a Ration Card number', 'warning');
            return;
        }

        setLoading(true);
        setBeneficiary(null); // Clear previous

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

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <Search className="w-4 h-4" /> BENEFICIARY LOOKUP
                </h2>
            </div>

            <div className="p-4 flex-grow flex flex-col">
                <form onSubmit={handleLookup} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#003366] focus:border-[#003366]"
                        placeholder="Enter Ration Card Number (e.g. WAP...)"
                        value={rationCard}
                        onChange={(e) => setRationCard(e.target.value.toUpperCase())}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#003366] hover:bg-[#002244] text-white px-4 py-2 rounded-sm text-sm font-medium transition-colors border border-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            'VERIFY'
                        )}
                    </button>
                </form>

                {beneficiary ? (
                    <div className="mt-2 text-sm border border-[#1B5E20]/20 bg-[#F0FDF4]/50 rounded-sm p-3 flex-grow">
                        <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2">
                            CARD DETAILS
                        </h3>

                        <div className="space-y-3">
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
                                    {beneficiary.phone_linked ? (
                                        <span className="text-[#1B5E20] flex items-center gap-1">Yes <Phone className="w-3.5 h-3.5" /></span>
                                    ) : (
                                        <span className="text-[#B45309]">No</span>
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                                <span className="text-gray-500 font-medium text-xs">Card Type</span>
                                <span className="inline-flex px-2 py-0.5 bg-[#003366]/10 text-[#003366] text-xs font-semibold rounded-sm">
                                    {beneficiary.card_type}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-2 text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-sm p-4 flex-grow flex items-center justify-center text-center">
                        Enter a valid Ration Card number<br />to verify details for distribution.
                    </div>
                )}
            </div>
        </div>
    );
}
