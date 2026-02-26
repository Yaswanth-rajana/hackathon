import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { useCitizenAuth } from '../../context/CitizenAuthContext';

export default function UpdateMobilePage() {
    const navigate = useNavigate();
    const { citizen } = useCitizenAuth();
    const { showAlert } = useAlert();
    const [mobile, setMobile] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (mobile.length !== 10) {
            showAlert("Please enter a valid 10-digit mobile number", "error");
            return;
        }
        setIsSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            showAlert("Request submitted. You will receive an OTP on your new number soon.", "success");
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
                            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-900/20">
                                <Phone className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight">Update Mobile</h1>
                        </div>
                        <p className="text-blue-300 text-xs font-black uppercase tracking-widest">Secure Profile Modification</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-8">
                        <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
                            <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                            <p className="text-sm text-blue-800 font-medium leading-relaxed">
                                Updating your registered mobile number requires biometric verification or Aadhaar OTP authentication in the next step.
                            </p>
                        </div>

                        <div>
                            <label className="block text-gray-400 font-black uppercase tracking-widest text-[10px] mb-2 ml-1">New Mobile Number</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">+91</span>
                                <input
                                    type="text"
                                    required
                                    maxLength={10}
                                    value={mobile}
                                    onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Enter 10 digits"
                                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-bold focus:ring-2 focus:ring-[#003366] focus:bg-white transition-all outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-[#003366] hover:bg-[#002244] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Processing Request...' : 'Request Update'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
