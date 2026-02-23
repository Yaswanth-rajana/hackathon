import React from 'react';
import { getRiskLevel } from '../../../utils/severityMapper';

const HighRiskShopsTable = ({ shops, loading, error, onExport, page, setPage }) => {
    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg border border-red-200 text-red-700 text-sm font-medium">
                ⚠️ Failed to load high-risk shops.
            </div>
        );
    }

    const SkeletonRow = () => (
        <tr>
            {[...Array(6)].map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="skeleton" style={{ height: '14px', width: i === 1 ? '120px' : '60px', borderRadius: '4px' }} />
                </td>
            ))}
        </tr>
    );

    return (
        <div className="bg-white rounded-lg border border-gray-100 p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">High-Risk Shops</h2>
                <button
                    onClick={onExport}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-gray-200"
                >
                    ⬇ Export CSV
                </button>
            </div>

            <div className="flex-1 overflow-x-auto min-h-[300px]">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600">
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase rounded-tl-lg">Shop ID</th>
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Shop Name</th>
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Mandal</th>
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Risk Score</th>
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Flag</th>
                            <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase rounded-tr-lg">Last Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {loading ? (
                            <>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</>
                        ) : !shops || shops.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-12">
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '2rem' }}>✅</span>
                                        <p style={{ fontWeight: '600', color: '#374151', margin: 0 }}>All shops under acceptable thresholds</p>
                                        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>No shops currently exceed the high-risk threshold.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            shops.map((shop) => {
                                const sev = getRiskLevel(shop.risk_score);
                                return (
                                    <tr key={shop.shop_id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="px-4 py-3 font-mono text-gray-600 bg-gray-50/30">{shop.shop_id}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{shop.shop_name}</td>
                                        <td className="px-4 py-3 text-gray-600">{shop.mandal}</td>
                                        <td className="px-4 py-3">
                                            <span style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem',
                                                fontWeight: '700', backgroundColor: sev.bg, color: sev.color,
                                                border: `1px solid ${sev.border}`, display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                            }}>
                                                {sev.emoji} {shop.risk_score}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-gray-700 capitalize text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 inline-block truncate max-w-[150px]" title={shop.fraud_type?.replace(/_/g, ' ')}>
                                                {shop.fraud_type ? shop.fraud_type.replace(/_/g, ' ') : 'Multiple Flags'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {shop.last_audit ? (
                                                <span className="text-gray-600 text-sm">{shop.last_audit}</span>
                                            ) : (
                                                <span className="text-red-500 font-medium text-xs bg-red-50 px-2 py-1 border border-red-200 rounded">Needs Audit</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between items-center text-sm text-gray-500 pt-4 border-t border-gray-100">
                <div>Page {page}</div>
                <div className="flex gap-2">
                    <button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 enabled:active:bg-gray-300 disabled:opacity-50 rounded transition-colors text-gray-700 shadow-sm">Prev</button>
                    <button onClick={() => setPage(page + 1)} disabled={!shops || shops.length < 10 || loading}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 enabled:active:bg-gray-300 disabled:opacity-50 rounded transition-colors text-gray-700 shadow-sm">Next</button>
                </div>
            </div>
        </div>
    );
};

export default HighRiskShopsTable;
