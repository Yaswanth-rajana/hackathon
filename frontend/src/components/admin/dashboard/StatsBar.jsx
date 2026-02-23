import React from 'react';

// Skeleton card helper — fixed min-height prevents layout shift (CLS)
const SkeletonCard = () => (
    <div className="bg-white rounded-lg border border-gray-100 p-6 flex flex-col gap-3" style={{ minHeight: '110px' }}>
        <div className="skeleton" style={{ height: '12px', width: '60%' }} />
        <div className="skeleton" style={{ height: '36px', width: '40%' }} />
    </div>
);

const getComplianceStyle = (score) => {
    if (score == null) return { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-400' };
    if (score > 90) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700' };
    if (score >= 70) return { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' };
    return { bg: 'bg-red-50 border-red-200', text: 'text-red-700' };
};

const StatsBar = ({ summary, loading, error }) => {
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-medium mb-6">
                ⚠️ Failed to load summary statistics. Retrying...
            </div>
        );
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
        );
    }

    const { total_shops = 0, high_risk_shops = 0, complaints_this_month = 0 } = summary || {};
    // Read compliance_score directly from backend — no frontend recomputation
    const compliance_score = summary?.compliance_score ?? null;
    const compStyle = getComplianceStyle(compliance_score);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg border border-gray-100 flex flex-col items-start" style={{ minHeight: '110px' }}>
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Total Shops</h3>
                <p className="text-3xl font-bold text-gray-800">{total_shops}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-100 flex flex-col items-start" style={{ minHeight: '110px' }}>
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">High Risk Shops</h3>
                <p className="text-3xl font-bold text-red-600">{high_risk_shops}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-100 flex flex-col items-start" style={{ minHeight: '110px' }}>
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Complaints (This Month)</h3>
                <p className="text-3xl font-bold text-orange-600">{complaints_this_month}</p>
            </div>

            <div className={`p-6 rounded-lg border flex flex-col items-start ${compStyle.bg}`} style={{ minHeight: '110px' }}>
                <h3 className="text-gray-700 text-xs font-semibold uppercase tracking-wide mb-2">Compliance Score</h3>
                <p className={`text-3xl font-bold ${compStyle.text}`}>
                    {compliance_score == null ? '--' : `${compliance_score}%`}
                </p>
                {compliance_score == null && (
                    <p className="text-xs text-gray-400 mt-1">No sufficient data</p>
                )}
            </div>
        </div>
    );
};

export default StatsBar;
