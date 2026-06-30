import * as store from '../store.js';
import { sanitizeUser } from '../auth/crypto.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = store.getSessionByToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const user = store.getUserById(session.user_id);
  if (!user || store.isUserBlocked(user)) {
    return res.status(401).json({ error: 'Account blocked or not found' });
  }

  req.auth = { token, user: sanitizeUser(user) };
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.auth.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
