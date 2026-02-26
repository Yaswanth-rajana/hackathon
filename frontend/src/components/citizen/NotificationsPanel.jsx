import React, { useEffect, useState } from 'react';
import { Bell, MessageSquareWarning } from 'lucide-react';
import { citizenActions } from '../../services/citizenApi';

export default function NotificationsPanel() {
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const data = await citizenActions.getNotifications();
                setNotifications(Array.isArray(data) ? data : []);
            } catch (e) {
                setNotifications([]);
            } finally {
                setLoading(false);
            }
        };
        loadNotifications();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-[#003366]">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-[#F3F6FF] rounded-full">
                    <Bell className="w-5 h-5 text-[#003366]" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recent Notifications</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Distribution and system receipts</p>
                </div>
            </div>

            {loading ? (
                <div className="text-sm text-gray-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MessageSquareWarning className="w-4 h-4" />
                    No notifications yet.
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((n) => (
                        <div key={n.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{n.type}</span>
                                <span className="text-[11px] text-gray-400">
                                    {new Date(n.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{n.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
