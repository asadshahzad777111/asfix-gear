import { useEffect } from 'react';
import AmbientBackground from './components/AmbientBackground';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ChatAssistant from './components/ChatAssistant';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import GamingTransition from './components/gaming/GamingTransition';
import ExitGamingButton from './components/gaming/ExitGamingButton';
import ButtonEffects from './components/ButtonEffects';
import FloatingCart from './components/premium/FloatingCart';
import FloatingRepairButton from './components/FloatingRepairButton';
import FlyToCart from './components/premium/FlyToCart';
import GuestWelcomeBanner from './components/GuestWelcomeBanner';
import PageTransition from './components/premium/PageTransition';
import { useLocation } from 'react-router-dom';
import { useGaming } from './context/GamingContext';
import { wakeApiServer } from './api/client';

function AppContent() {
  const { isGamingPage } = useGaming();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    wakeApiServer();
  }, []);
  const showCart = !isAdminRoute;

  return (
    <div className={`app ${isGamingPage ? 'app--gaming' : ''} ${isAdminRoute ? 'app--admin' : ''}`}>
      {!isGamingPage && !isAdminRoute && <AmbientBackground />}
      {!isAdminRoute && <Navbar />}
      {!isAdminRoute && <GuestWelcomeBanner />}
      <main className={`app-main ${isAdminRoute ? 'app-main--admin' : ''}`}>
        <ErrorBoundary key={location.pathname}>
          <PageTransition />
        </ErrorBoundary>
      </main>

      {!isAdminRoute && !isGamingPage && <Footer />}
      {!isAdminRoute && !isGamingPage && <FloatingWhatsApp />}
      {!isAdminRoute && !isGamingPage && <ChatAssistant />}
      {!isAdminRoute && !isGamingPage && <FloatingRepairButton />}
      {showCart && <FloatingCart />}
      <FlyToCart />
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
