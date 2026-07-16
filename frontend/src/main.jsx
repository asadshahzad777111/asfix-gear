import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GamingProvider } from './context/GamingContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { OrderNotificationProvider } from './components/OrderNotificationCenter';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ShopStatusProvider } from './context/ShopStatusContext';
import App from './App.jsx';
import './themes.css';
import './index.css';
import './gaming.css';
import './premium.css';
import './responsive-floats.css';
import './mobile-nav.css';
import './footer-responsive.css';
import './repair-responsive.css';
import './site-responsive.css';
import './mobile-performance.css';
import './components/home/home.css';
import './components/nav/nav-upgrade.css';
import './components/chat-assistant.css';
import './auth-2026.css';
import './components/admin/admin-wp.css';
import './loco.css';
import './shop-ui.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-apply new SW builds (skipWaiting + clients.claim) and re-check on tab focus
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const ping = () => registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ping();
    });
    setInterval(ping, 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <OrderNotificationProvider>
            <ShopStatusProvider>
              <GamingProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </GamingProvider>
            </ShopStatusProvider>
            </OrderNotificationProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
