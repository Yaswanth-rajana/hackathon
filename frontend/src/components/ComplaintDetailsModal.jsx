import React, { useState } from "react";
import { adminComplaintsAPI } from "../api/adminComplaints";

const ComplaintDetailsModal = ({ complaint, onClose, onUpdate }) => {
    const [selectedInspector, setSelectedInspector] = useState("");
    const [noteText, setNoteText] = useState("");
    const [resolutionNotes, setResolutionNotes] = useState("");

    // Status states for buttons
    const [isAssigning, setIsAssigning] = useState(false);
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);

    // Hardcoded mock inspector list for hackathon demo
    const mockInspectors = [
        { id: "insp_1", name: "Inspector Kumar" },
        { id: "insp_2", name: "Ravi Shankar" },
        { id: "insp_3", name: "Suresh Reddy" }
    ];

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const extractErrorMessage = (error) => {
        return error.response?.data?.detail || error.response?.data?.message || error.message || "An unexpected error occurred.";
    };

    const handleAssign = async () => {
        if (!selectedInspector) {
            showToast("Please select an inspector.");
            return;
        }
        setIsAssigning(true);
        const previousComplaint = structuredClone(complaint);
        const updatedComplaint = {
            ...complaint,
            inspector_id: selectedInspector,
            status: complaint.status === "NEW" ? "ASSIGNED" : complaint.status
        };

        // Optimistic UI Update
        onUpdate(updatedComplaint);

        try {
            await adminComplaintsAPI.assignInspector(complaint.id, selectedInspector);
            showToast("Inspector assigned successfully.");
        } catch (error) {
            console.error(error);
            onUpdate(previousComplaint);
            showToast(`Failed to assign: ${extractErrorMessage(error)}`);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) {
            showToast("Note text cannot be empty.");
            return;
        }
        setIsAddingNote(true);
        const previousComplaint = structuredClone(complaint);

        const newNote = {
            id: `note_${Date.now()}`,
            note: noteText,
            timestamp: new Date().toISOString()
        };

        const updatedNotes = complaint.notes ? [...complaint.notes, newNote] : [newNote];
        const updatedComplaint = {
            ...complaint,
            notes: updatedNotes,
            status: complaint.status === "ASSIGNED" || complaint.status === "NEW" ? "INVESTIGATING" : complaint.status
        };

        // Optimistic UI Update
        onUpdate(updatedComplaint);
        setNoteText("");

        try {
            await adminComplaintsAPI.addNote(complaint.id, noteText);
            showToast("Note added successfully.");
        } catch (error) {
            console.error(error);
            onUpdate(previousComplaint);
            setNoteText(previousComplaint.notes ? previousComplaint.notes[previousComplaint.notes.length - 1].note : "");
            showToast(`Failed to add note: ${extractErrorMessage(error)}`);
        } finally {
            setIsAddingNote(false);
        }
    };

    const handleResolve = async () => {
        if (!showResolveConfirm) {
            setShowResolveConfirm(true);
            return;
        }

        if (complaint.status === "RESOLVED") {
            showToast("Complaint is already resolved.");
            setShowResolveConfirm(false);
            return;
        }

        setIsResolving(true);
        const previousComplaint = structuredClone(complaint);

        const updatedComplaint = {
            ...complaint,
            status: "RESOLVED",
            resolution_notes: resolutionNotes
        };

        // Optimistic UI Update
        onUpdate(updatedComplaint);

        try {
            await adminComplaintsAPI.resolveComplaint(complaint.id, resolutionNotes);
            showToast("Complaint marked as resolved.");
            setTimeout(() => {
                onClose(); // Auto-close modal after success
            }, 1500);
        } catch (error) {
            console.error(error);
            onUpdate(previousComplaint);
            showToast(`Failed to resolve: ${extractErrorMessage(error)}`);
        } finally {
            setIsResolving(false);
            setShowResolveConfirm(false);
        }
    };

    const maskRationCard = (card) => {
        if (!card || card.length < 8) return card || "N/A";
        return `${card.substring(0, 4)}****${card.substring(card.length - 4)}`;
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
            <div style={{ backgroundColor: '#ffffff', color: '#111827', borderRadius: '0.5rem', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                {toastMessage && (
                    <div style={{ backgroundColor: '#374151', color: 'white', padding: '0.75rem 1rem', position: 'absolute', top: '1rem', right: '1rem', borderRadius: '0.375rem', zIndex: 60 }}>
                        {toastMessage}
                    </div>
                )}

                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>Complaint Details</h2>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>ID: {complaint.id}</span>
                    </div>
                    <button onClick={onClose} style={{ fontSize: '1.5rem', color: '#9ca3af', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>&times;</button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Top Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Citizen Name</p>
                            <p style={{ margin: '0.25rem 0', fontWeight: '600' }}>{complaint.citizen_name}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Ration Card</p>
                            <p style={{ margin: '0.25rem 0', fontWeight: '600', fontFamily: 'monospace' }}>{maskRationCard(complaint.ration_card)}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Shop Name / ID</p>
                            <p style={{ margin: '0.25rem 0', fontWeight: '600' }}>{complaint.shop_id}</p>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Type</p>
                            <p style={{ margin: '0.25rem 0', fontWeight: '600' }}>{complaint.complaint_type}</p>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Description</p>
                            <div style={{ margin: '0.5rem 0', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.375rem', color: '#1f2937' }}>
                                {complaint.description || "No description provided."}
                            </div>
                        </div>

                        {/* Fraud Link for Underweight */}
                        {complaint.complaint_type && complaint.complaint_type.toLowerCase() === 'underweight' && (
                            <div style={{ gridColumn: '1 / -1', padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: '0.375rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ backgroundColor: '#991b1b', color: 'white', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>HIGH RISK</span>
                                <span style={{ color: '#b91c1c', fontWeight: '500' }}>⚠️ Related anomaly detected for this shop. </span>
                                <a href="#" style={{ color: '#1d4ed8', textDecoration: 'underline', fontWeight: 'bold', marginLeft: 'auto' }}>View Anomaly &rarr;</a>
                            </div>
                        )}
                    </div>

                    {/* Timeline View */}
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>Activity Timeline</h3>
                        <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '-11px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#6b7280', border: '3px solid white', zIndex: 10 }}></span>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.5rem' }}>
                                    <span style={{ fontWeight: '600', color: '#111827' }}>[🟢] Complaint Created</span> <br />
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(complaint.created_at).toLocaleString()}</span>
                                </p>
                            </div>

                            {complaint.status !== "NEW" && (
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '-11px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '3px solid white', zIndex: 10 }}></span>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.5rem' }}>
                                        <span style={{ fontWeight: '600', color: '#111827' }}>[🟡] Assigned</span> to {complaint.inspector_id || "Inspector"}
                                    </p>
                                </div>
                            )}

                            {complaint.notes && [...complaint.notes].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((n, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '-11px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '3px solid white', zIndex: 10 }}></span>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.5rem' }}>
                                        <span style={{ fontWeight: '600', color: '#111827' }}>[🔵] Note Added:</span> "{n.note}" <br />
                                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
                                    </p>
                                </div>
                            ))}

                            {complaint.status === "RESOLVED" && (
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '-11px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10b981', border: '3px solid white', zIndex: 10 }}></span>
                                    <p style={{ margin: 0, fontSize: '0.875rem', paddingLeft: '1.5rem', fontWeight: 'bold' }}>
                                        <span style={{ color: '#16a34a' }}>[🟢] Resolved</span>
                                    </p>
                                    {complaint.resolution_notes && (
                                        <div style={{ marginLeft: '1.5rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.375rem', fontSize: '0.875rem', color: '#166534', fontStyle: 'italic' }}>
                                            "{complaint.resolution_notes}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Sections */}
                    {complaint.status !== "RESOLVED" && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>

                            {/* A. Assign Inspector */}
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>A. Assign Inspector</h4>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        value={selectedInspector}
                                        onChange={(e) => setSelectedInspector(e.target.value)}
                                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', flex: '1', backgroundColor: '#ffffff', color: '#111827' }}
                                    >
                                        <option value="">Select Inspector...</option>
                                        {mockInspectors.map(insp => (
                                            <option key={insp.id} value={insp.name}>{insp.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAssign}
                                        disabled={isAssigning}
                                        style={{
                                            padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: isAssigning ? 'not-allowed' : 'pointer', opacity: isAssigning ? 0.7 : 1
                                        }}
                                    >
                                        {isAssigning ? "Assigning..." : "Assign"}
                                    </button>
                                </div>
                            </div>

                            {/* B. Investigation Notes */}
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>B. Add Investigation Note</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <textarea
                                        rows={2}
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Type observation here..."
                                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', width: '100%', resize: 'vertical', backgroundColor: '#ffffff', color: '#111827' }}
                                    />
                                    <button
                                        onClick={handleAddNote}
                                        disabled={isAddingNote}
                                        style={{
                                            padding: '0.5rem 1rem', alignSelf: 'flex-start', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: isAddingNote ? 'not-allowed' : 'pointer', opacity: isAddingNote ? 0.7 : 1
                                        }}
                                    >
                                        {isAddingNote ? "Adding..." : "Add Note"}
                                    </button>
                                </div>
                            </div>

                            {/* C. Resolve */}
                            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>C. Resolve Complaint</h4>
                                {showResolveConfirm ? (
                                    <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                                        <p style={{ margin: '0 0 1rem 0', fontWeight: 'bold', color: '#991b1b' }}>Are you sure you want to mark this complaint as resolved? This action cannot be easily undone.</p>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={handleResolve}
                                                disabled={isResolving}
                                                style={{ padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: isResolving ? 'not-allowed' : 'pointer', opacity: isResolving ? 0.7 : 1 }}
                                            >
                                                {isResolving ? "Resolving..." : "Yes, Resolve"}
                                            </button>
                                            <button
                                                onClick={() => setShowResolveConfirm(false)}
                                                disabled={isResolving}
                                                style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#4b5563', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <textarea
                                            rows={2}
                                            value={resolutionNotes}
                                            onChange={(e) => setResolutionNotes(e.target.value)}
                                            placeholder="Resolution details..."
                                            style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', width: '100%', resize: 'vertical', backgroundColor: '#ffffff', color: '#111827' }}
                                        />
                                        <button
                                            onClick={() => setShowResolveConfirm(true)}
                                            style={{
                                                padding: '0.5rem 1rem', alignSelf: 'flex-start', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer'
                                            }}
                                        >
                                            Mark Resolved
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Audit Trailer */}
                <div style={{ marginTop: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#f3f4f6', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Action logged in system audit trail
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ComplaintDetailsModal;
