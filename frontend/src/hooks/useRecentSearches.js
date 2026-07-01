import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'asfix_recent_searches';
const MAX_ITEMS = 8;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — recent search
    // history is a nice-to-have, never worth crashing the search bar for.
  }
}

/** Google-style recent search history for the nav search bar, kept in localStorage. */
export default function useRecentSearches() {
  const [recent, setRecent] = useState(readStored);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setRecent(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addSearch = useCallback((term) => {
    const clean = term.trim();
    if (!clean) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_ITEMS);
      writeStored(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((term) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== term);
      writeStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRecent([]);
    writeStored([]);
  }, []);

  return { recent, addSearch, removeSearch, clearAll };
}
