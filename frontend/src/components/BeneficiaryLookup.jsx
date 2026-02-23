import React, { useState } from "react";
import api from "../api/api";

const BeneficiaryLookup = ({ onBeneficiaryFound }) => {
    const [rationCard, setRationCard] = useState("");
    const [beneficiary, setBeneficiary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setBeneficiary(null);
        onBeneficiaryFound(null);

        try {
            const response = await api.get(`/dealer/beneficiary/${rationCard}`);
            setBeneficiary(response.data);
            onBeneficiaryFound(response.data);
        } catch (err) {
            setError(err.response?.status === 404 ? "Beneficiary not found or belongs to another shop." : "Search failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h3>Beneficiary Lookup</h3>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <input
                    type="text"
                    placeholder="Enter Ration Card Number"
                    value={rationCard}
                    onChange={(e) => setRationCard(e.target.value)}
                    required
                    style={{ flexGrow: 1, padding: "0.5rem" }}
                />
                <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem" }}>
                    {loading ? "Searching..." : "Lookup"}
                </button>
            </form>

            {error && <p style={{ color: "red" }}>{error}</p>}

            {beneficiary && (
                <div style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: "4px" }}>
                    <h4>Beneficiary Details</h4>
                    <p><strong>Name:</strong> {beneficiary.name}</p>
                    <p><strong>Ration Card:</strong> {beneficiary.ration_card}</p>
                    <p><strong>Family Members:</strong> {beneficiary.family_members}</p>
                    <p><strong>Shop ID:</strong> {beneficiary.shop_id}</p>
                    <p>
                        <strong>Account Status:</strong>{" "}
                        <span style={{ color: beneficiary.account_status === "active" ? "green" : "orange" }}>
                            {beneficiary.account_status.toUpperCase()}
                        </span>
                    </p>

                    {beneficiary.account_status !== "active" && (
                        <div style={{ backgroundColor: "#fff3cd", color: "#856404", padding: "10px", marginTop: "10px", border: "1px solid #ffeeba" }}>
                            ⚠️ WARNING: This account is not active. Please complete mobile verification and PIN setup.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BeneficiaryLookup;
