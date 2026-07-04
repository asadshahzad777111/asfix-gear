import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireStaff = true }) {
  const { user, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading container section">Checking access...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/" replace />;
  }

  return children;
}
