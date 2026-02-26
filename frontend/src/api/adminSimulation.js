import api from './api';

const adminSimulationApi = {
    injectGhosts: (shopId, intensity, seed) =>
        api.post(`/admin/simulate/ghost/${shopId}`, { intensity, seed }),

    injectStockMismatch: (shopId, intensity, monthYear) =>
        api.post(`/admin/simulate/mismatch/${shopId}`, { intensity, month_year: monthYear }),

    injectComplaints: (shopId, intensity, seed) =>
        api.post(`/admin/simulate/complaints/${shopId}`, { intensity, seed }),

    resetDemo: (shopId) =>
        api.post(`/admin/simulate/reset/${shopId}`),

    runAudit: (shopId) =>
        api.post(`/admin/audit/run/${shopId}`),

    getEvents: (shopId) =>
        api.get(`/admin/simulate/events/${shopId}`),
};

export default adminSimulationApi;
