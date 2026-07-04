import { Navigate, useLocation } from 'react-router-dom';

/** Legacy staff URL — same unified Sign In as /account/login. */
export default function Login() {
  const location = useLocation();
  const state = location.state?.from
    ? location.state
    : { from: '/admin' };

  return <Navigate to="/account/login" replace state={state} />;
}
