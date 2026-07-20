import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isCounterStaff } from '../config/permissions';

export default function CustomerRoute({ children }) {
  const { user, loading, isCustomer, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading container section">Checking access...</div>;
  }

  if (isStaff) {
    return <Navigate to={isCounterStaff(user) ? '/pos' : '/admin'} replace />;
  }

  if (!user || !isCustomer) {
    return <Navigate to="/account/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
