import axios from "axios";

const api = axios.create({
    baseURL: "/api",
});

api.interceptors.request.use((config) => {
    // Read the token from the location AuthContext uses
    const token = localStorage.getItem("dealer_access_token") || localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const district = localStorage.getItem("selected_district") || "Visakhapatnam";
    config.headers['X-District'] = district;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Signal AuthContext to handle the logout gracefully
            window.dispatchEvent(new Event('auth:unauthorized'));
        } else if (error.response?.status === 429) {
            alert("Too many requests. Please try again later.");
        } else if (error.response?.status >= 500) {
            alert("A server error broke the request. We are looking into it.");
        }
        return Promise.reject(error);
    }
);

export default api;
