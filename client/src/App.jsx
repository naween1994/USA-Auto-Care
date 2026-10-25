import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppLayout } from './components/AppLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CustomersPage } from './pages/CustomersPage.jsx';
import { VehiclesPage } from './pages/VehiclesPage.jsx';
import { AppointmentsPage } from './pages/AppointmentsPage.jsx';
import { JobCardsPage } from './pages/JobCardsPage.jsx';
import { MechanicMobilePage } from './pages/MechanicMobilePage.jsx';
import { EstimatesPage } from './pages/EstimatesPage.jsx';
import { InventoryPage } from './pages/InventoryPage.jsx';
import { BillingPage } from './pages/BillingPage.jsx';
import { RemindersPage } from './pages/RemindersPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { AdminManagementPage } from './pages/AdminManagementPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});

function ProtectedRoute({ allowedRoles, children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-sm text-slate-500">Verifying session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="vehicles" element={<VehiclesPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="job-cards" element={<JobCardsPage />} />
              <Route path="mechanic-bay" element={<MechanicMobilePage />} />
              <Route path="estimates" element={<EstimatesPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
