import React from 'react';

const HeatMap = ({ heatmapData, loading, error }) => {
    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 text-red-600">
                Failed to load heatmap data.
            </div>
        );
    }

    const getHeatColor = (level) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-600 hover:bg-red-700 text-white border-red-700';
            case 'HIGH': return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600';
            case 'MEDIUM': return 'bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-yellow-500';
            default: return 'bg-green-100 hover:bg-green-200 text-green-900 border-green-200';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col h-full">
            <h2 className="text-lg font-bold text-gray-800 mb-4 whitespace-nowrap">District Risk Heatmap</h2>

            {loading ? (
                <div className="flex-1 flex flex-col gap-3 min-h-[250px] p-2">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '0.5rem' }} />
                    ))}
                </div>
            ) : !heatmapData || heatmapData.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center min-h-[250px] py-10">
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺️</span>
                    <p style={{ fontWeight: '600', color: '#374151', margin: 0 }}>No risk data yet</p>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem', maxWidth: '220px' }}>Risk scores will appear after anomaly detection runs.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 flex-1 min-h-[250px] content-start">
                    {heatmapData.map((region) => (
                        <div
                            key={region.mandal}
                            className={`relative group p-4 border rounded flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ease-in-out shadow-sm ${getHeatColor(region.risk_level)} filter hover:brightness-105`}
                        >
                            <span className="font-semibold truncate w-full text-sm block mb-1">{region.mandal}</span>
                            <span className="text-2xl font-black">{region.avg_score}</span>

                            {/* Tooltip */}
                            <div className="absolute z-10 bottom-full mb-2 w-48 hidden group-hover:block bg-gray-900 text-white text-xs rounded shadow-xl p-3 border border-gray-700 pointer-events-none transform -translate-x-0 translate-y-1">
                                <div className="font-bold border-b border-gray-700 pb-1 mb-2">Mandal: {region.mandal}</div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-400">Total Shops:</span>
                                    <span className="font-mono">{region.shop_count}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-400">Avg Risk:</span>
                                    <span className="font-mono">{region.avg_score}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-400">Level:</span>
                                    <span className={`font-semibold uppercase ${region.risk_level === 'CRITICAL' ? 'text-red-400' :
                                        region.risk_level === 'HIGH' ? 'text-orange-400' :
                                            region.risk_level === 'MEDIUM' ? 'text-yellow-400' :
                                                'text-green-400'
                                        }`}>{region.risk_level}</span>
                                </div>
                                {region.top_fraud_type && (
                                    <div className="flex flex-col mt-2 pt-2 border-t border-gray-700">
                                        <span className="text-gray-400 mb-1">Top Flag:</span>
                                        <span className="font-semibold text-red-300 capitalize truncate">{region.top_fraud_type.replace(/_/g, ' ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-4 flex gap-3 text-xs justify-center items-center border-t border-gray-100 pt-4 text-gray-600">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-200"></span> Low (0-39)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400 border border-yellow-500"></span> Medium (40-69)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 border border-orange-600"></span> High (70-89)</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-600 border border-red-700"></span> Critical (90+)</div>
            </div>
        </div>
    );
};

export default HeatMap;
