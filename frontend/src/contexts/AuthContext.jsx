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
        }
      } catch (e) {
        setAdmin(null);
      }

      // Try checking tenant session
      try {
        const resTenant = await api.get('/auth/tenant/me');
        if (resTenant?.data) {
          setTenant(resTenant.data);
        }
      } catch (e) {
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
    setAdmin(res.data);
    return res.data;
  };

  const logoutAdmin = async () => {
    await api.post('/auth/admin/logout');
    setAdmin(null);
  };

  const loginTenant = async (phone) => {
    const res = await api.post('/auth/tenant/login', { phone });
    setTenant(res.data);
    return res.data;
  };

  const requestTenantOTP = async (phone) => {
    return await api.post('/auth/tenant/verify-request', { phone });
  };

  const confirmTenantOTP = async (phone, otp) => {
    const res = await api.post('/auth/tenant/verify-confirm', { phone, otp });
    setTenant(res.data);
    return res.data;
  };

  const logoutTenant = async () => {
    await api.post('/auth/tenant/logout');
    setTenant(null);
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
