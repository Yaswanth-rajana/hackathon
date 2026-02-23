import React, { useState, useEffect } from "react";
import api from "../api/api";

const RiskDistribution = () => {
    const [distribution, setDistribution] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDistribution = async () => {
            try {
                const response = await api.get("/admin/risk-distribution");
                setDistribution(response.data);
            } catch (err) {
                setError("Failed to load risk distribution");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDistribution();
    }, []);

    if (loading) return <div className="p-4 border rounded mb-4">Loading Risk Distribution...</div>;
    if (error) return <div className="p-4 border rounded mb-4 text-red-500">{error}</div>;

    const items = [
        { label: "High", value: distribution?.high ?? 0, color: "#ef4444" }, // Red
        { label: "Medium", value: distribution?.medium ?? 0, color: "#f59e0b" }, // Orange/Yellow
        { label: "Low", value: distribution?.low ?? 0, color: "#10b981" }, // Green
    ];

    return (
        <div style={{ padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>Risk Distribution</h2>
            <div style={{ display: 'flex', gap: '2rem' }}>
                {items.map((item, index) => (
                    <div key={index} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>{item.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: item.color }}>{item.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RiskDistribution;
