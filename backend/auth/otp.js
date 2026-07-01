import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';

export function generateOtpCode() {
  return String(randomInt(100000, 1_000_000));
}

export function hashOtp(code) {
  const salt = randomBytes(8).toString('hex');
  const hash = scryptSync(String(code), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyOtp(code, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = scryptSync(String(code), salt, 32).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

export function otpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}
