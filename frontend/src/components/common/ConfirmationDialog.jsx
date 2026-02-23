import { AlertTriangle } from 'lucide-react';

export default function ConfirmationDialog({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    isDestructive = false
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-sm shadow-xl max-w-md w-full border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full flex-shrink-0 ${isDestructive ? 'bg-red-50' : 'bg-blue-50'}`}>
                            <AlertTriangle className={`w-6 h-6 ${isDestructive ? 'text-red-600' : 'text-[#003366]'}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003366] transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDestructive
                                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                                : 'bg-[#003366] hover:bg-[#002244] focus:ring-[#003366]'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
