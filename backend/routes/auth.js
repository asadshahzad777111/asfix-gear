import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sanitizeUser } from '../auth/crypto.js';

const router = Router();
const SUPER_ADMIN = ['super_admin'];

function validatePassword(password) {
  if (!password || String(password).length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

function validateStaffPayload(body, requirePassword = true) {
  const { email, name, username, password, role, confirmPassword } = body;
  const displayName = String(name || username || '').trim();
  const emailKey = String(email || '').trim().toLowerCase();

  if (!emailKey || !displayName || !role) {
    return { error: 'Name, Gmail, and role are required' };
  }
  if (!emailKey.endsWith('@gmail.com')) {
    return { error: 'Staff must use a @gmail.com address' };
  }
  if (!['admin', 'editor'].includes(role)) {
    return { error: 'Role must be admin or editor' };
  }
  if (requirePassword) {
    const pwErr = validatePassword(password);
    if (pwErr) return { error: pwErr };
    if (password !== confirmPassword) {
      return { error: 'Passwords do not match' };
    }
  }

  return {
    email: emailKey,
    name: displayName,
    username: String(username || emailKey.split('@')[0]).trim().toLowerCase(),
    password,
    role,
  };
}

router.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (!login?.trim() || !password) {
    return res.status(400).json({ error: 'Login and password are required' });
  }

  const result = store.authenticateUser(login.trim(), password);
  if (!result.ok) {
    if (result.reason === 'blocked') {
      return res.status(403).json({
        error: 'Your account is blocked. Contact the shop owner (Super Admin).',
      });
    }
    return res.status(401).json({ error: 'Invalid login or password' });
  }

  store.recordLastLogin(result.user.id);
  const session = store.createSession(result.user.id);
  res.json({
    token: session.token,
    expires_at: session.expires_at,
    user: sanitizeUser(result.user),
  });
});

function parseCustomerRegistration(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const { password, confirmPassword } = body;

  if (!name || name.length > 120) {
    return { error: 'Name is required (max 120 characters)' };
  }
  if (!email && !phone) {
    return { error: 'Gmail or phone number is required' };
  }
  if (email && !email.endsWith('@gmail.com')) {
    return { error: 'Please use a @gmail.com address' };
  }
  const pwErr = validatePassword(password);
  if (pwErr) return { error: pwErr };
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  return { name, email, phone, password };
}

router.post('/register', (req, res) => {
  const parsed = parseCustomerRegistration(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const user = store.createCustomer(parsed);
    store.recordLastLogin(user.id);
    const session = store.createSession(user.id);
    res.status(201).json({
      token: session.token,
      expires_at: session.expires_at,
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/my-orders', requireAuth, requireRole('customer'), (req, res) => {
  res.json(store.getOrdersByCustomerId(req.auth.user.id));
});

router.get('/my-messages', requireAuth, requireRole('customer'), (req, res) => {
  res.json(store.getContactMessagesByCustomerId(req.auth.user.id));
});

router.post('/logout', requireAuth, (req, res) => {
  store.deleteSession(req.auth.token);
  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.auth.user });
});

router.get('/users', requireAuth, requireRole(...SUPER_ADMIN), (_req, res) => {
  res.json(store.listUsers().map((u) => sanitizeUser(u)));
});

router.get('/admins', requireAuth, requireRole(...SUPER_ADMIN), (_req, res) => {
  res.json(store.listUsers().map((u) => sanitizeUser(u)));
});

router.post('/users', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const parsed = validateStaffPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const user = store.createUser({
      ...parsed,
      createdBy: req.auth.user.id,
    });
    res.status(201).json({
      user: sanitizeUser(user),
      temporary_password: parsed.password,
      message: 'Staff created. Copy the password now — it will not be shown again.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admins', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const parsed = validateStaffPayload(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const user = store.createUser({
      ...parsed,
      createdBy: req.auth.user.id,
    });
    res.status(201).json({
      user: sanitizeUser(user),
      temporary_password: parsed.password,
      message: 'Staff created. Copy the password now — it will not be shown again.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/users/:id/block', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const numId = Number(req.params.id);
  const target = store.getUserById(numId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot block super admin account' });
  }
  if (numId === req.auth.user.id) {
    return res.status(403).json({ error: 'Cannot block your own account' });
  }

  const blocked = req.body.blocked != null ? Boolean(req.body.blocked) : !target.blocked;
  const updated = store.toggleUserBlock(numId, blocked);
  res.json(sanitizeUser(updated));
});

router.patch('/users/:id/reset-password', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const numId = Number(req.params.id);
  const target = store.getUserById(numId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot reset super admin password here' });
  }

  const { password } = req.body;
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  store.resetUserPassword(numId, password);
  res.json({
    user: sanitizeUser(store.getUserById(numId)),
    temporary_password: password,
    message: 'Password reset. Copy it now — it will not be shown again.',
  });
});

router.patch('/admins/:id', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const numId = Number(req.params.id);
  const target = store.getUserById(numId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot modify super admin account' });
  }

  const { role, active, blocked, name } = req.body;
  if (role && !['admin', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (blocked != null) {
    const updated = store.toggleUserBlock(numId, Boolean(blocked));
    if (role) store.updateUser(numId, { role });
    if (name) store.updateUser(numId, { name });
    return res.json(sanitizeUser(store.getUserById(numId) || updated));
  }

  const updated = store.updateUser(numId, { role, active, name });
  res.json(sanitizeUser(updated));
});

router.delete('/users/:id', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const numId = Number(req.params.id);
  const target = store.getUserById(numId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot remove super admin' });
  }
  if (numId === req.auth.user.id) {
    return res.status(403).json({ error: 'Cannot remove your own account' });
  }

  store.deleteUser(numId);
  res.json({ message: 'Staff member removed' });
});

router.delete('/admins/:id', requireAuth, requireRole(...SUPER_ADMIN), (req, res) => {
  const numId = Number(req.params.id);
  const target = store.getUserById(numId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') {
    return res.status(403).json({ error: 'Cannot remove super admin' });
  }
  if (numId === req.auth.user.id) {
    return res.status(403).json({ error: 'Cannot remove your own account' });
  }

  store.deleteUser(numId);
  res.json({ message: 'Staff member removed' });
});

export default router;
