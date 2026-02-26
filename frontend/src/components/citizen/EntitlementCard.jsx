import { Package, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays, IndianRupee, Hash, ExternalLink, History } from 'lucide-react';

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

    const {
        month_year,
        status,
        wheat_total,
        wheat_remaining,
        rice_total,
        rice_remaining,
        sugar_total,
        sugar_remaining,
        is_settled,
        last_txn_hash,
        last_txn_block,
        cash_compensation,
        short_distribution_reason,
        last_distribution_date,
        recent_activity
    } = entitlement;

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
                        <span className="ml-1 text-gray-400 font-medium">({Math.round((remaining / total) * 100)}% left)</span>
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

            {/* Settlement Banner */}
            {is_settled && (
                <div className="mb-6 p-4 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 animate-bounce-subtle">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-sm font-black uppercase tracking-widest">
                        ✔ Entitlement Completed for {month_year}
                    </span>
                </div>
            )}

            {/* Cash Compensation Card or Progress Bars */}
            {cash_compensation ? (
                <div className="mb-8 p-6 bg-gradient-to-br from-[#003366] to-[#005A9C] text-white rounded-2xl shadow-xl border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <IndianRupee className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="p-2 bg-emerald-400/20 rounded-lg">
                                <IndianRupee className="w-5 h-5 text-emerald-300" />
                            </span>
                            <h3 className="text-lg font-black uppercase tracking-tight">Cash Compensation Issued</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-1">Amount</p>
                                <p className="text-2xl font-black text-emerald-300">₹{cash_compensation.amount}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-1">Status</p>
                                <div className="flex items-center gap-1.5 text-emerald-300">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-xs font-black uppercase tracking-widest leading-none">Verified On-Chain</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-1">Date</p>
                                <p className="text-xs font-bold">{new Date(cash_compensation.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-1">Block #</p>
                                <p className="text-xs font-monospace font-bold">{cash_compensation.block}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-6">
                    {renderItem('Rice', rice_total, rice_remaining, 'kg', 'bg-blue-500')}
                    {renderItem('Wheat', wheat_total, wheat_remaining, 'kg', 'bg-amber-500')}
                    {renderItem('Sugar', sugar_total, sugar_remaining, 'kg', 'bg-purple-400')}
                </div>
            )}

            {/* Short Distribution Reason */}
            {short_distribution_reason && !is_settled && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-1">Partial Distribution Recorded</p>
                        <p className="text-sm font-bold text-rose-900 leading-tight">Reason: {short_distribution_reason}</p>
                        <p className="text-[10px] text-rose-400 font-bold mt-1">Date: {new Date(last_distribution_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                </div>
            )}

            {/* Blockchain Transparency */}
            <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-[#003366]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#003366]">Last Transaction Trace</span>
                    </div>
                    <a
                        href={`/admin/blockchain?search=${last_txn_hash}`}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#005A9C] hover:text-[#003366] transition-colors"
                    >
                        View On Blockchain
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Transaction Hash</span>
                        <span className="font-monospace font-bold text-gray-700 truncate ml-4 max-w-[150px]">{last_txn_hash}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Blockchain Block</span>
                        <span className="font-monospace font-bold text-gray-700">#{last_txn_block}</span>
                    </div>
                </div>
            </div>

            {/* Recent Activity Summary */}
            {recent_activity && recent_activity.length > 0 && (
                <div className="mb-6 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-gray-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recent Monthly Activity</span>
                    </div>
                    {recent_activity.map((activity, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl text-xs hover:border-blue-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <div>
                                    <p className="font-black text-gray-900">{activity.summary}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                        {new Date(activity.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • Block #{activity.block}
                                    </p>
                                </div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                    ))}
                    <button className="w-full py-3 bg-gray-50 hover:bg-blue-50 text-[#005A9C] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-blue-100 flex items-center justify-center gap-2">
                        View Full Distribution History
                        <History className="w-3 h-3" />
                    </button>
                </div>
            )}

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
