import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';

export default function NavSearch({ className = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      navigate('/shop');
      return;
    }
    navigate(`/shop?search=${encodeURIComponent(q)}`);
    setQuery('');
  };

  return (
    <form className={`nav-search ${className}`.trim()} onSubmit={submit} role="search">
      <span className="nav-search-icon" aria-hidden="true">🔍</span>
      <input
        type="search"
        className="nav-search-input"
        placeholder={t('nav.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('nav.searchPlaceholder')}
      />
    </form>
  );
}
