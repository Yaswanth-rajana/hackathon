import { Navigate } from 'react-router-dom';
import { useCitizenAuth } from '../context/CitizenAuthContext';

export default function CitizenProtectedRoute({ children }) {
    const { isAuthenticated, isLoading, citizen } = useCitizenAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#F5F7FA]">
                <div className="text-center">
                    <div className="w-8 h-8 mx-auto border-4 border-[#003366]/30 border-t-[#003366] rounded-full animate-spin"></div>
                    <p className="mt-4 text-[#003366] font-medium tracking-wide">Authenticating Citizen...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Since it's only for citizen, just verify the role if necessary, though context handles it.
    if (citizen?.role !== 'citizen') {
        return <Navigate to="/login" replace />;
    }

    return children;
}
