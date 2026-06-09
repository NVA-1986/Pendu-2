const crypto = require('crypto');

const COOKIE_NAME = 'henker_admin_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret';
}

function getPassword() {
  return process.env.ADMIN_PASSWORD || 'admin';
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function unbase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function createSessionToken() {
  const payload = JSON.stringify({
    ts: Date.now(),
    exp: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000
  });
  return `${base64url(payload)}.${signPayload(payload)}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [rawPayload, signature] = token.split('.');
  const payload = unbase64url(rawPayload);
  if (signPayload(payload) !== signature) return false;

  try {
    const parsed = JSON.parse(payload);
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch (_error) {
    return false;
  }
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function authCookie(options = {}) {
  const parts = [
    `${COOKIE_NAME}=${options.value || ''}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME] || '';
}

function requireAdmin(req, res, next) {
  const token = readSessionToken(req);
  if (!verifySessionToken(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}

function validatePassword(password) {
  return password === getPassword();
}

module.exports = {
  COOKIE_NAME,
  authCookie,
  createSessionToken,
  validatePassword,
  verifySessionToken,
  readSessionToken,
  requireAdmin,
  COOKIE_MAX_AGE_SECONDS
};
