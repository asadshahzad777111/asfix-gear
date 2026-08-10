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

const indexCss = () => import('./index.css').catch(() => {});
const gamingCss = () => import('./gaming.css').catch(() => {});
const premiumCss = () => import('./premium.css').catch(() => {});
const responsiveFloatsCss = () => import('./responsive-floats.css').catch(() => {});
const mobileNavCss = () => import('./mobile-nav.css').catch(() => {});
const footerResponsiveCss = () => import('./footer-responsive.css').catch(() => {});
const repairResponsiveCss = () => import('./repair-responsive.css').catch(() => {});
const siteResponsiveCss = () => import('./site-responsive.css').catch(() => {});
const mobilePerformanceCss = () => import('./mobile-performance.css').catch(() => {});
const homeCss = () => import('./components/home/home.css').catch(() => {});
const navUpgradeCss = () => import('./components/nav/nav-upgrade.css').catch(() => {});
const chatAssistantCss = () => import('./components/chat-assistant.css').catch(() => {});
const connectRevealCss = () => import('./components/motion/connect-reveal.css').catch(() => {});
const typeLineCss = () => import('./components/motion/type-line.css').catch(() => {});
const auth2026Css = () => import('./auth-2026.css').catch(() => {});
const adminWpCss = () => import('./components/admin/admin-wp.css').catch(() => {});
const locoCss = () => import('./loco.css').catch(() => {});
const shopUiCss = () => import('./shop-ui.css').catch(() => {});
const phonecaseStorefrontCss = () => import('./phonecase-storefront.css').catch(() => {});
const headerDiagnosticCss = () => import('./header-diagnostic.css').catch(() => {});
const uiMixCss = () => import('./ui-mix.css').catch(() => {});
const registerSW = () => import('virtual:pwa-register').catch(() => {});

registerSW();

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
                      <Suspense fallback={<div>Loading...</div>}>
                        {(React.useCallback(() => <App />, [])())}
                      </Suspense>
                      <React.Suspense>
                        {(React.useCallback(() => {
                          indexCss();
                          chatAssistantCss();
                          connectRevealCss();
                          typeLineCss();
                          auth2026Css();
                          adminWpCss();
                          locoCss();
                          shopUiCss();
                          phonecaseStorefrontCss();
                          headerDiagnosticCss();
                          uiMixCss();
                          return null;
                        }, [])())}
                      </React.Suspense>
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