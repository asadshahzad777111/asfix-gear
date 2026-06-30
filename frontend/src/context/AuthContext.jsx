import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';
import { isStaff, isCustomer } from '../config/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const data = await api.me();
      setUser(data.user);
      return data.user;
    } catch (err) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        setAuthToken(null);
        setUser(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (loginValue, password) => {
    const data = await api.login({ login: loginValue, password });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (body) => {
    const data = await api.register(body);
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAuthToken()) await api.logout();
    } catch {
      /* ignore network errors on logout */
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const completeSession = useCallback(async (data) => {
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isStaff: isStaff(user),
      isCustomer: isCustomer(user),
      login,
      register,
      logout,
      refreshUser,
      completeSession,
    }),
    [user, loading, login, register, logout, refreshUser, completeSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
