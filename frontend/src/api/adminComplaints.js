import api from "./api";

let complaintsAbortController = null;

export const adminComplaintsAPI = {
    getComplaints: async (params) => {
        if (complaintsAbortController) {
            complaintsAbortController.abort();
        }
        complaintsAbortController = new AbortController();

        const response = await api.get("/admin/complaints", {
            params,
            signal: complaintsAbortController.signal
        });
        return response.data;
    },

    getComplaintById: async (id) => {
        const response = await api.get(`/admin/complaints/${id}`);
        return response.data;
    },

    assignInspector: async (id, inspectorId) => {
        const response = await api.patch(`/admin/complaints/${id}/assign`, { inspector_id: inspectorId });
        return response.data;
    },

    addNote: async (id, note) => {
        const response = await api.post(`/admin/complaints/${id}/note`, { note });
        return response.data;
    },

    resolveComplaint: async (id, resolution_notes) => {
        const response = await api.patch(`/admin/complaints/${id}/resolve`, { resolution_notes });
        return response.data;
    }
};
