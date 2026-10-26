import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    setLoading(true);
    try {
      // Try checking admin session
      try {
        const resAdmin = await api.get('/auth/admin/me');
        if (resAdmin?.data) {
          setAdmin(resAdmin.data);
          if (resAdmin.data.id) {
            localStorage.setItem('admin_session_id', resAdmin.data.id);
          }
        }
      } catch (e) {
        localStorage.removeItem('admin_session_id');
        setAdmin(null);
      }

      // Try checking tenant session
      try {
        const resTenant = await api.get('/auth/tenant/me');
        if (resTenant?.data) {
          setTenant(resTenant.data);
          if (resTenant.data.id) {
            localStorage.setItem('tenant_session_id', resTenant.data.id);
          }
        }
      } catch (e) {
        localStorage.removeItem('tenant_session_id');
        setTenant(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const loginAdmin = async (username, password) => {
    const res = await api.post('/auth/admin/login', { username, password });
    if (res?.data?.id) {
      localStorage.setItem('admin_session_id', res.data.id);
    }
    setAdmin(res.data);
    return res.data;
  };

  const logoutAdmin = async () => {
    try {
      await api.post('/auth/admin/logout');
    } catch (e) {
      console.warn('[Admin Logout Warning]:', e.message);
    } finally {
      localStorage.removeItem('admin_session_id');
      setAdmin(null);
    }
  };

  const loginTenant = async (phone) => {
    const res = await api.post('/auth/tenant/login', { phone });
    if (res?.data?.id) {
      localStorage.setItem('tenant_session_id', res.data.id);
    }
    setTenant(res.data);
    return res.data;
  };

  const requestTenantOTP = async (phone) => {
    return await api.post('/auth/tenant/verify-request', { phone });
  };

  const confirmTenantOTP = async (phone, otp) => {
    const res = await api.post('/auth/tenant/verify-confirm', { phone, otp });
    if (res?.data?.id) {
      localStorage.setItem('tenant_session_id', res.data.id);
    }
    setTenant(res.data);
    return res.data;
  };

  const logoutTenant = async () => {
    try {
      await api.post('/auth/tenant/logout');
    } catch (e) {
      console.warn('[Tenant Logout Warning]:', e.message);
    } finally {
      localStorage.removeItem('tenant_session_id');
      setTenant(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        tenant,
        loading,
        checkAuth,
        loginAdmin,
        logoutAdmin,
        loginTenant,
        requestTenantOTP,
        confirmTenantOTP,
        logoutTenant
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
