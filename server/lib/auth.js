import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';
import { isProduction, requireEnv } from './config.js';

const COOKIE_NAME = 'tour_session';
const SESSION_SECONDS = 60 * 60 * 8;

const b64url = (input) => Buffer.from(input).toString('base64url');

function secret() {
  const value = requireEnv('SESSION_SECRET');
  if (value.length < 32) {
    console.error('SESSION_SECRET must be at least 32 characters.');
    throw new HttpError(500, 'Server is not configured correctly.');
  }
  return value;
}

const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

/** Constant-time comparison that is safe for inputs of different lengths. */
function safeEqual(a, b) {
  const digest = (value) => createHmac('sha256', 'tour-compare').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Checks the admin password. Uses ADMIN_PASSWORD (plain text from env) when set,
 * otherwise ADMIN_PASSWORD_HASH with format "<salt hex>:<scrypt hash hex>"
 * (see scripts/hash-password.js).
 */
export function verifyPassword(password) {
  const plain = process.env.ADMIN_PASSWORD;
  if (plain) return safeEqual(password, plain);

  const stored = requireEnv('ADMIN_PASSWORD_HASH');
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) {
    console.error('ADMIN_PASSWORD_HASH is malformed. Regenerate it with: npm run hash-password');
    throw new HttpError(500, 'Server is not configured correctly.');
  }
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(String(password), salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createToken() {
  const payload = b64url(JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return sub === 'admin' && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const cookieAttributes = (maxAge) =>
  ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, isProduction() ? 'Secure' : null].filter(Boolean).join('; ');

export function startSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${createToken()}; ${cookieAttributes(SESSION_SECONDS)}`);
}

export function endSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieAttributes(0)}`);
}

export function isAdmin(req) {
  const token = readCookie(req, COOKIE_NAME);
  return Boolean(token) && verifyToken(token);
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'Please sign in to continue.');
}
