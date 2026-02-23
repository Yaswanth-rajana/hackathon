import { Package } from 'lucide-react';

export default function StockPanel({ stock }) {
    if (!stock) return null;

    // Assuming stock is an array of objects: { item: 'Wheat', quantity: 150, unit: 'KG', threshold: 50, critical: 20 }
    // Provide defaults to be safe
    const defaultStock = [
        { item: 'Wheat', quantity: stock.wheat ?? stock.Wheat ?? 0, unit: 'KG', critical: 50, low: 100, max: 1000 },
        { item: 'Rice', quantity: stock.rice ?? stock.Rice ?? 0, unit: 'KG', critical: 100, low: 500, max: 5000 },
        { item: 'Sugar', quantity: stock.sugar ?? stock.Sugar ?? 0, unit: 'KG', critical: 20, low: 50, max: 200 },
        { item: 'Kerosene', quantity: stock.kerosene ?? stock.Kerosene ?? 0, unit: 'L', critical: 10, low: 30, max: 100 },
    ];

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <Package className="w-4 h-4" /> CURRENT STOCK
                </h2>
            </div>

            <div className="p-4 flex-grow grid gap-4 place-content-start">
                {defaultStock.map((item, idx) => {
                    let statusColor = "bg-[#1B5E20]"; // Green
                    let bgContainer = "bg-[#1B5E20]/10";
                    let labelColor = "text-[#1B5E20]";
                    let alertLabel = "SUFFICIENT";

                    if (item.quantity <= item.critical) {
                        statusColor = "bg-[#B91C1C]"; // Red
                        bgContainer = "bg-[#FEF2F2]";
                        labelColor = "text-[#B91C1C]";
                        alertLabel = "CRITICAL";
                    } else if (item.quantity <= item.low) {
                        statusColor = "bg-[#B45309]"; // Orange
                        bgContainer = "bg-[#FFFBEB]";
                        labelColor = "text-[#B45309]";
                        alertLabel = "LOW";
                    }

                    const percent = Math.min(100, Math.max(0, (item.quantity / item.max) * 100));

                    return (
                        <div key={idx} className={`border border-gray-200 rounded-sm p-3 ${bgContainer}`}>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{item.item}</h3>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm border ${item.quantity <= item.critical ? 'border-[#B91C1C]/30 text-[#B91C1C]' : item.quantity <= item.low ? 'border-[#B45309]/30 text-[#B45309]' : 'border-[#1B5E20]/30 text-[#1B5E20]'}`}>
                                        {alertLabel}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-gray-900">{item.quantity}</span>
                                    <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                                </div>
                            </div>

                            {/* Simple progress bar */}
                            <div className="w-full bg-white border border-gray-200 h-2 rounded-none overflow-hidden">
                                <div
                                    className={`h-full ${statusColor} transition-all duration-500`}
                                    style={{ width: `${percent}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
