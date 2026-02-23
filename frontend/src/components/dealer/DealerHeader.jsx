import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Activity } from 'lucide-react';

export default function DealerHeader() {
    const { user, logout } = useAuth();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <header className="bg-[#003366] text-white sticky top-0 z-40 border-b-4 border-[#005A9C] shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">

                    <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold tracking-tight">RationShield</span>
                            <span className="ml-2 pl-2 border-l border-white/30 text-sm opacity-90 hidden sm:block">
                                Fair Price Shop Portal
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="hidden md:flex items-center space-x-2 text-sm bg-[#002244] px-3 py-1 rounded-sm border border-white/10">
                            <Activity className="w-4 h-4" />
                            <span className="opacity-90">System Status:</span>
                            <span className={`font-semibold flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                {isOnline ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-semibold">{user?.dealer_name || 'Dealer'}</div>
                                <div className="text-xs opacity-75">ID: {user?.shop_id || 'N/A'}</div>
                            </div>
                            <button
                                onClick={() => logout()}
                                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 transition-colors px-3 py-2 rounded-sm text-sm font-medium border border-transparent focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
