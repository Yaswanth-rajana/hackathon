import React, { useState } from "react";
import api from "../api/api";

const DistributionForm = ({ beneficiary, onSuccess }) => {
    const [rice, setRice] = useState(5);
    const [wheat, setWheat] = useState(3);
    const [sugar, setSugar] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!beneficiary) return <p>Please lookup a beneficiary to start distribution.</p>;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await api.post("/transaction/distribute", {
                ration_card: beneficiary.ration_card,
                items: {
                    rice_kg: parseFloat(rice),
                    wheat_kg: parseFloat(wheat),
                    sugar_kg: parseFloat(sugar),
                },
            });
            onSuccess(response.data);
            // Reset form
            setRice(5);
            setWheat(3);
            setSugar(1);
        } catch (err) {
            setError(err.response?.data?.detail || "Distribution failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "4px" }}>
            <h3>Distribution Form</h3>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                    <label>Rice (kg):</label>
                    <input
                        type="number"
                        value={rice}
                        onChange={(e) => setRice(e.target.value)}
                        required
                        min="0"
                        step="0.1"
                        style={{ width: "100%", padding: "0.5rem" }}
                    />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                    <label>Wheat (kg):</label>
                    <input
                        type="number"
                        value={wheat}
                        onChange={(e) => setWheat(e.target.value)}
                        required
                        min="0"
                        step="0.1"
                        style={{ width: "100%", padding: "0.5rem" }}
                    />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                    <label>Sugar (kg):</label>
                    <input
                        type="number"
                        value={sugar}
                        onChange={(e) => setSugar(e.target.value)}
                        required
                        min="0"
                        step="0.1"
                        style={{ width: "100%", padding: "0.5rem" }}
                    />
                </div>

                {error && <p style={{ color: "red" }}>{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "0.75rem",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    {loading ? "Processing..." : "Confirm Distribution"}
                </button>
            </form>
        </div>
    );
};

export default DistributionForm;
