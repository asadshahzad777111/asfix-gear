import { isAdminStaff, isCounterStaff, isCustomer } from '../config/permissions';

const LOGIN_PATHS = new Set(['/account/login', '/login', '/pos/login', '/account/register', '/account/forgot-password']);

/** Where to send the user after a successful sign-in (password or OTP). */
export function getPostLoginPath(user, from) {
  const safeFrom =
    typeof from === 'string' && from && !LOGIN_PATHS.has(from) ? from : null;

  if (isCounterStaff(user)) {
    if (safeFrom?.startsWith('/pos')) return safeFrom;
    if (safeFrom?.startsWith('/counter')) return '/pos';
    return '/pos';
  }

  if (isAdminStaff(user)) {
    if (safeFrom?.startsWith('/pos') || safeFrom?.startsWith('/counter')) return safeFrom.replace(/^\/counter/, '/pos');
    if (safeFrom?.startsWith('/admin')) return safeFrom;
    return '/admin';
  }

  // Customers stay on the storefront after login (same page as logged-out home).
  // Only honor an explicit return path (e.g. /account/settings), never force /account.
  if (isCustomer(user)) {
    if (safeFrom?.startsWith('/account')) return safeFrom;
    if (safeFrom && safeFrom !== '/') return safeFrom;
    return '/';
  }

  return safeFrom || '/';
}
