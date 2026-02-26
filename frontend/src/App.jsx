import React, { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DealerLogin from "./pages/DealerLogin";
import DealerDashboard from "./pages/DealerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import CitizenProtectedRoute from "./routes/CitizenProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Alert from "./components/common/Alert";
import { Toaster } from "react-hot-toast";


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
const SimulationPage = lazy(() => import("./pages/admin/SimulationPage"));
const LiveMonitorPage = lazy(() => import("./pages/admin/LiveMonitorPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const AlertsPage = lazy(() => import("./pages/admin/AlertsPage"));
const InspectionsPage = lazy(() => import("./pages/admin/governance/InspectionsPage"));

// Intelligence Pages
const AIRiskAnalysisPage = lazy(() => import("./pages/admin/intelligence/AIRiskAnalysisPage"));
const FraudDetectionInsightsPage = lazy(() => import("./pages/admin/intelligence/FraudDetectionInsightsPage"));
const PredictiveTrendsPage = lazy(() => import("./pages/admin/intelligence/PredictiveTrendsPage"));

const CitizenDashboard = lazy(() => import("./pages/CitizenDashboard"));

const UpdateMobilePage = lazy(() => import("./pages/citizen/UpdateMobilePage"));
const UpdatePinPage = lazy(() => import("./pages/citizen/UpdatePinPage"));

function App() {
  return (
    <>
      <Alert />
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>

        <Route path="/login" element={<DealerLogin />} />
        <Route path="/dealer/login" element={<Navigate to="/login" replace />} />

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
        <Route
          path="/citizen/update-mobile"
          element={
            <CitizenProtectedRoute>
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <UpdateMobilePage />
                </React.Suspense>
              </ErrorBoundary>
            </CitizenProtectedRoute>
          }
        />
        <Route
          path="/citizen/update-pin"
          element={
            <CitizenProtectedRoute>
              <ErrorBoundary>
                <React.Suspense fallback={<div>Loading...</div>}>
                  <UpdatePinPage />
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
          <Route path="alerts" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Alerts...</div>}>
                <AlertsPage />
              </React.Suspense>
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
          <Route path="governance/inspections" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Inspections...</div>}>
                <InspectionsPage />
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
          <Route path="simulation" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Simulation...</div>}>
                <SimulationPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="live-monitor" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Live Monitor...</div>}>
                <LiveMonitorPage />
              </React.Suspense>
            </ErrorBoundary>
          } />

          {/* Intelligence Tab Routes */}
          <Route path="intelligence/risk-analysis" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading AI Analysis...</div>}>
                <AIRiskAnalysisPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="intelligence/fraud-insights" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Insights...</div>}>
                <FraudDetectionInsightsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
          <Route path="intelligence/predictive-trends" element={
            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Trends...</div>}>
                <PredictiveTrendsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />

          <Route path="system/config" element={

            <ErrorBoundary>
              <React.Suspense fallback={<div>Loading Settings...</div>}>
                <SettingsPage />
              </React.Suspense>
            </ErrorBoundary>
          } />
        </Route>
        {/* Root redirect to login for now */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
