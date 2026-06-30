import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { playGamingActivate, playGamingExit, playShopActivate } from '../utils/gamingSound';

const GamingContext = createContext(null);

export function GamingProvider({ children }) {
  const [transitioning, setTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState(null);
  const [gamingMode, setGamingMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isGamingPage = location.pathname.startsWith('/gaming');
  const isShopPage = location.pathname.startsWith('/shop');

  useEffect(() => {
    setGamingMode(isGamingPage);
    document.body.classList.toggle('gaming-mode-active', isGamingPage);
    document.body.classList.toggle('shop-mode-active', isShopPage);
    return () => {
      document.body.classList.remove('gaming-mode-active');
      document.body.classList.remove('shop-mode-active');
    };
  }, [isGamingPage, isShopPage]);

  const enterGamingMode = useCallback(() => {
    if (transitioning) return;
    if (isGamingPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    playGamingActivate();
    setTransitionType('gaming-in');
    setTransitioning(true);
    setTimeout(() => {
      navigate('/gaming');
      setTimeout(() => {
        setTransitioning(false);
        setTransitionType(null);
      }, 400);
    }, 700);
  }, [transitioning, isGamingPage, navigate]);

  const exitGamingMode = useCallback(() => {
    if (transitioning) return;
    playGamingExit();
    setTransitionType('gaming-out');
    setTransitioning(true);
    setTimeout(() => {
      navigate('/');
      setTimeout(() => {
        setTransitioning(false);
        setTransitionType(null);
      }, 400);
    }, 650);
  }, [transitioning, navigate]);

  const enterShopMode = useCallback(() => {
    if (transitioning) return;
    if (isShopPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    playShopActivate();
    setTransitionType('shop-in');
    setTransitioning(true);
    setTimeout(() => {
      navigate('/shop');
      setTimeout(() => {
        setTransitioning(false);
        setTransitionType(null);
      }, 400);
    }, 650);
  }, [transitioning, isShopPage, navigate]);

  return (
    <GamingContext.Provider
      value={{
        transitioning,
        transitionType,
        gamingMode,
        enterGamingMode,
        exitGamingMode,
        enterShopMode,
        isGamingPage,
        isShopPage,
      }}
    >
      {children}
    </GamingContext.Provider>
  );
}

export function useGaming() {
  const ctx = useContext(GamingContext);
  if (!ctx) throw new Error('useGaming must be used within GamingProvider');
  return ctx;
}
