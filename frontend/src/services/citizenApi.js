import axios from 'axios';

const citizenApi = axios.create({
    baseURL: 'http://localhost:8000/api',
    withCredentials: true,
});

citizenApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('citizen_access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

citizenApi.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject })
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return citizenApi(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post(
                    'http://localhost:8000/api/auth/refresh',
                    {},
                    { withCredentials: true }
                );

                const newToken = response.data.access_token;
                localStorage.setItem('citizen_access_token', newToken);

                // Assuming role: "citizen" is returned
                if (response.data.role !== 'citizen') {
                    throw new Error("Invalid role derived from refresh");
                }

                citizenApi.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

                processQueue(null, newToken);
                return citizenApi(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem('citizen_access_token');
                localStorage.removeItem('citizen_info');
                window.dispatchEvent(new Event('citizen_auth:unauthorized'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export const authActions = {
    login: (credentials) => citizenApi.post('/auth/citizen-login', credentials),
    logout: () => citizenApi.post('/auth/logout')
};

export const citizenActions = {
    getProfile: () => citizenApi.get('/citizen/profile').then(res => res.data),
    getEntitlement: () => citizenApi.get('/citizen/entitlement').then(res => res.data),
    getShop: () => citizenApi.get('/citizen/shop').then(res => res.data),
    getTransactions: () => citizenApi.get('/citizen/transactions').then(res => res.data),
    getComplaints: () => citizenApi.get('/citizen/complaints').then(res => res.data),
    fileComplaint: (data) => citizenApi.post('/citizen/complaint', data).then(res => res.data),
    getNotifications: () => citizenApi.get('/citizen/notifications').then(res => res.data),
    getFamily: () => citizenApi.get('/citizen/family').then(res => res.data),
    addFamily: (data) => citizenApi.post('/citizen/family', data).then(res => res.data),
    deleteFamily: (id) => citizenApi.delete(`/citizen/family/${id}`).then(res => res.data),
    getNearbyShops: (lat, lng) => citizenApi.get(`/citizen/nearby-shops?lat=${lat}&lng=${lng}`).then(res => res.data)
};

export const blockchainActions = {
    getBlock: (index) => citizenApi.get(`/blockchain/blocks/${index}`).then(res => res.data)
};

export default citizenApi;
