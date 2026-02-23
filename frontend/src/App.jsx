import React, { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DealerLogin from "./pages/DealerLogin";
import DealerDashboard from "./pages/DealerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import CitizenProtectedRoute from "./routes/CitizenProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Alert from "./components/common/Alert";

// Lazy Loaded Layout & Pages
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const ComplaintsPage = lazy(() => import("./pages/admin/ComplaintsPage"));
const AuditsPage = lazy(() => import("./pages/admin/AuditsPage"));
const RecommendationsPage = lazy(() => import("./pages/admin/RecommendationsPage"));
const LogsPage = lazy(() => import("./pages/admin/LogsPage"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const PerformancePage = lazy(() => import("./pages/admin/PerformancePage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const ForecastPage = lazy(() => import("./pages/admin/ForecastPage"));
const DealersPage = lazy(() => import("./pages/admin/DealersPage"));
const ExplorerPage = lazy(() => import("./pages/admin/ExplorerPage"));

const CitizenDashboard = lazy(() => import("./pages/CitizenDashboard"));

function App() {
  return (
    <>
      <Alert />
      <Routes>
        <Route path="/dealer/login" element={<DealerLogin />} />
        <Route path="/login" element={<Navigate to="/dealer/login" replace />} />

        <Route
          path="/dealer/dashboard"
          element={
            <ProtectedRoute allowedRole="dealer">
              <ErrorBoundary>
                <DealerDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route path="/dealer" element={<Navigate to="/dealer/dashboard" replace />} />

        {/* --- Citizen Routes --- */}
        <Route
          path="/citizen/dashboard"
          element={
            <CitizenProtectedRoute>
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading Citizen Portal...</div>}>
                  <CitizenDashboard />
                </React.Suspense>
              </ErrorBoundary>
            </CitizenProtectedRoute>
          }
        />
        <Route path="/citizen" element={<Navigate to="/citizen/dashboard" replace />} />

        {/* --- Admin Routes --- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading Area...</div>}>
                  <AdminLayout />
                </React.Suspense>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={
            <ErrorBoundary>
              <AdminDashboard />
            </ErrorBoundary>
          } />
          <Route path="complaints" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Complaints...</div>}>
                <ComplaintsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="audits" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Audits...</div>}>
                <AuditsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="recommendations" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Recommendations...</div>}>
                <RecommendationsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="logs" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Logs...</div>}>
                <LogsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="analytics" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Analytics...</div>}>
                <AnalyticsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="performance" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Performance...</div>}>
                <PerformancePage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="reports" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Reports...</div>}>
                <ReportsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="forecast" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Forecast...</div>}>
                <ForecastPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="dealers" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Dealers...</div>}>
                <DealersPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="explorer" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Ledger...</div>}>
                <ExplorerPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
        </Route>
        {/* Root redirect to login for now */}
        <Route path="/" element={<Navigate to="/dealer/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
