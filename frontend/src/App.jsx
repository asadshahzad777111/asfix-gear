import AmbientBackground from './components/AmbientBackground';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import GamingTransition from './components/gaming/GamingTransition';
import GamingModeButton from './components/gaming/GamingModeButton';
import ExitGamingButton from './components/gaming/ExitGamingButton';
import ButtonEffects from './components/ButtonEffects';
import AdminFloatingDashboard from './components/AdminFloatingDashboard';
import StaffAccessPanel from './components/StaffAccessPanel';
import StaffToolbar from './components/StaffToolbar';
import FloatingCart from './components/premium/FloatingCart';
import FlyToCart from './components/premium/FlyToCart';
import GuestWelcomeBanner from './components/GuestWelcomeBanner';
import PageTransition from './components/premium/PageTransition';
import { useLocation } from 'react-router-dom';
import { useGaming } from './context/GamingContext';
import { useAuth } from './context/AuthContext';

function AppContent() {
  const { isGamingPage } = useGaming();
  const { isStaff } = useAuth();
  const location = useLocation();
  const showCart = !location.pathname.startsWith('/admin');
  const showStaffLogin =
    !isStaff &&
    !isGamingPage &&
    !location.pathname.startsWith('/admin');
  const showAdminDesk = isStaff && !isGamingPage;

  return (
    <div className={`app ${isGamingPage ? 'app--gaming' : ''}`}>
      {!isGamingPage && <AmbientBackground />}
      <Navbar />
      <GuestWelcomeBanner />
      <main className="app-main">
        <PageTransition />
      </main>

      {showStaffLogin && <StaffAccessPanel />}
      {showAdminDesk && <AdminFloatingDashboard />}
      {showAdminDesk && <StaffToolbar />}

      {!isGamingPage && <Footer />}
      {!isGamingPage && <WhatsAppButton />}
      {showCart && <FloatingCart />}
      <FlyToCart />
      {!isGamingPage && <GamingModeButton variant="trigger" />}
      <ExitGamingButton />
      <GamingTransition />
      <ButtonEffects />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
