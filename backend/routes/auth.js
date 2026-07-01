import { Router } from 'express';
import * as store from '../store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sanitizeUser, generateOtpCode, hashOtp, verifyOtp, otpExpiry, hashPassword } from '../auth/crypto.js';
import { deliverEmailOtp, deliverPhoneOtp, OtpDeliveryError } from '../services/otpDelivery.js';
const router = Router();
const SUPER_ADMIN = ['super_admin'];

function validatePassword(password) {
  if (!password || String(password).length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

function validateUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  if (!key) return { error: 'Username is required' };
  if (key.length < 3 || key.length > 30) {
    return { error: 'Username must be 3–30 characters' };
  }
  if (!/^[a-z0-9_]+$/.test(key)) {
    return { error: 'Username may only use letters, numbers, and underscores' };
  }
  return { username: key };
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
  const usernameResult = validateUsername(body.username);
  if (usernameResult.error) return usernameResult;

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

  return { name, email, phone, username: usernameResult.username, password };
}

router.post('/register', (_req, res) => {
  res.status(410).json({
    error: 'Direct registration is disabled. Use sign up with email verification.',
  });
});

function buildOtpDevResponse(delivery) {
  const payload = {
    message: delivery.sent ? 'Verification code sent' : 'Verification code generated',
    channel: delivery.channel,
    method: delivery.method || delivery.channel,
  };
  if (delivery.whatsappLink && process.env.NODE_ENV !== 'production') {
    payload.whatsappLink = delivery.whatsappLink;
  }
  if (process.env.NODE_ENV !== 'production' && delivery.devCode) {
    payload.devCode = delivery.devCode;
    payload.devMode = true;
  }
  return payload;
}

function respondOtpDeliveryError(res, err, logTag) {
  console.error(logTag, err);
  if (err instanceof OtpDeliveryError) {
    return res.status(503).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Could not send verification code. Try again later.' });
}

router.post('/register/start', async (req, res) => {
  const parsed = parseCustomerRegistration(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const email = parsed.email;
  const phone = parsed.phone ? String(parsed.phone).replace(/\D/g, '') : '';

  if (email) {
    const existing = store.findUserByLogin(email);
    if (existing) return res.status(400).json({ error: 'Gmail already registered' });
  }
  if (phone) {
    const existing = store.findUserByLogin(phone);
    if (existing) return res.status(400).json({ error: 'Phone number already registered' });
  }

  const existingUser = store.findUserByLogin(parsed.username);
  if (existingUser) return res.status(400).json({ error: 'Username already taken' });

  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = otpExpiry(10);

  const payload = {
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    username: parsed.username,
    password_hash: hashPassword(parsed.password),
  };

  try {
    let delivery;
    if (email) {
      delivery = await deliverEmailOtp(email, code, 'register');
      store.createVerificationCode({
        purpose: 'register',
        channel: 'email',
        target: email,
        payload,
        codeHash,
        expiresAt,
      });
    } else if (phone) {
      delivery = await deliverPhoneOtp(phone, code, 'register');
      store.createVerificationCode({
        purpose: 'register',
        channel: 'phone',
        target: phone,
        payload,
        codeHash,
        expiresAt,
      });
    } else {
      return res.status(400).json({ error: 'Gmail or phone number is required' });
    }

    res.json(buildOtpDevResponse(delivery));
  } catch (err) {
    respondOtpDeliveryError(res, err, '[register/start]');
  }
});

function validateOtpCode(code) {
  const codeStr = String(code || '').trim();
  if (!/^\d{6}$/.test(codeStr)) {
    return { error: 'Enter a valid 6-digit verification code' };
  }
  return { code: codeStr };
}

router.post('/register/verify', (req, res) => {
  const { code, email, phone } = req.body;
  const codeResult = validateOtpCode(code);
  if (codeResult.error) return res.status(400).json({ error: codeResult.error });

  const emailKey = String(email || '').trim().toLowerCase();
  const phoneKey = String(phone || '').replace(/\D/g, '');
  const target = emailKey || phoneKey;
  if (!target) {
    return res.status(400).json({ error: 'Email or phone is required' });
  }

  const result = store.verifyAndConsumeCode({
    purpose: 'register',
    target,
    code: codeResult.code,
    verifyFn: verifyOtp,
  });

  if (!result.ok) {
    const messages = {
      not_found: 'No pending registration found. Start again.',
      expired: 'Code expired. Request a new one.',
      too_many_attempts: 'Too many attempts. Request a new code.',
      invalid: 'Invalid verification code',
    };
    return res.status(400).json({ error: messages[result.reason] || 'Verification failed' });
  }

  try {
    const user = store.createCustomer(result.payload);
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

router.post('/login/otp/start', async (req, res) => {
  const login = String(req.body.login || '').trim();
  if (!login) return res.status(400).json({ error: 'Gmail or phone is required' });

  const user = store.findUserByLogin(login);
  if (!user) return res.status(404).json({ error: 'No account found with this Gmail or phone' });
  if (user.role !== 'customer') {
    return res.status(403).json({ error: 'Staff accounts must use the admin login page.' });
  }
  if (store.isUserBlocked(user)) {
    return res.status(403).json({ error: 'Your account is blocked. Contact the shop owner.' });
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = otpExpiry(10);

  const emailKey = String(user.email || '').trim().toLowerCase();
  const phoneKey = String(user.phone || '').replace(/\D/g, '');
  const loginKey = login.toLowerCase();
  const loginPhone = login.replace(/\D/g, '');

  const useEmail =
    emailKey &&
    (loginKey === emailKey || loginKey === user.username || (!phoneKey && !loginPhone));
  const target = useEmail ? emailKey : phoneKey || loginPhone;

  if (!target) {
    return res.status(400).json({ error: 'Account has no Gmail or phone for OTP login' });
  }

  try {
    let delivery;
    if (useEmail) {
      delivery = await deliverEmailOtp(emailKey, code, 'login');
      store.createVerificationCode({
        purpose: 'login',
        channel: 'email',
        target: emailKey,
        payload: { user_id: user.id },
        codeHash,
        expiresAt,
      });
    } else {
      delivery = await deliverPhoneOtp(phoneKey || loginPhone, code, 'login');
      store.createVerificationCode({
        purpose: 'login',
        channel: 'phone',
        target: phoneKey || loginPhone,
        payload: { user_id: user.id },
        codeHash,
        expiresAt,
      });
    }

    res.json(buildOtpDevResponse(delivery));
  } catch (err) {
    respondOtpDeliveryError(res, err, '[login/otp/start]');
  }
});

router.post('/login/otp/verify', (req, res) => {
  const { code, login } = req.body;
  if (!login?.trim()) return res.status(400).json({ error: 'Gmail or phone is required' });
  const codeResult = validateOtpCode(code);
  if (codeResult.error) return res.status(400).json({ error: codeResult.error });

  const loginKey = login.trim().toLowerCase();
  const loginPhone = login.replace(/\D/g, '');
  const user = store.findUserByLogin(login.trim());
  if (!user) return res.status(404).json({ error: 'No account found' });

  const emailKey = String(user.email || '').trim().toLowerCase();
  const phoneKey = String(user.phone || '').replace(/\D/g, '');
  const useEmail =
    emailKey &&
    (loginKey === emailKey || loginKey === user.username || (!phoneKey && !loginPhone));
  const target = useEmail ? emailKey : phoneKey || loginPhone;

  const result = store.verifyAndConsumeCode({
    purpose: 'login',
    target,
    code: codeResult.code,
    verifyFn: verifyOtp,
  });

  if (!result.ok) {
    const messages = {
      not_found: 'No pending login found. Request a new code.',
      expired: 'Code expired. Request a new one.',
      too_many_attempts: 'Too many attempts. Request a new code.',
      invalid: 'Invalid verification code',
    };
    return res.status(400).json({ error: messages[result.reason] || 'Verification failed' });
  }

  const verifiedUser = store.getUserById(result.payload.user_id);
  if (!verifiedUser || verifiedUser.role !== 'customer') {
    return res.status(403).json({ error: 'Invalid account' });
  }
  if (store.isUserBlocked(verifiedUser)) {
    return res.status(403).json({ error: 'Your account is blocked.' });
  }

  store.recordLastLogin(verifiedUser.id);
  const session = store.createSession(verifiedUser.id);
  res.json({
    token: session.token,
    expires_at: session.expires_at,
    user: sanitizeUser(verifiedUser),
  });
});

function resolveOtpTarget(login, user) {
  const emailKey = String(user.email || '').trim().toLowerCase();
  const phoneKey = String(user.phone || '').replace(/\D/g, '');
  const loginKey = login.trim().toLowerCase();
  const loginPhone = login.replace(/\D/g, '');
  const useEmail =
    emailKey &&
    (loginKey === emailKey || loginKey === user.username || (!phoneKey && !loginPhone));
  return { useEmail, target: useEmail ? emailKey : phoneKey || loginPhone };
}

router.post('/password/reset/start', async (req, res) => {
  const login = String(req.body.login || '').trim();
  if (!login) return res.status(400).json({ error: 'Gmail or phone is required' });

  const user = store.findUserByLogin(login);
  if (!user || user.role !== 'customer') {
    return res.status(404).json({ error: 'No account found with this Gmail or phone' });
  }
  if (store.isUserBlocked(user)) {
    return res.status(403).json({ error: 'Your account is blocked. Contact the shop owner.' });
  }

  const { useEmail, target } = resolveOtpTarget(login, user);
  if (!target) {
    return res.status(400).json({ error: 'Account has no Gmail or phone for password reset' });
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(code);
  const expiresAt = otpExpiry(10);

  try {
    let delivery;
    if (useEmail) {
      delivery = await deliverEmailOtp(target, code, 'reset');
    } else {
      delivery = await deliverPhoneOtp(target, code, 'reset');
    }
    store.createVerificationCode({
      purpose: 'reset',
      channel: useEmail ? 'email' : 'phone',
      target,
      payload: { user_id: user.id },
      codeHash,
      expiresAt,
    });
    res.json(buildOtpDevResponse(delivery));
  } catch (err) {
    respondOtpDeliveryError(res, err, '[password/reset/start]');
  }
});

router.post('/password/reset/verify', (req, res) => {
  const { code, login, newPassword, confirmPassword } = req.body;
  if (!login?.trim()) return res.status(400).json({ error: 'Gmail or phone is required' });
  const codeResult = validateOtpCode(code);
  if (codeResult.error) return res.status(400).json({ error: codeResult.error });
  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const user = store.findUserByLogin(login.trim());
  if (!user || user.role !== 'customer') return res.status(404).json({ error: 'No account found' });

  const { target } = resolveOtpTarget(login, user);

  const result = store.verifyAndConsumeCode({
    purpose: 'reset',
    target,
    code: codeResult.code,
    verifyFn: verifyOtp,
  });

  if (!result.ok) {
    const messages = {
      not_found: 'No pending reset found. Request a new code.',
      expired: 'Code expired. Request a new one.',
      too_many_attempts: 'Too many attempts. Request a new code.',
      invalid: 'Invalid verification code',
    };
    return res.status(400).json({ error: messages[result.reason] || 'Verification failed' });
  }

  if (result.payload.user_id !== user.id) {
    return res.status(403).json({ error: 'Invalid account' });
  }

  store.resetUserPassword(user.id, newPassword);
  res.json({ message: 'Password reset successfully. Please sign in with your new password.' });
});

router.patch('/profile', requireAuth, requireRole('customer'), (req, res) => {
  const { name } = req.body;
  try {
    const updated = store.updateCustomerProfile(req.auth.user.id, { name });
    if (!updated) return res.status(404).json({ error: 'Account not found' });
    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/change-password', requireAuth, requireRole('customer'), (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }

  const result = store.changeCustomerPassword(req.auth.user.id, currentPassword, newPassword);
  if (!result.ok) {
    if (result.reason === 'invalid_password') {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    return res.status(403).json({ error: 'Cannot change password' });
  }

  res.json({ message: 'Password updated', user: sanitizeUser(result.user) });
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
