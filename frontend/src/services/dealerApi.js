import axios from 'axios';

// Base URL for API
const baseURL = import.meta.env.VITE_API_URL || '/api';

const dealerApi = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

dealerApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('dealer_access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

dealerApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Dispatch global event so AuthContext can catch it, clear state, and redirect securely.
            // We also clear localStorage immediately as a fallback.
            localStorage.removeItem('dealer_access_token');
            localStorage.removeItem('dealer_info');
            window.dispatchEvent(new Event('auth:unauthorized'));
        }
        return Promise.reject(error);
    }
);

export default dealerApi;
