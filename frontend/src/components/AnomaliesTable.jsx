import React, { useState, useEffect } from "react";
import api from "../api/api";

const AnomaliesTable = () => {
    const [anomalies, setAnomalies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnomalies = async () => {
            try {
                const response = await api.get("/admin/anomalies/live");
                setAnomalies(response.data);
            } catch (err) {
                setError("Failed to load anomalies");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnomalies();
    }, []);

    const getSeverityStyle = (severity) => {
        switch (severity.toLowerCase()) {
            case 'high':
                return { backgroundColor: '#fee2e2', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' };
            case 'medium':
                return { backgroundColor: '#ffedd5', color: '#f59e0b', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' };
            default:
                return { backgroundColor: '#f3f4f6', color: '#6b7280', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' };
        }
    };

    if (loading) return <div className="p-4 border rounded">Loading Anomalies...</div>;
    if (error) return <div className="p-4 border rounded text-red-500">{error}</div>;

    return (
        <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '2rem', overflowX: 'auto' }}>
            <header style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>Live Anomalies</h2>
            </header>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#111827' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #eee', color: '#4b5563' }}>
                        <th style={{ padding: '0.75rem' }}>Shop ID</th>
                        <th style={{ padding: '0.75rem' }}>Type</th>
                        <th style={{ padding: '0.75rem' }}>Severity</th>
                        <th style={{ padding: '0.75rem' }}>Description</th>
                        <th style={{ padding: '0.75rem' }}>Confidence</th>
                        <th style={{ padding: '0.75rem' }}>Created At</th>
                    </tr>
                </thead>
                <tbody>
                    {anomalies.length === 0 ? (
                        <tr>
                            <td colSpan="6" style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>No anomalies detected</td>
                        </tr>
                    ) : (
                        anomalies.map((anomaly, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.75rem', color: '#111827' }}>{anomaly.shop_id}</td>
                                <td style={{ padding: '0.75rem', color: '#111827' }}>{anomaly.type}</td>
                                <td style={{ padding: '0.75rem' }}>
                                    <span style={getSeverityStyle(anomaly.severity)}>
                                        {anomaly.severity}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem', color: '#111827' }}>{anomaly.description}</td>
                                <td style={{ padding: '0.75rem', color: '#111827' }}>{(anomaly.confidence * 100).toFixed(1)}%</td>
                                <td style={{ padding: '0.75rem', color: '#111827' }}>{new Date(anomaly.created_at).toLocaleString()}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default AnomaliesTable;
