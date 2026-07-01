import { lazy, Suspense } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import Home from '../../pages/Home';
import ProtectedRoute from '../ProtectedRoute';
import CustomerRoute from '../CustomerRoute';
import PageFallback from '../PageFallback';

// Home loads eagerly (it's the very first thing almost everyone sees), but
// every other route is code-split so the initial bundle stays small and the
// site feels instant on first load — the browser only fetches the JS for a
// page once the visitor actually navigates there.
const Shop = lazy(() => import('../../pages/Shop'));
const ProductDetail = lazy(() => import('../../pages/ProductDetail'));
const Repair = lazy(() => import('../../pages/Repair'));
const Contact = lazy(() => import('../../pages/Contact'));
const Admin = lazy(() => import('../../pages/Admin'));
const Login = lazy(() => import('../../pages/Login'));
const Gaming = lazy(() => import('../../pages/Gaming'));
const OrderTrack = lazy(() => import('../../pages/OrderTrack'));
const Account = lazy(() => import('../../pages/Account'));
const AccountLogin = lazy(() => import('../../pages/AccountLogin'));
const AccountRegister = lazy(() => import('../../pages/AccountRegister'));
const AccountSettings = lazy(() => import('../../pages/AccountSettings'));
const NotFound = lazy(() => import('../../pages/NotFound'));

export default function PageTransition() {
  const location = useLocation();

  return (
    <div className="page-transition-shell">
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/gaming" element={<Gaming />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:id" element={<ProductDetail />} />
          <Route path="/repair" element={<Repair />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/track" element={<OrderTrack />} />
          <Route path="/account/login" element={<AccountLogin />} />
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
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}
