import { useEffect, useState } from 'react';
import AmbientBackground from './components/AmbientBackground';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ChatAssistant from './components/ChatAssistant';
import GamingTransition from './components/gaming/GamingTransition';
import ExitGamingButton from './components/gaming/ExitGamingButton';
import ButtonEffects from './components/ButtonEffects';
import FloatingCart from './components/premium/FloatingCart';
import FloatingRepairButton from './components/FloatingRepairButton';
import FlyToCart from './components/premium/FlyToCart';
import MobileBottomNav from './components/MobileBottomNav';
import FloatingNavRail from './components/FloatingNavRail';
import GuestWelcomeBanner from './components/GuestWelcomeBanner';
import SectionScrollStrap from './components/SectionScrollStrap';
import AuthTopBar from './components/auth/AuthTopBar';
import PageTransition from './components/premium/PageTransition';
import Analytics from './components/seo/Analytics';
import PosAppUpdatePrompt from './components/PosAppUpdatePrompt';
import { useLocation } from 'react-router-dom';
import { useGaming } from './context/GamingContext';
import { wakeApiServer } from './api/client';

const AUTH_PATHS = new Set([
  '/account/login',
  '/account/register',
  '/account/forgot-password',
  '/login',
  '/pos/login',
]);

function AppContent() {
  const { isGamingPage } = useGaming();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/counter') || location.pathname.startsWith('/pos');
  const isAuthRoute = AUTH_PATHS.has(location.pathname);
  const [secondaryChrome, setSecondaryChrome] = useState(false);

  useEffect(() => {
    wakeApiServer();
  }, []);

  // Mount chat / floating extras after first paint so home opens sooner
  useEffect(() => {
    const enable = () => setSecondaryChrome(true);
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(enable, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(enable, 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('auth-route', isAuthRoute);
    return () => document.body.classList.remove('auth-route');
  }, [isAuthRoute]);

  const showShopChrome = !isAdminRoute && !isAuthRoute;
  const showCart = showShopChrome;
  const showBottomNav = showShopChrome && !isGamingPage;
  const showFloatingNav = showShopChrome && !isGamingPage;

  return (
    <div
      className={[
        'app',
        isGamingPage ? 'app--gaming' : '',
        isAdminRoute ? 'app--admin' : '',
        isAuthRoute ? 'app--auth' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Analytics />
      {isAdminRoute && <PosAppUpdatePrompt />}
      {!isGamingPage && !isAdminRoute && <AmbientBackground />}
      {isAuthRoute ? <AuthTopBar /> : !isAdminRoute && <Navbar />}
      {showShopChrome && !isGamingPage && <SectionScrollStrap />}
      {showShopChrome && <GuestWelcomeBanner />}
      <main className={`app-main ${isAdminRoute ? 'app-main--admin' : ''} ${isAuthRoute ? 'app-main--auth' : ''}`.trim()}>
        <ErrorBoundary>
          <PageTransition />
        </ErrorBoundary>
      </main>

      {showShopChrome && !isGamingPage && <Footer />}
      {showCart && <FloatingCart />}
      {showBottomNav && <MobileBottomNav />}
      {secondaryChrome && showShopChrome && !isGamingPage && <ChatAssistant />}
      {secondaryChrome && showShopChrome && !isGamingPage && <FloatingRepairButton />}
      {secondaryChrome && showFloatingNav && <FloatingNavRail />}
      {secondaryChrome && showShopChrome && <FlyToCart />}
      {secondaryChrome && <ExitGamingButton />}
      {secondaryChrome && <GamingTransition />}
      {secondaryChrome && <ButtonEffects />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
