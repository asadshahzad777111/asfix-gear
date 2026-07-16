import { useCallback, useEffect, useState } from 'react';

export const WISHLIST_KEY = 'asfix_wishlist';
export const WISHLIST_EVENT = 'asfix-wishlist-change';

export function loadWishlistIds() {
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
    window.dispatchEvent(new CustomEvent(WISHLIST_EVENT, { detail: ids }));
  } catch {
    /* quota / private mode */
  }
}

/** Header badge + wishlist page */
export function useWishlistIds() {
  const [ids, setIds] = useState(loadWishlistIds);

  useEffect(() => {
    const sync = () => setIds(loadWishlistIds());
    const onStorage = (e) => {
      if (e.key === WISHLIST_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(WISHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WISHLIST_EVENT, sync);
    };
  }, []);

  const remove = useCallback((productId) => {
    const pid = Number(productId);
    setIds((prev) => {
      const next = prev.filter((id) => id !== pid);
      persistWishlist(next);
      return next;
    });
  }, []);

  return { ids, count: ids.length, remove };
}

export default function useWishlist(productId) {
  const [ids, setIds] = useState(loadWishlistIds);

  useEffect(() => {
    const sync = () => setIds(loadWishlistIds());
    const onStorage = (e) => {
      if (e.key === WISHLIST_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(WISHLIST_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WISHLIST_EVENT, sync);
    };
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

  return { isWishlisted, toggle, count: ids.length };
}
