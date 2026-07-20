import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canUsePos, isAdminStaff, isCounterStaff } from '../config/permissions';

export default function ProtectedRoute({ children, requireStaff = true, requireCounter = false }) {
  const { user, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading container section">Checking access...</div>;
  }

  if (!user) {
    return <Navigate to={requireCounter ? '/pos/login' : '/login'} replace state={{ from: location.pathname }} />;
  }

  if (requireCounter && !canUsePos(user)) {
    return <Navigate to={isAdminStaff(user) ? '/admin' : '/'} replace />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/" replace />;
  }

  if (requireStaff && !requireCounter && isCounterStaff(user)) {
    return <Navigate to="/pos" replace />;
  }

  return children;
}
