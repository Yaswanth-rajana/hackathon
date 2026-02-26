import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

export default function UpdatePinPage() {
    const navigate = useNavigate();
    const { showAlert } = useAlert();
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (pin.length < 4) {
            showAlert("PIN must be at least 4 digits", "error");
            return;
        }
        if (pin !== confirmPin) {
            showAlert("PINs do not match", "error");
            return;
        }
        setIsSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            showAlert("Portal PIN updated successfully", "success");
            setIsSubmitting(false);
            navigate('/citizen/dashboard');
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#F5F7FA] font-sans text-gray-800 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/citizen/dashboard')}
                    className="flex items-center gap-2 text-[#003366] font-black uppercase tracking-widest text-xs mb-8 hover:opacity-70 transition-opacity"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>

                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="bg-[#003366] p-10 text-white">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-900/20">
                                <Lock className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight">Update PIN</h1>
                        </div>
                        <p className="text-amber-300 text-xs font-black uppercase tracking-widest">Security Credentials</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-8">
                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                            <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                            <p className="text-sm text-amber-800 font-medium leading-relaxed">
                                Your PIN is used to access the portal and verify transactions. Choose a secure, non-sequential PIN.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">New 4-6 Digit PIN</label>
                                <div className="relative">
                                    <input
                                        type={showPin ? "text" : "password"}
                                        required
                                        maxLength={6}
                                        value={pin}
                                        onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="••••"
                                        className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-bold tracking-[1em] focus:ring-2 focus:ring-[#003366] focus:bg-white transition-all outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">Confirm New PIN</label>
                                <input
                                    type={showPin ? "text" : "password"}
                                    required
                                    maxLength={6}
                                    value={confirmPin}
                                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                    placeholder="••••"
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-bold tracking-[1em] focus:ring-2 focus:ring-[#003366] focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Updating Credentials...' : 'Set New PIN'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
