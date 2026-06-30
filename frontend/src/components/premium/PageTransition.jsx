import { useLocation, Routes, Route } from 'react-router-dom';
import Home from '../../pages/Home';
import Shop from '../../pages/Shop';
import ProductDetail from '../../pages/ProductDetail';
import Repair from '../../pages/Repair';
import Contact from '../../pages/Contact';
import Admin from '../../pages/Admin';
import Login from '../../pages/Login';
import Gaming from '../../pages/Gaming';
import OrderTrack from '../../pages/OrderTrack';
import NotFound from '../../pages/NotFound';
import ProtectedRoute from '../ProtectedRoute';

export default function PageTransition() {
  const location = useLocation();

  return (
    <div className="page-transition-shell">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/gaming" element={<Gaming />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/:id" element={<ProductDetail />} />
        <Route path="/repair" element={<Repair />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/track" element={<OrderTrack />} />
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
    </div>
  );
}
