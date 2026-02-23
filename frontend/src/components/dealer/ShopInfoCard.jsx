import { MapPin, User, Hash, CheckCircle } from 'lucide-react';

export default function ShopInfoCard({ data }) {
    if (!data) return null;

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide">
                    Shop Information
                </h2>
                {data.status?.toLowerCase() === 'active' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-[#F0FDF4] text-[#1B5E20] border border-[#1B5E20]/20">
                        <CheckCircle className="w-3 h-3 mr-1" /> ACTIVE
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                        {data.status || 'UNKNOWN'}
                    </span>
                )}
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                    <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Shop ID</p>
                        <p className="font-semibold text-gray-900">{data.shop_id || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Dealer Name</p>
                        <p className="font-semibold text-gray-900">{data.dealer_name || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3 md:col-span-2">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs text-gray-500 font-medium">Address</p>
                        <p className="text-gray-900">{data.address || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
