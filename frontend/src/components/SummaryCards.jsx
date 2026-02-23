import React, { useState, useEffect } from "react";
import api from "../api/api";

const SummaryCards = () => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const response = await api.get("/admin/dashboard/summary");
                setSummary(response.data);
            } catch (err) {
                setError("Failed to load summary");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    if (loading) return <div className="p-4 border rounded mb-4">Loading Summary...</div>;
    if (error) return <div className="p-4 border rounded mb-4 text-red-500">{error}</div>;

    const cards = [
        { label: "Total Shops", value: summary?.total_shops },
        { label: "Total Transactions", value: summary?.total_transactions },
        { label: "Total Beneficiaries", value: summary?.total_beneficiaries },
        { label: "Total Anomalies", value: summary?.total_anomalies },
        { label: "High Risk Shops", value: summary?.high_risk_shops },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {cards.map((card, index) => (
                <div key={index} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>{card.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{card.value ?? 0}</div>
                </div>
            ))}
        </div>
    );
};

export default SummaryCards;
