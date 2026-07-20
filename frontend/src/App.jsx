import { useEffect } from 'react';
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
import GuestWelcomeBanner from './components/GuestWelcomeBanner';
import SectionScrollStrap from './components/SectionScrollStrap';
import AuthTopBar from './components/auth/AuthTopBar';
import PageTransition from './components/premium/PageTransition';
import Analytics from './components/seo/Analytics';
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

  useEffect(() => {
    wakeApiServer();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('auth-route', isAuthRoute);
    return () => document.body.classList.remove('auth-route');
  }, [isAuthRoute]);

  const showShopChrome = !isAdminRoute && !isAuthRoute;
  const showCart = showShopChrome;
  const showBottomNav = showShopChrome && !isGamingPage;

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
      {showShopChrome && !isGamingPage && <ChatAssistant />}
      {showShopChrome && !isGamingPage && <FloatingRepairButton />}
      {showCart && <FloatingCart />}
      {showBottomNav && <MobileBottomNav />}
      {showShopChrome && <FlyToCart />}
      <ExitGamingButton />
      <GamingTransition />
      <ButtonEffects />
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
