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
import { ChatAssistantProvider } from './context/ChatAssistantContext';
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
import './components/motion/connect-reveal.css';
import './components/motion/type-line.css';
import './auth-2026.css';
import './components/admin/admin-wp.css';
import './loco.css';
import './shop-ui.css';
import './phonecase-storefront.css';
import './header-diagnostic.css';
import { registerSW } from 'virtual:pwa-register';

// Register the self-destroying SW so any prior controlling worker is replaced,
// caches are cleared, and the SW unregisters itself (no sticky offline shell).
registerSW({ immediate: true });

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
                  <ChatAssistantProvider>
                    <App />
                  </ChatAssistantProvider>
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
