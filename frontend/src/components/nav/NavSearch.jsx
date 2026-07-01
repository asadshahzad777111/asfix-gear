import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatPrice } from '../../api/client';
import { getDefaultImage } from '../../config/products';
import { useTranslation } from '../../context/LanguageContext';
import useRecentSearches from '../../hooks/useRecentSearches';

const SUGGEST_DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;

export default function NavSearch({ className = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { recent, addSearch, removeSearch, clearAll } = useRecentSearches();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);
    const seq = ++requestSeqRef.current;

    debounceRef.current = setTimeout(() => {
      api
        .getProducts({ search: term })
        .then((results) => {
          if (requestSeqRef.current !== seq) return;
          setSuggestions(results.slice(0, MAX_SUGGESTIONS));
        })
        .catch(() => {
          if (requestSeqRef.current === seq) setSuggestions([]);
        })
        .finally(() => {
          if (requestSeqRef.current === seq) setLoading(false);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const runSearch = (term) => {
    const q = term.trim();
    if (!q) {
      navigate('/shop');
      setOpen(false);
      return;
    }
    addSearch(q);
    navigate(`/shop?search=${encodeURIComponent(q)}`);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  };

  const submit = (e) => {
    e.preventDefault();
    runSearch(query);
  };

  const clearInput = () => {
    setQuery('');
    setSuggestions([]);
  };

  const showRecent = open && !query.trim() && recent.length > 0;
  const showSuggestions = open && query.trim().length > 0;

  return (
    <div className={`nav-search-wrap ${className}`.trim()} ref={wrapRef}>
      <form className="nav-search" onSubmit={submit} role="search">
        <span className="nav-search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          className="nav-search-input"
          placeholder={t('nav.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          aria-label={t('nav.searchPlaceholder')}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="nav-search-clear-btn"
            onClick={clearInput}
            aria-label={t('nav.clearSearch')}
          >
            ✕
          </button>
        )}
      </form>

      {(showRecent || showSuggestions) && (
        <div className="nav-search-dropdown">
          {showRecent && (
            <>
              <div className="nav-search-dropdown-head">
                <span>{t('nav.recentSearches')}</span>
                <button type="button" onClick={clearAll} className="nav-search-clear-all">
                  {t('nav.clearAll')}
                </button>
              </div>
              <ul className="nav-search-list">
                {recent.map((term) => (
                  <li key={term} className="nav-search-recent-item">
                    <button
                      type="button"
                      className="nav-search-suggestion"
                      onClick={() => runSearch(term)}
                    >
                      <span className="nav-search-suggestion-icon" aria-hidden="true">🕘</span>
                      <span>{term}</span>
                    </button>
                    <button
                      type="button"
                      className="nav-search-remove-btn"
                      onClick={() => removeSearch(term)}
                      aria-label={t('nav.removeSearch', { term })}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {showSuggestions && (
            <>
              <button
                type="button"
                className="nav-search-suggestion nav-search-suggestion--query"
                onClick={() => runSearch(query)}
              >
                <span className="nav-search-suggestion-icon" aria-hidden="true">🔍</span>
                <span>{t('nav.searchFor', { term: query.trim() })}</span>
              </button>

              {loading && <p className="nav-search-loading">{t('nav.searching')}</p>}

              {!loading && suggestions.length > 0 && (
                <ul className="nav-search-list">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="nav-search-product-suggestion"
                        onClick={() => {
                          addSearch(query.trim());
                          navigate(`/shop/${p.id}`);
                          setQuery('');
                          setSuggestions([]);
                          setOpen(false);
                        }}
                      >
                        <img
                          src={p.image || getDefaultImage(p.category)}
                          alt=""
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getDefaultImage(p.category);
                          }}
                        />
                        <span className="nav-search-product-info">
                          <strong>{p.name}</strong>
                          <span>{formatPrice(p.price)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && suggestions.length === 0 && (
                <p className="nav-search-loading">{t('nav.noSuggestions')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
