import React from "react";

const SuccessModal = ({ data, onClose }) => {
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    backgroundColor: "white",
                    padding: "2rem",
                    borderRadius: "8px",
                    maxWidth: "500px",
                    width: "90%",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
            >
                <h2 style={{ color: "#28a745", textAlign: "center" }}>🎉 Transaction Successful</h2>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: "1.2rem", margin: "1rem 0" }}>
                    ✅ Recorded on Blockchain
                </p>

                <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "4px", fontSize: "0.9rem", color: "#333" }}>
                    <p><strong>Transaction ID:</strong> {data.transaction_id}</p>
                    <p><strong>Block Index:</strong> {data.block_index}</p>
                    <p style={{ wordBreak: "break-all" }}>
                        <strong>Block Hash:</strong> <br />
                        <span style={{ fontFamily: "monospace", display: "block", marginTop: "5px", padding: "5px", border: "1px dashed #ccc", backgroundColor: "#fff", color: "#000" }}>
                            {data.block_hash}
                        </span>
                    </p>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: "100%",
                        marginTop: "1.5rem",
                        padding: "0.75rem",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    Close & Next
                </button>
            </div>
        </div>
    );
};

export default SuccessModal;
