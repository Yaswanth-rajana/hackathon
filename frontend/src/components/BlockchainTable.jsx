import React, { useState, useEffect } from "react";
import api from "../api/api";

const BlockchainTable = () => {
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBlocks = async () => {
            try {
                const response = await api.get("/blockchain/blocks");
                setBlocks(response.data);
            } catch (err) {
                setError("Failed to load blockchain data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchBlocks();
    }, []);

    const shortenHash = (hash) => {
        if (!hash) return "N/A";
        if (hash === "0") return "0 (Genesis)";
        return hash.slice(0, 10) + "...";
    };

    if (loading) return <div className="p-4 border rounded">Loading Blockchain Explorer...</div>;
    if (error) return <div className="p-4 border rounded text-red-500">{error}</div>;

    return (
        <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '2rem', overflowX: 'auto' }}>
            <header style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>Blockchain Explorer</h2>
            </header>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#111827' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #eee', color: '#4b5563' }}>
                        <th style={{ padding: '0.75rem' }}>Index</th>
                        <th style={{ padding: '0.75rem' }}>Transaction ID</th>
                        <th style={{ padding: '0.75rem' }}>Previous Hash</th>
                        <th style={{ padding: '0.75rem' }}>Block Hash</th>
                        <th style={{ padding: '0.75rem' }}>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    {blocks.map((block) => (
                        <tr key={block.index} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>{block.index}</td>
                            <td style={{ padding: '0.75rem', color: '#4b5563' }}>
                                {block.data?.transaction_id?.slice(0, 8) ?? "N/A"}
                            </td>
                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', color: '#4b5563' }}>
                                {shortenHash(block.previous_hash)}
                            </td>
                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', color: '#111827' }}>
                                {shortenHash(block.hash)}
                            </td>
                            <td style={{ padding: '0.75rem', color: '#4b5563' }}>{new Date(block.timestamp * 1000).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BlockchainTable;
