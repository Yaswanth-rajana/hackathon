import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const ws = useRef(null);
    const reconnectTimeout = useRef(null);

    const connect = () => {
        if (!user?.district) return; // Need district to connect

        // WS URL. Note: Assumes backend is running on same host or API URL mapping
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Hackathon backend usually running on localhost:8000
        const host = import.meta.env.VITE_API_BASE_URL
            ? import.meta.env.VITE_API_BASE_URL.replace('http://', '').replace('https://', '')
            : 'localhost:8000';

        const wsUrl = `${protocol}//${host}/ws/admin/${user.district}`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log('Admin WebSocket connected');
            setConnected(true);
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // Ensure the event is for our district (backend scoping handles this, just a double check)
                if (message.district === user.district) {
                    setLastMessage(message);
                }
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };

        ws.current.onclose = () => {
            console.log('Admin WebSocket disconnected');
            setConnected(false);
            // Reconnect after 3 seconds
            reconnectTimeout.current = setTimeout(connect, 3000);
        };

        ws.current.onerror = (err) => {
            console.error('WebSocket Error:', err);
            ws.current.close();
        };
    };

    useEffect(() => {
        if (user && user.role === 'admin') {
            connect();
        }

        return () => {
            if (ws.current) {
                ws.current.close();
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [user]);

    return (
        <WebSocketContext.Provider value={{ connected, lastMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useAdminWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useAdminWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
