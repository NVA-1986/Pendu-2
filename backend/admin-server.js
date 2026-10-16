const express = require('express');
const path = require('path');
const { initDatabase, getStatsSummary, listSessions, listWordStats, listWords, upsertWord, deleteWord, getWordById, setAllWordsEnabled, importWords, listWordReports, resolveWordReport, recordSecurityEvent, listSecurityEvents, countOpenSecurityEvents, isSecurityBanned, listSecurityBans, unbanSecurityIp, listSecurityBots, markSecurityEventsRead } = require('./db/database');
const { authCookie, createSessionToken, validatePassword, verifySessionToken, readSessionToken, requireAdmin } = require('./admin-auth');
const { getClientIp, getClientCountry } = require('./client-ip');

const loginAttempts = new Map();
function classifySuspiciousRequest(url) {
  if (/\.env|etc\/passwd|wp-admin|xmlrpc\.php/i.test(url)) return ['sensitive_path_scan', 'high'];
  if (/<script|javascript:|onerror\s*=/i.test(url)) return ['xss_probe', 'high'];
  if (/union\s+(all\s+)?select|sleep\s*\(|benchmark\s*\(/i.test(url)) return ['sql_injection_probe', 'high'];
  if (/\.\.(\/|%2f|%5c)/i.test(url)) return ['path_traversal_probe', 'high'];
  return null;
}
function auditRequests(req, _res, next) {
  const classification = classifySuspiciousRequest(req.originalUrl);
  if (classification) recordSecurityEvent({ event_type: classification[0], severity: classification[1], ip: getClientIp(req), country: getClientCountry(req), user_agent: req.headers['user-agent'], method: req.method, url: req.originalUrl });
  next();
}
function loginRateLimit(req, res, next) {
  const key = getClientIp(req);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 10) {
    recordSecurityEvent({ event_type: 'admin_bruteforce_rate_limit', severity: 'high', ip: key, method: req.method, url: req.originalUrl });
    return res.status(429).json({ error: 'too_many_attempts' });
  }
  req.loginAttempts = recent;
  next();
}

initDatabase();

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const port = process.env.PORT || 4174;
const host = process.env.HOST || '127.0.0.1';
const adminDir = path.join(__dirname, '..', 'frontend', 'admin');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  if (isSecurityBanned(getClientIp(req))) return res.status(403).json({ error: 'blocked' });
  next();
});
app.use(auditRequests);
app.use(express.static(adminDir, { maxAge: '0' }));

function isAuthenticated(req) {
  return verifySessionToken(readSessionToken(req));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'admin' });
});

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const password = String(req.body?.password || '');
  if (!validatePassword(password)) {
    const key = getClientIp(req);
    loginAttempts.set(key, [...(req.loginAttempts || []), Date.now()]);
    recordSecurityEvent({ event_type: 'failed_admin_login', severity: 'warning', ip: key, country: getClientCountry(req), method: req.method, url: req.originalUrl });
    return res.status(401).json({ error: 'invalid_password' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', authCookie({ value: token, secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' }));
  return res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'henker_admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true });
});

app.get('/api/stats/summary', requireAdmin, (_req, res) => {
  return res.json(getStatsSummary());
});

app.get('/api/stats/players', requireAdmin, (_req, res) => {
  return res.json(require('./db/database').listPlayerStats());
});

app.get('/api/stats/activity', requireAdmin, (_req, res) => {
  return res.json(require('./db/database').getActivityStats());
});

app.get('/api/security/events', requireAdmin, (_req, res) => res.json(listSecurityEvents()));
app.get('/api/security/summary', requireAdmin, (_req, res) => res.json({ unread: countOpenSecurityEvents() }));
app.get('/api/security/bots', requireAdmin, (_req, res) => res.json(listSecurityBots()));
app.post('/api/security/read', requireAdmin, (_req, res) => res.json({ ok: true, marked: markSecurityEventsRead() }));
app.get('/api/security/bans', requireAdmin, (_req, res) => res.json(listSecurityBans()));
app.delete('/api/security/bans/:ip', requireAdmin, (req, res) => res.json({ ok: unbanSecurityIp(req.params.ip) }));

app.get('/api/reports', requireAdmin, (_req, res) => res.json(listWordReports()));
app.put('/api/reports/:id', requireAdmin, (req, res) => {
  const status = req.body?.status === 'open' ? 'open' : 'resolved';
  return res.json({ ok: resolveWordReport(req.params.id, status), status });
});

app.get('/api/stats/sessions', requireAdmin, (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  return res.json(listSessions(limit));
});

app.get('/api/stats/word-stats', requireAdmin, (_req, res) => {
  return res.json(listWordStats());
});

app.get('/api/words', requireAdmin, (_req, res) => {
  return res.json(listWords());
});

app.post('/api/words', requireAdmin, (req, res) => {
  try {
    const saved = upsertWord(req.body || {});
    return res.status(201).json({ ok: true, word: saved });
  } catch (error) {
    return res.status(400).json({ error: 'invalid_word', message: error.message });
  }
});

app.put('/api/words/:id', requireAdmin, (req, res) => {
  try {
    const existing = getWordById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found' });
    }
    const saved = upsertWord({ ...existing, ...req.body, id: req.params.id });
    return res.json({ ok: true, word: saved });
  } catch (error) {
    return res.status(400).json({ error: 'invalid_word', message: error.message });
  }
});

app.delete('/api/words/:id', requireAdmin, (req, res) => {
  const removed = deleteWord(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'not_found' });
  }
  return res.json({ ok: true });
});

app.post('/api/words/bulk-enable', requireAdmin, (req, res) => {
  const enabled = req.body?.enabled !== false;
  const count = setAllWordsEnabled(enabled);
  return res.json({ ok: true, count, enabled });
});

app.post('/api/words/import', requireAdmin, (req, res) => {
  try {
    const words = req.body?.words;
    const replace = req.body?.replace === true;
    const result = importWords(words, { replace });
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ error: 'invalid_import', message: error.message });
  }
});

app.get('/api/words/export', requireAdmin, (_req, res) => {
  const words = listWords();
  const filename = `words-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`${JSON.stringify(words, null, 2)}\n`);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(port, host, () => {
  console.log(`Pendu admin running on http://${host}:${port}`);
});
