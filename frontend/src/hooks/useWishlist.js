import { useCallback, useEffect, useState } from 'react';

const WISHLIST_KEY = 'asfix_wishlist';

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function persistWishlist(ids) {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    /* quota / private mode */
  }
}

export default function useWishlist(productId) {
  const [ids, setIds] = useState(loadWishlist);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === WISHLIST_KEY) setIds(loadWishlist());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isWishlisted = ids.includes(Number(productId));

  const toggle = useCallback(() => {
    const pid = Number(productId);
    if (!pid) return false;
    setIds((prev) => {
      const next = prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid];
      persistWishlist(next);
      return next;
    });
    return !isWishlisted;
  }, [productId, isWishlisted]);

  return { isWishlisted, toggle };
}
