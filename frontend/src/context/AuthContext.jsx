import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize from local storage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('dealer_access_token');
        const storedUser = localStorage.getItem('dealer_info');

        if (storedToken && storedUser && storedUser !== 'undefined') {
            try {
                const parsedUser = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(parsedUser);
            } catch (e) {
                console.error("Failed to parse stored user info", e);
                localStorage.removeItem('dealer_access_token');
                localStorage.removeItem('dealer_info');
                setToken(null);
            }
        } else {
            localStorage.removeItem('dealer_access_token');
            localStorage.removeItem('dealer_info');
        }
        setIsLoading(false);

        // Listen for unauthorized events from axios interceptor
        const handleUnauthorized = () => {
            logout(true); // pass true to specify it's a forced logout without redirect if needed, or just let routing handle it.
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = useCallback((newToken, userInfo) => {
        setToken(newToken);
        setUser(userInfo);
        localStorage.setItem('dealer_access_token', newToken);
        localStorage.setItem('dealer_info', JSON.stringify(userInfo));
    }, []);

    const logout = useCallback((forced = false) => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('dealer_access_token');
        localStorage.removeItem('dealer_info');

        // Prevent redirect loop if already on login page
        if (window.location.pathname !== '/dealer/login') {
            window.location.href = '/dealer/login';
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
