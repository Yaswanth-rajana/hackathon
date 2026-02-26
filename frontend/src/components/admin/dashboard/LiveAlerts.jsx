import React, { useState } from 'react';

const severityColors = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200'
};

const borderColors = {
    critical: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500'
};

const LiveAlerts = ({ alerts, loading, error, onDismiss, page, setPage, total, limit }) => {
    const [filterSeverity, setFilterSeverity] = useState('');

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 text-red-600">
                Failed to load live alerts.
            </div>
        );
    }

    const safeAlerts = alerts || [];
    const displayedAlerts = filterSeverity
        ? safeAlerts.filter(a => a?.severity === filterSeverity)
        : safeAlerts;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col h-[620px]">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    Live Fraud Alerts
                </h2>

                <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="text-sm border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500 px-3 py-1 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors outline-none"
                >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[480px] pr-1">
                {loading ? (
                    <div className="flex flex-col gap-3 py-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} style={{ padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f3f4f6' }}>
                                <div className="skeleton" style={{ height: '12px', width: '40%', marginBottom: '0.5rem' }} />
                                <div className="skeleton" style={{ height: '14px', width: '70%', marginBottom: '0.5rem' }} />
                                <div className="skeleton" style={{ height: '10px', width: '50%' }} />
                            </div>
                        ))}
                    </div>
                ) : (!displayedAlerts || displayedAlerts.length === 0) ? (
                    <div className="flex flex-col justify-center items-center text-center h-full py-10" style={{ minHeight: '200px' }}>
                        <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛡️</span>
                        <p style={{ fontWeight: '700', color: '#15803d', margin: 0 }}>No fraud alerts at this time</p>
                        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem' }}>All monitored shops are stable.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {displayedAlerts?.map(alert => (
                            <li
                                key={alert.id}
                                className={`p-4 rounded border ${borderColors[alert.severity] || 'border-l-gray-300'} border-l-4 bg-gray-50 flex flex-col gap-2 hover:bg-gray-100 transition-colors`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-2 items-center">
                                        <span className={`text-xs px-2 py-1 rounded-full border border-opacity-50 font-medium capitalize ${severityColors[alert.severity] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {alert.detected_at ? new Date(alert.detected_at).toLocaleString() : 'N/A'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onDismiss(alert.id)}
                                        className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer font-medium uppercase tracking-wider"
                                    >
                                        Dismiss ×
                                    </button>
                                </div>

                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">
                                        {alert.description}
                                    </p>
                                    <div className="flex flex-wrap gap-2 md:gap-4 mt-2 text-xs text-gray-600">
                                        <span className="flex items-center gap-1 font-mono bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                            <span className="text-gray-400">🛍</span> {alert.shop_id}
                                        </span>
                                        <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                            <span className="text-gray-400">Type:</span> <span className="capitalize">{alert.fraud_type?.replace(/_/g, ' ')}</span>
                                        </span>
                                        {alert.risk_score > 0 && (
                                            <span className={`flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm font-semibold ${alert.risk_score >= 80 ? 'text-red-600' : 'text-orange-600'}`}>
                                                Risk: {alert.risk_score}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm text-gray-500">
                <div>
                    {total > 0 ? `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total}` : '0 results'}
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1 || loading}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 enabled:active:bg-gray-300 disabled:opacity-50 rounded transition-colors text-gray-700"
                    >
                        Prev
                    </button>
                    <button
                        disabled={page * limit >= total || loading}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 enabled:active:bg-gray-300 disabled:opacity-50 rounded transition-colors text-gray-700"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiveAlerts;
