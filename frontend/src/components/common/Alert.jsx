import { useAlert } from '../../context/AlertContext';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for strict Government-style tailwind merging
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function Alert() {
    const { alert, hideAlert } = useAlert();

    if (!alert) return null;

    const typeConfig = {
        success: {
            bg: 'bg-[#F0FDF4]',
            border: 'border-[#1B5E20]',
            text: 'text-[#1B5E20]',
            icon: <CheckCircle className="w-5 h-5 text-[#1B5E20]" />,
        },
        error: {
            bg: 'bg-[#FEF2F2]',
            border: 'border-[#B91C1C]',
            text: 'text-[#B91C1C]',
            icon: <XCircle className="w-5 h-5 text-[#B91C1C]" />,
        },
        warning: {
            bg: 'bg-[#FFFBEB]',
            border: 'border-[#B45309]',
            text: 'text-[#B45309]',
            icon: <AlertTriangle className="w-5 h-5 text-[#B45309]" />,
        },
        info: {
            bg: 'bg-[#F0F9FF]',
            border: 'border-[#003366]',
            text: 'text-[#003366]',
            icon: <Info className="w-5 h-5 text-[#003366]" />,
        }
    };

    const config = typeConfig[alert.type] || typeConfig.info;

    return (
        <div className="fixed top-20 right-4 z-[9999] flex items-start max-w-sm w-full shadow-sm animate-in slide-in-from-top-2">
            <div className={cn(
                "flex w-full overflow-hidden border-l-4 rounded-sm bg-white shadow-sm ring-1 ring-black/5",
                config.border
            )}>
                <div className="flex items-center justify-center w-12 bg-white">
                    {config.icon}
                </div>

                <div className="px-4 py-3 w-full border-l border-gray-100 dark:border-gray-800">
                    <p className={cn("text-sm font-semibold", config.text)}>
                        {alert.type === 'error' ? 'System Error' : alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {alert.message}
                    </p>
                </div>

                <button
                    onClick={hideAlert}
                    className="px-3 hover:bg-gray-50 flex items-center justify-center border-l border-gray-100"
                >
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        </div>
    );
}
