import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const ws = useRef(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef(null);
    const onConnectCallbacks = useRef(new Set());

    const registerOnConnect = (callback) => {
        onConnectCallbacks.current.add(callback);
        return () => onConnectCallbacks.current.delete(callback);
    };

    const connect = () => {
        if (!user?.district) return;

        // Prevent multiple connections
        if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // Extract host from VITE_API_BASE_URL or fallback to current window host
        let host = import.meta.env.VITE_API_BASE_URL
            ? import.meta.env.VITE_API_BASE_URL.replace(/^https?:\/\//, '').split('/')[0]
            : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost:8000' : window.location.hostname + ':8000');

        const wsUrl = `${protocol}//${host}/ws/admin/${user.district}`;

        console.log(`[WS] 🔌 Attempting connection: ${wsUrl}`);
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            console.log(`[WS] ✅ Admin WebSocket connected to ${user.district}`);
            setConnected(true);
            reconnectAttempts.current = 0;

            onConnectCallbacks.current.forEach(callback => {
                try { callback(); } catch (e) { console.error("[WS] Callback error:", e); }
            });

            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
        };

        ws.current.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.district === user.district) {
                    setLastMessage(message);
                }
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };

        ws.current.onclose = (event) => {
            console.log(`[WS] ❌ Disconnected from ${user.district} (Code: ${event.code})`);
            setConnected(false);

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, maxing at 30s
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current += 1;

            console.log(`[WS] 🔄 Scheduling reconnect in ${delay}ms (Attempt ${reconnectAttempts.current})`);

            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = setTimeout(connect, delay);
        };

        ws.current.onerror = (err) => {
            console.error('[WS] ⚠️ WebSocket Error:', err);
            // onclose will handle the reconnection
            if (ws.current) ws.current.close();
        };
    };

    useEffect(() => {
        if (user && user.role === 'admin') {
            connect();
        }

        return () => {
            if (ws.current) {
                ws.current.onclose = null; // Prevent reconnect on unmount
                ws.current.close();
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [user]);

    return (
        <WebSocketContext.Provider value={{ connected, lastMessage, registerOnConnect }}>
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
