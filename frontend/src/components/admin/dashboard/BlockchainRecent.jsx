import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockDetailsModal from './BlockDetailsModal';
import { Search } from 'lucide-react';

const BlockchainRecent = ({ transactions, loading, error }) => {
    const navigate = useNavigate();
    const [selectedBlock, setSelectedBlock] = useState(null);

    if (error) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 text-red-600">
                Failed to load blockchain transactions.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col h-full relative">
            <h2 className="text-lg font-bold text-gray-800 mb-4 whitespace-nowrap">Recent Blockchain Trans.</h2>

            <div className="flex-1 overflow-x-auto min-h-[300px]">
                <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                    <thead className="hidden md:table-header-group">
                        <tr className="text-gray-500">
                            <th className="py-2 px-3 font-medium uppercase tracking-wider text-xs">Time</th>
                            <th className="py-2 px-3 font-medium uppercase tracking-wider text-xs">Txn ID / Shop</th>
                            <th className="py-2 px-3 font-medium uppercase tracking-wider text-xs">Type</th>
                            <th className="py-2 px-3 font-medium uppercase tracking-wider text-xs text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-400">Loading blocks...</td>
                            </tr>
                        ) : !transactions || transactions.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-500 italic">No transactions yet</td>
                            </tr>
                        ) : (
                            transactions.map((tx) => (
                                <tr key={tx.transaction_id} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="py-3 px-3 whitespace-nowrap text-gray-500 min-w-24 border-l-2 border-transparent group-hover:border-blue-500">{tx.timestamp}</td>
                                    <td className="py-3 px-3">
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs text-blue-600 truncate max-w-[120px]">{tx.transaction_id}</span>
                                            <span className="text-gray-500 text-xs mt-0.5"><span className="opacity-70">Shop:</span> {tx.shop_id}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-gray-700">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${tx.type === 'ML_ALERT'
                                            ? 'bg-red-50 text-red-600 border-red-100'
                                            : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <button
                                            onClick={() => setSelectedBlock({ index: tx.block_index, hash: tx.block_hash })}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg text-[11px] font-bold hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
                                        >
                                            <Search size={12} strokeWidth={3} />
                                            View Block
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                    onClick={() => navigate('/admin/explorer')}
                    className="w-full text-center text-sm text-blue-600 font-medium hover:text-blue-700 hover:underline"
                >
                    View Full Explorer →
                </button>
            </div>

            {/* Modal */}
            <BlockDetailsModal
                isOpen={!!selectedBlock}
                onClose={() => setSelectedBlock(null)}
                blockIndex={selectedBlock?.index}
                blockHash={selectedBlock?.hash}
            />
        </div>
    );
};

export default BlockchainRecent;
