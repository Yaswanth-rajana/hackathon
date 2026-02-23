import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCitizenAuth } from '../context/CitizenAuthContext';
import { useAlert } from '../context/AlertContext';
import dealerApi from '../services/dealerApi';
import { authActions as citizenAuthActions } from '../services/citizenApi';
import { Lock, User } from 'lucide-react';

export default function DealerLogin() {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [loginType, setLoginType] = useState('citizen'); // 'citizen', 'dealer', or 'admin'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login: dealerLogin, isAuthenticated: isDealerAuthenticated } = useAuth();
    const { login: citizenLogin, isAuthenticated: isCitizenAuthenticated } = useCitizenAuth();
    const { showAlert } = useAlert();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (isDealerAuthenticated) {
            const from = location.state?.from?.pathname || '/dealer/dashboard';
            navigate(from, { replace: true });
        } else if (isCitizenAuthenticated) {
            const from = location.state?.from?.pathname || '/citizen/dashboard';
            navigate(from, { replace: true });
        }
    }, [isDealerAuthenticated, isCitizenAuthenticated, navigate, location]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!credentials.username || !credentials.password) {
            showAlert(`Please enter both ${loginType === 'dealer' ? 'Shop ID' : loginType === 'admin' ? 'Admin ID' : 'Ration Card'} and Password.`, 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            if (loginType === 'citizen') {
                const response = await citizenAuthActions.login({
                    ration_card: credentials.username,
                    password: credentials.password
                });

                const data = response.data;
                citizenLogin(data.access_token, {
                    ration_card: data.user_id,
                    role: data.role
                });

                showAlert('Login successful.', 'success');
                navigate('/citizen/dashboard', { replace: true });
            } else {
                // Use the general login endpoint that supports Admin, Dealer, and Inspector
                const response = await dealerApi.post('/auth/login', {
                    mobile: credentials.username, // Backend checks mobile/user_id
                    password: credentials.password
                });

                const data = response.data;

                // Optional: enforce role match
                if (loginType === 'admin' && data.role !== 'admin') {
                    showAlert('Access denied. You do not have admin privileges.', 'error');
                    setIsSubmitting(false);
                    return;
                }
                if (loginType === 'dealer' && data.role !== 'dealer') {
                    showAlert('Access denied. You are not a registered dealer.', 'error');
                    setIsSubmitting(false);
                    return;
                }

                // The backend /auth/login returns: access_token, token_type, role, user_id, district
                dealerLogin(data.access_token, {
                    shop_id: data.user_id, // For UI consistency
                    dealer_name: data.user_id,
                    role: data.role,
                    district: data.district
                });

                showAlert('Login successful.', 'success');

                // Route based on role
                if (data.role === 'admin') {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/dealer/dashboard', { replace: true });
                }
            }
        } catch (err) {
            showAlert(err.response?.data?.detail || 'Invalid credentials or server error.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <h2 className="text-3xl font-extrabold text-[#003366] tracking-tight">
                    RationShield
                </h2>
                <p className="mt-2 text-sm text-gray-600 font-medium uppercase tracking-widest">
                    Citizen & Dealer Portal
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 border border-[#D1D5DB] shadow-sm rounded-sm sm:px-10 border-t-4 border-t-[#005A9C]">
                    <div className="mb-6 pb-4 border-b border-gray-100 flex items-center justify-center gap-2">
                        <Lock className="w-5 h-5 text-[#003366]" />
                        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                            Dealer Login
                        </h3>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-sm mb-6 pb-0 pt-0">
                        <button
                            type="button"
                            onClick={() => setLoginType('citizen')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${loginType === 'citizen' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Citizen
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginType('dealer')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${loginType === 'dealer' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Dealer
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginType('admin')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors ${loginType === 'admin' ? 'bg-white shadow-sm text-[#003366]' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Admin
                        </button>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                {loginType === 'dealer' ? 'Shop ID / Mobile' : loginType === 'admin' ? 'Admin ID / Mobile' : 'Ration Card Number'}
                            </label>
                            <div className="mt-1 relative rounded-sm shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    name="username"
                                    type="text"
                                    required
                                    autoComplete="username"
                                    value={credentials.username}
                                    onChange={handleChange}
                                    className="pl-10 block w-full border border-gray-300 rounded-sm py-2 focus:ring-[#003366] focus:border-[#003366] sm:text-sm"
                                    placeholder={loginType === 'dealer' ? "Enter authorized Shop ID" : loginType === 'admin' ? "Enter Admin ID" : "e.g. WAP123456789"}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                Password / Secure PIN
                            </label>
                            <div className="mt-1 relative rounded-sm shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    value={credentials.password}
                                    onChange={handleChange}
                                    className="pl-10 block w-full border border-gray-300 rounded-sm py-2 focus:ring-[#003366] focus:border-[#003366] sm:text-sm"
                                    placeholder="Enter password"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-sm shadow-sm text-sm font-bold uppercase tracking-wider text-white bg-[#003366] hover:bg-[#002244] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#003366] disabled:bg-[#003366]/60 transition-colors"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        Authenticating...
                                    </>
                                ) : (
                                    'Secure Login'
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-500">
                            {loginType === 'citizen'
                                ? "Log in with your Ration Card to view entitlements and transaction details."
                                : loginType === 'dealer'
                                    ? "This system is restricted to authorized FPS dealers only."
                                    : "This system is restricted to Civil Supplies administrators only."}
                            <br />
                            Unauthorized access is strictly prohibited and logged.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
