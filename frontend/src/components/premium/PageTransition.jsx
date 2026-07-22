import { lazy, Suspense, useMemo } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Home from '../../pages/Home';
import ProtectedRoute from '../ProtectedRoute';
import CustomerRoute from '../CustomerRoute';
import PageFallback from '../PageFallback';
import {
  isCoarsePointer,
  pageCenter,
  pageCenterMobile,
  pageEnter,
  pageEnterMobile,
  pageExit,
  pageExitMobile,
  pageTransition,
  pageTransitionMobile,
  shouldSkipPageMotion,
} from '../motion/pageMotion';

// Home loads eagerly (it's the very first thing almost everyone sees), but
// every other route is code-split so the initial bundle stays small and the
// site feels instant on first load — the browser only fetches the JS for a
// page once the visitor actually navigates there.
const Shop = lazy(() => import('../../pages/Shop'));
const ProductDetail = lazy(() => import('../../pages/ProductDetail'));
const Repair = lazy(() => import('../../pages/Repair'));
const Contact = lazy(() => import('../../pages/Contact'));
const Admin = lazy(() => import('../../pages/Admin'));
const Counter = lazy(() => import('../../pages/Counter'));
const Login = lazy(() => import('../../pages/Login'));
const PosLogin = lazy(() => import('../../pages/PosLogin'));
const Gaming = lazy(() => import('../../pages/Gaming'));
const OrderTrack = lazy(() => import('../../pages/OrderTrack'));
const Account = lazy(() => import('../../pages/Account'));
const AccountLogin = lazy(() => import('../../pages/AccountLogin'));
const AccountForgotPassword = lazy(() => import('../../pages/AccountForgotPassword'));
const AccountRegister = lazy(() => import('../../pages/AccountRegister'));
const AccountSettings = lazy(() => import('../../pages/AccountSettings'));
const NotFound = lazy(() => import('../../pages/NotFound'));
const PrivacyPage = lazy(() => import('../../pages/legal').then((m) => ({ default: m.PrivacyPage })));
const RefundPage = lazy(() => import('../../pages/legal').then((m) => ({ default: m.RefundPage })));
const TermsPage = lazy(() => import('../../pages/legal').then((m) => ({ default: m.TermsPage })));
const ShippingWarrantyPage = lazy(() =>
  import('../../pages/legal').then((m) => ({ default: m.ShippingWarrantyPage }))
);
const Faq = lazy(() => import('../../pages/Faq'));
const Wishlist = lazy(() => import('../../pages/Wishlist'));

function AppRoutes({ location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/gaming" element={<Gaming />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/shop/p/:slug" element={<ProductDetail />} />
      <Route path="/shop/:id" element={<ProductDetail />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/refund" element={<RefundPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/shipping" element={<ShippingWarrantyPage />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/repair" element={<Repair />} />
      <Route path="/wishlist" element={<Wishlist />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/track" element={<OrderTrack />} />
      <Route path="/account/login" element={<AccountLogin />} />
      <Route path="/account/forgot-password" element={<AccountForgotPassword />} />
      <Route path="/account/register" element={<AccountRegister />} />
      <Route path="/register" element={<Navigate to="/account/register" replace />} />
      <Route
        path="/account"
        element={
          <CustomerRoute>
            <Account />
          </CustomerRoute>
        }
      />
      <Route
        path="/account/settings"
        element={
          <CustomerRoute>
            <AccountSettings />
          </CustomerRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/pos/login" element={<PosLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="/counter" element={<Navigate to="/pos" replace />} />
      <Route
        path="/pos"
        element={
          <ProtectedRoute requireCounter>
            <Counter />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function PageTransition() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const skipMotion = shouldSkipPageMotion(location.pathname);
  const coarse = useMemo(() => isCoarsePointer(), []);

  const motionProps = coarse
    ? {
        initial: pageEnterMobile,
        animate: pageCenterMobile,
        exit: pageExitMobile,
        transition: pageTransitionMobile,
      }
    : {
        initial: pageEnter,
        animate: pageCenter,
        exit: pageExit,
        transition: pageTransition,
      };

  return (
    <div className="page-transition-shell">
      <Suspense fallback={<PageFallback />}>
        {skipMotion || reduceMotion ? (
          <div className="page-transition-page">
            <AppRoutes location={location} />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="page-transition-page"
              initial={motionProps.initial}
              animate={motionProps.animate}
              exit={motionProps.exit}
              transition={motionProps.transition}
            >
              <AppRoutes location={location} />
            </motion.div>
          </AnimatePresence>
        )}
      </Suspense>
    </div>
  );
}
