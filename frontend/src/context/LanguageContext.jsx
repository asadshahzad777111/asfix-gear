import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LANGS, translate } from '../locales/translations';

import { loadDisplayFonts } from '../utils/loadFonts';



const STORAGE_KEY = 'asfix-lang';



const LanguageContext = createContext(null);



function applyLanguage(lang) {

  const resolved = LANGS.includes(lang) ? lang : 'en';

  document.documentElement.setAttribute('lang', resolved === 'en' ? 'en' : 'en-PK');

  document.documentElement.setAttribute('dir', 'ltr');

  document.body.classList.toggle('lang-roman', resolved === 'roman');

  document.body.classList.toggle('lang-en', resolved === 'en');

  return resolved;

}



export function LanguageProvider({ children }) {

  const [lang, setLangState] = useState(() => {
    if (typeof window === 'undefined') return 'en';

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || !LANGS.includes(saved)) {
      if (saved) localStorage.setItem(STORAGE_KEY, 'en');
      return 'en';
    }
    return saved;
  });



  const setLang = useCallback((next) => {

    const value = applyLanguage(next);

    setLangState(value);

    localStorage.setItem(STORAGE_KEY, value);

  }, []);



  useEffect(() => {

    applyLanguage(lang);

  }, [lang]);



  useEffect(() => {

    loadDisplayFonts();

  }, []);



  const t = useCallback((key, vars) => {

    if (vars && typeof vars === 'object') {

      return translate(lang, key, '', vars);

    }

    if (typeof vars === 'string') {

      return translate(lang, key, vars);

    }

    return translate(lang, key);

  }, [lang]);



  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);



  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;

}



export function useLanguage() {

  const ctx = useContext(LanguageContext);

  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');

  return ctx;

}



export function useTranslation() {

  const { t, lang } = useLanguage();

  return { t, lang };

}

