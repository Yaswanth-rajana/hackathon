import api from './api';

const adminSimulationApi = {
    injectGhosts: (shopId, count, seed) =>
        api.post(`/admin/simulate/ghost/${shopId}`, { count, seed }),

    injectStockMismatch: (shopId, inflationFactor, monthYear) =>
        api.post(`/admin/simulate/mismatch/${shopId}`, { inflation_factor: inflationFactor, month_year: monthYear }),

    injectComplaints: (shopId, count, seed) =>
        api.post(`/admin/simulate/complaints/${shopId}`, { count, seed }),

    resetDemo: (shopId) =>
        api.post(`/admin/simulate/reset/${shopId}`),

    runAudit: (shopId) =>
        api.post(`/admin/audit/run/${shopId}`),

    getEvents: (shopId) =>
        api.get(`/admin/simulate/events/${shopId}`),
};

export default adminSimulationApi;
