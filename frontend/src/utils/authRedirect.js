import { isAdminStaff, isCounterStaff, isCustomer } from '../config/permissions';

const LOGIN_PATHS = new Set(['/account/login', '/login']);

/** Where to send the user after a successful sign-in (password or OTP). */
export function getPostLoginPath(user, from) {
  const safeFrom =
    typeof from === 'string' && from && !LOGIN_PATHS.has(from) ? from : null;

  if (isCounterStaff(user)) {
    if (safeFrom?.startsWith('/counter')) return safeFrom;
    return '/counter';
  }

  if (isAdminStaff(user)) {
    if (safeFrom?.startsWith('/admin')) return safeFrom;
    return '/admin';
  }

  if (isCustomer(user)) {
    if (safeFrom?.startsWith('/account')) return safeFrom;
    return '/account';
  }

  return safeFrom || '/';
}
