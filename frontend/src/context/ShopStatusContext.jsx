import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { startVisibilityPoll } from '../utils/visibilityPoll';

const ShopStatusContext = createContext(null);
const POLL_MS = 60_000;
export function ShopStatusProvider({ children }) {
  const { isStaff } = useAuth();
  const [status, setStatus] = useState({
    is_open: true,
    by_hours: true,
    manual_override: null,
    open_hour: 9,
    close_hour: 21,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await api.getShopStatus();
      setStatus((prev) => ({ ...prev, ...data, loading: false }));
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    return startVisibilityPoll(refresh, POLL_MS);
  }, [refresh]);
  const setManualOverride = useCallback(async (manual_override) => {
    if (!isStaff) return null;
    const data = await api.setShopStatus(manual_override);
    setStatus((prev) => ({ ...prev, ...data, loading: false }));
    return data;
  }, [isStaff]);

  const value = useMemo(
    () => ({
      ...status,
      isOpen: status.is_open,
      refresh,
      setManualOverride,
    }),
    [status, refresh, setManualOverride]
  );

  return <ShopStatusContext.Provider value={value}>{children}</ShopStatusContext.Provider>;
}

export function useShopStatus() {
  const ctx = useContext(ShopStatusContext);
  if (!ctx) throw new Error('useShopStatus must be used within ShopStatusProvider');
  return ctx;
}
