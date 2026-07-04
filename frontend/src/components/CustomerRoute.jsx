import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CustomerRoute({ children }) {
  const { user, loading, isCustomer, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading container section">Checking access...</div>;
  }

  if (isStaff) {
    return <Navigate to="/admin" replace />;
  }

  if (!user || !isCustomer) {
    return <Navigate to="/account/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
