import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GamingProvider } from './context/GamingContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ShopStatusProvider>
              <GamingProvider>
                <CartProvider>
                  <App />
                </CartProvider>
              </GamingProvider>
            </ShopStatusProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
