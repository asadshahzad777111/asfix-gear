import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = scryptSync(String(password), salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

export function createToken() {
  return randomBytes(32).toString('hex');
}

export function sessionExpiry(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function sanitizeUser(user) {
  if (!user) return null;
  const blocked = Boolean(user.blocked) || user.active === false;
  return {
    id: user.id,
    name: user.name || user.username || '',
    email: user.email,
    phone: user.phone || '',
    username: user.username,
    role: user.role,
    active: !blocked,
    blocked,
    created_at: user.created_at,
    last_login: user.last_login ?? null,
    created_by: user.created_by ?? null,
  };
}

export function isValidStaffGmail(email) {
  const key = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@gmail\.com$/.test(key);
}
