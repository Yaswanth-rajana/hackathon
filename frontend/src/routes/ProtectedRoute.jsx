import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRole }) => {
    const { user, token, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003366] border-t-transparent"></div>
            </div>
        );
    }

    if (!token && !localStorage.getItem('dealer_access_token')) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRole && user?.role && user.role !== allowedRole) {
        // Fallback or redirect based on role
        if (user.role === 'admin') return <Navigate to="/admin" replace />;
        return <Navigate to="/dealer/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
