import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function useShopGate() {
  const { isCustomer, loading } = useAuth();
  const [promptOpen, setPromptOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const canShop = isCustomer;

  const requireCustomer = useCallback(
    (onAllowed) => {
      if (loading) return false;
      if (canShop) {
        onAllowed?.();
        return true;
      }
      setPromptOpen(true);
      return false;
    },
    [canShop, loading]
  );

  const closePrompt = useCallback(() => setPromptOpen(false), []);

  const openLoginFromPrompt = useCallback(() => {
    setPromptOpen(false);
    setLoginOpen(true);
  }, []);

  return {
    canShop,
    loading,
    promptOpen,
    loginOpen,
    setLoginOpen,
    requireCustomer,
    closePrompt,
    openLoginFromPrompt,
  };
}
