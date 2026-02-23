import React from 'react';
import { Package, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays } from 'lucide-react';

// Returns first 5 days of next month as "DD – DD Month YYYY"
function getNextDistributionWindow() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    const dayStart = next.getDate().toString().padStart(2, '0');
    const dayEnd = end.getDate().toString().padStart(2, '0');
    const month = next.toLocaleString('en-IN', { month: 'long' });
    const year = next.getFullYear();
    return `${dayStart} – ${dayEnd} ${month} ${year}`;
}

// Countdown to 1st of next month
function useDaysUntilNextRation() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffMs = next - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours };
}

export default function EntitlementCard({ entitlement }) {
    const { days, hours } = useDaysUntilNextRation();
    const nextWindow = getNextDistributionWindow();

    if (!entitlement) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-gray-300 animate-pulse">
                <div className="h-6 bg-gray-200 w-1/3 mb-4 rounded"></div>
                <div className="h-4 bg-gray-200 w-full mb-2 rounded"></div>
                <div className="h-4 bg-gray-200 w-2/3 rounded"></div>
            </div>
        );
    }

    const { month_year, status, wheat_total, wheat_remaining, rice_total, rice_remaining, sugar_total, sugar_remaining } = entitlement;

    const statusConfig = {
        completed: {
            bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
            bar: 'bg-emerald-500',
            icon: CheckCircle2,
            text: 'Fully Distributed',
            leftBorder: 'border-l-emerald-500'
        },
        partial: {
            bg: 'bg-amber-50 border-amber-200 text-amber-800',
            bar: 'bg-amber-400',
            icon: AlertTriangle,
            text: 'Partially Distributed',
            leftBorder: 'border-l-amber-400'
        },
        pending: {
            bg: 'bg-red-50 border-red-200 text-red-800',
            bar: 'bg-[#003366]',
            icon: XCircle,
            text: 'Not Yet Received',
            leftBorder: 'border-l-[#003366]'
        }
    };

    const cfg = statusConfig[status] || statusConfig.pending;
    const StatusIcon = cfg.icon;

    const renderItem = (name, total, remaining, unit, color) => {
        const received = Math.max(0, total - remaining);
        const pct = total > 0 ? Math.min(100, (received / total) * 100) : 0;
        const filled = Math.round(pct / 10);
        const empty = 10 - filled;

        return (
            <div className="mb-5">
                <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-semibold text-gray-700">{name}</span>
                    <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">{received}</span>
                        <span className="text-xs text-gray-400"> / {total} {unit}</span>
                    </div>
                </div>
                {/* ASCII-style block progress bar */}
                <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex-1 flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-3 flex-1 rounded-sm transition-all duration-500 ${i < filled ? color : 'bg-gray-200'}`}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 w-8 text-right">
                        {Math.round(pct)}%
                    </span>
                </div>
                {remaining > 0 && (
                    <p className="text-xs font-bold text-gray-900">
                        Remaining: <span className="text-[#005A9C]">{remaining} {unit}</span>
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 ${cfg.leftBorder}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#F3F6FF] rounded-full">
                        <Package className="w-6 h-6 text-[#003366]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-[#003366] tracking-tight">Monthly Entitlement</h2>
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                            {month_year}
                        </p>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide ${cfg.bg}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {cfg.text}
                </div>
            </div>

            {/* Progress Bars */}
            <div>
                {renderItem('Rice', rice_total, rice_remaining, 'kg', 'bg-blue-500')}
                {renderItem('Wheat', wheat_total, wheat_remaining, 'kg', 'bg-amber-500')}
                {renderItem('Sugar', sugar_total, sugar_remaining, 'kg', 'bg-purple-400')}
            </div>

            {/* Next Distribution Window + Countdown */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays className="w-4 h-4 text-[#005A9C] shrink-0" />
                    <span>
                        <span className="text-xs text-gray-500 block font-semibold uppercase tracking-wide">Next Distribution Window</span>
                        <span className="font-bold text-gray-900">{nextWindow}</span>
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-[#003366] text-white rounded-lg text-xs font-bold shadow">
                    <Clock className="w-3.5 h-3.5 text-blue-200" />
                    <span>Next ration in <span className="text-yellow-300">{days}d {hours}h</span></span>
                </div>
            </div>
        </div>
    );
}
