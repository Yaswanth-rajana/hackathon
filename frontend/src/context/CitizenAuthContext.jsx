import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CitizenAuthContext = createContext(null);

export const CitizenAuthProvider = ({ children }) => {
    const [citizen, setCitizen] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('citizen_access_token');
        const storedCitizen = localStorage.getItem('citizen_info');

        if (storedToken && storedCitizen && storedCitizen !== 'undefined') {
            try {
                const parsedCitizen = JSON.parse(storedCitizen);
                setToken(storedToken);
                setCitizen(parsedCitizen);
            } catch (e) {
                console.error("Failed to parse stored citizen info", e);
                localStorage.removeItem('citizen_access_token');
                localStorage.removeItem('citizen_info');
                setToken(null);
            }
        } else {
            localStorage.removeItem('citizen_access_token');
            localStorage.removeItem('citizen_info');
        }
        setIsLoading(false);

        const handleUnauthorized = () => {
            logout();
        };

        window.addEventListener('citizen_auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('citizen_auth:unauthorized', handleUnauthorized);
    }, []);

    const login = useCallback((newToken, citizenInfo) => {
        setToken(newToken);
        setCitizen(citizenInfo);
        localStorage.setItem('citizen_access_token', newToken);
        localStorage.setItem('citizen_info', JSON.stringify(citizenInfo));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setCitizen(null);
        localStorage.removeItem('citizen_access_token');
        localStorage.removeItem('citizen_info');

        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }, []);

    return (
        <CitizenAuthContext.Provider value={{ citizen, token, isLoading, login, logout, isAuthenticated: !!token }}>
            {children}
        </CitizenAuthContext.Provider>
    );
};

export const useCitizenAuth = () => useContext(CitizenAuthContext);
