import { useEffect } from 'react';
import AmbientBackground from './components/AmbientBackground';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ChatAssistant from './components/ChatAssistant';
const GamingTransition = () => import('./components/gaming/GamingTransition').catch(() => null);
const ExitGamingButton = () => import('./components/gaming/ExitGamingButton').catch(() => null);
import ButtonEffects from './components/ButtonEffects';
const FloatingCart = () => import('./components/premium/FloatingCart').catch(() => null);
const FloatingRepairButton = () => import('./components/FloatingRepairButton').catch(() => null);
const FlyToCart = () => import('./components/premium/FlyToCart').catch(() => null);
const MobileBottomNav = () => import('./components/MobileBottomNav').catch(() => null);
const FloatingNavRail = () => import('./components/FloatingNavRail').catch(() => null);
import GuestWelcomeBanner from './components/GuestWelcomeBanner';
const SectionScrollStrap = () => import('./components/SectionScrollStrap').catch(() => null);
import AuthTopBar from './components/auth/AuthTopBar';
const PageTransition = () => import('./components/premium/PageTransition').catch(() => null);
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
      {showFloatingNav && <FloatingNavRail />}
      {showShopChrome && <FlyToCart />}
      <Suspense>
        <ExitGamingButton />
      </Suspense>
      <Suspense>
        <GamingTransition />
      </Suspense>
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
