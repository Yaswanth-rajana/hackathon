import React, { useState, useEffect } from "react";
import { adminComplaintsAPI } from "../api/adminComplaints";
import useDebounce from "../hooks/useDebounce";
import ComplaintDetailsModal from "./ComplaintDetailsModal";

const ComplaintsTab = () => {
    const [complaints, setComplaints] = useState([]);
    const [selectedComplaintId, setSelectedComplaintId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);


    const [filters, setFilters] = useState({
        status: "",
        shop: "",
        search: ""
    });
    const debouncedSearch = useDebounce(filters.search, 500);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0
    });

    const loadComplaints = async () => {
        setIsLoading(true);
        try {
            const data = await adminComplaintsAPI.getComplaints({
                status: filters.status,
                shop: filters.shop,
                search: debouncedSearch,
                page: pagination.page,
                limit: pagination.limit
            });
            // Handle if API returns { data: [...], total: ... } or just array based on hackathon structure
            if (data.data && Array.isArray(data.data)) {
                setComplaints(data.data);
                setPagination(prev => ({ ...prev, total: data.total || data.data.length }));
            } else if (Array.isArray(data)) {
                setComplaints(data);
                setPagination(prev => ({ ...prev, total: data.length }));
            } else {
                setComplaints([]);
            }
        } catch (error) {
            // Ignore abort errors from rapid typing
            if (error.name !== "CanceledError") {
                console.error("Failed to load complaints:", error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadComplaints();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.shop, debouncedSearch, pagination.page, pagination.limit]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPagination(prev => ({ ...prev, page: 1 })); // reset page on filter
    };

    const handleComplaintUpdate = (updatedComplaint) => {
        setComplaints(prev => prev.map(c => c.id === updatedComplaint.id ? updatedComplaint : c));
    };

    const selectedComplaint = complaints.find(c => c.id === selectedComplaintId) || null;


    const maskRationCard = (card) => {
        if (!card || card.length < 8) return card || "N/A";
        return `${card.substring(0, 4)}****${card.substring(card.length - 4)}`;
    };

    const getStatusStyle = (status) => {
        switch (status?.toUpperCase()) {
            case "NEW": return { color: "#dc2626", bg: "#fef2f2", label: "● NEW" };
            case "ASSIGNED": return { color: "#d97706", bg: "#fffbeb", label: "● ASSIGNED" };
            case "INVESTIGATING": return { color: "#ea580c", bg: "#fff7ed", label: "● INVESTIGATING" };
            case "RESOLVED": return { color: "#16a34a", bg: "#f0fdf4", label: "● RESOLVED" };
            default: return { color: "#4b5563", bg: "#f3f4f6", label: `● ${status || "UNKNOWN"}` };
        }
    };

    return (
        <div style={{ backgroundColor: '#ffffff', color: '#111827', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
            {/* Filters Section */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    name="search"
                    placeholder="Search Citizen or Card..."
                    value={filters.search}
                    onChange={handleFilterChange}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', flex: '1', minWidth: '200px', backgroundColor: '#ffffff', color: '#111827' }}
                />
                <select name="status" value={filters.status} onChange={handleFilterChange} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#ffffff', color: '#111827' }}>
                    <option value="">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="INVESTIGATING">Investigating</option>
                    <option value="RESOLVED">Resolved</option>
                </select>
                <input
                    type="text"
                    name="shop"
                    placeholder="Shop ID"
                    value={filters.shop}
                    onChange={handleFilterChange}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', width: '150px', backgroundColor: '#ffffff', color: '#111827' }}
                />
                <button
                    onClick={() => { setFilters({ status: "", shop: "", search: "" }); setPagination({ ...pagination, page: 1 }); }}
                    style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#f3f4f6', color: '#111827', cursor: 'pointer', fontWeight: '500' }}
                >
                    Reset
                </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>ID</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Citizen Name</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Ration Card</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Shop ID</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Type</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Status</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Date</th>
                            <th style={{ padding: '0.75rem', fontWeight: 'bold', color: '#4b5563', fontSize: '0.875rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    {Array.from({ length: 8 }).map((_, colIdx) => (
                                        <td key={colIdx} style={{ padding: '0.75rem' }}>
                                            <div style={{ height: '1rem', backgroundColor: '#e5e7eb', borderRadius: '0.25rem', animation: 'pulse 1.5s infinite' }}></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : complaints.length === 0 ? (
                            <tr><td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No complaints found.</td></tr>
                        ) : (
                            complaints.map(c => {
                                const statusStyle = getStatusStyle(c.status);
                                return (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{String(c.id).substring(0, 8)}...</td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{c.citizen_name}</td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>{maskRationCard(c.ration_card)}</td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{c.shop_id}</td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{c.complaint_type}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                backgroundColor: statusStyle.bg, color: statusStyle.color,
                                                padding: '0.25rem 0.5rem', borderRadius: '9999px',
                                                fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block'
                                            }}>
                                                {statusStyle.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <button
                                                onClick={() => setSelectedComplaintId(c.id)}
                                                style={{ color: '#2563eb', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                    Showing page {pagination.page}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        disabled={pagination.page <= 1}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#ffffff', color: '#111827', ...((pagination.page <= 1) ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }) }}
                    >
                        Previous
                    </button>
                    <button
                        disabled={complaints.length < pagination.limit}
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#ffffff', color: '#111827', ...((complaints.length < pagination.limit) ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }) }}
                    >
                        Next
                    </button>
                </div>
            </div>

            {selectedComplaint && (
                <ComplaintDetailsModal
                    complaint={selectedComplaint}
                    onClose={() => setSelectedComplaintId(null)}
                    onUpdate={handleComplaintUpdate}
                />
            )}

            {/* Adding the pulse animation keyframes for skeletons */}
            <style>
                {`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
                `}
            </style>
        </div>
    );
};

export default ComplaintsTab;
