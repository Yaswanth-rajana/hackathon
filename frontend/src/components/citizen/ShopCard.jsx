import React from 'react';
import { Store, MapPin, Clock, Star, ShieldAlert, ShieldCheck, TrendingUp } from 'lucide-react';

export default function ShopCard({ shop }) {
    if (!shop) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-gray-300 animate-pulse h-full">
                <div className="h-6 bg-gray-200 w-1/2 mb-4 rounded"></div>
                <div className="h-4 bg-gray-200 w-full mb-2 rounded"></div>
            </div>
        );
    }

    // Generate a pseudo-compliance score based on rating and risk
    const complianceScore = shop.risk_score > 0 ? Math.max(0, 100 - shop.risk_score) : Math.round(70 + (shop.rating * 5));
    const mandalAvg = 88;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-[#005A9C] h-full flex flex-col justify-between hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Store className="w-48 h-48" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#F3F6FF] rounded-xl text-[#005A9C] shadow-sm">
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">{shop.name}</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Assigned Fair Price Shop</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Licensed
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 text-[#005A9C] mt-0.5 shrink-0" />
                        <span className="font-medium leading-relaxed">{shop.address}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-[#005A9C] shrink-0" />
                        <span className="font-medium">{shop.timings}</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Shop Compliance</span>
                        <div className="flex items-end gap-1.5">
                            <span className={`text-2xl font-black ${complianceScore > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{complianceScore}%</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Mandal Avg: {mandalAvg}%</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Dealer Rating</span>
                        <div className="flex items-center justify-end gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-3.5 h-3.5 ${i < Math.floor(shop.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                                />
                            ))}
                            <span className="text-sm font-black text-gray-900 ml-1">{shop.rating}</span>
                        </div>
                        {shop.risk_score > 70 && (
                            <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-red-50 text-red-700 text-[9px] font-black rounded uppercase border border-red-100">
                                <ShieldAlert className="w-3 h-3" />
                                High Risk Shop
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
