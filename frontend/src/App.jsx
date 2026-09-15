import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import TenantLayout from './layouts/TenantLayout';
import AdminLayout from './layouts/AdminLayout';

// Tenant Pages
import TenantLogin from './pages/tenant/TenantLogin';
import TenantHome from './pages/tenant/TenantHome';
import TenantElectricity from './pages/tenant/TenantElectricity';
import TenantWater from './pages/tenant/TenantWater';
import TenantHistory from './pages/tenant/TenantHistory';
import TenantContract from './pages/tenant/TenantContract';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRooms from './pages/admin/AdminRooms';
import AdminTenants from './pages/admin/AdminTenants';
import AdminMeters from './pages/admin/AdminMeters';
import AdminBills from './pages/admin/AdminBills';
import AdminContracts from './pages/admin/AdminContracts';
import AdminAudit from './pages/admin/AdminAudit';

// Landing Page
import LandingPage from './pages/LandingPage';

// Loading Components
import { AppLoadingScreen } from './components/loading/LoadingComponents';

const TenantProtectedRoute = ({ children }) => {
  const { tenant, loading } = useAuth();
  if (loading) return <AppLoadingScreen variant="tenant" />;
  if (!tenant) return <Navigate to="/#rooms" replace />;
  return children;
};

const AdminProtectedRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  if (loading) return <AppLoadingScreen variant="admin" />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing Page with Rooms Catalog & Room-Scoped Login Pop-up */}
          <Route path="/" element={<LandingPage />} />

          {/* Tenant Routes (Redirect unauthenticated to Landing Page #rooms) */}
          <Route path="/tenant/login" element={<Navigate to="/#rooms" replace />} />
          <Route
            path="/tenant"
            element={
              <TenantProtectedRoute>
                <TenantLayout />
              </TenantProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/tenant/home" replace />} />
            <Route path="home" element={<TenantHome />} />
            <Route path="electricity" element={<TenantElectricity />} />
            <Route path="water" element={<TenantWater />} />
            <Route path="history" element={<TenantHistory />} />
            <Route path="contract" element={<TenantContract />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="meters" element={<AdminMeters />} />
            <Route path="bills" element={<AdminBills />} />
            <Route path="contracts" element={<AdminContracts />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>

          {/* Catch-all to Landing Page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
