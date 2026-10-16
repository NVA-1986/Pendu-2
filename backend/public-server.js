const express = require('express');
const path = require('path');
const packageJson = require('../package.json');
const { initDatabase } = require('./db/database');
const wordsRouter = require('./routes/words');
const statsRouter = require('./routes/stats');
const { createWordReport, recordSecurityEvent } = require('./db/database');

initDatabase();

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use((req, _res, next) => {
  const url = req.originalUrl;
  let eventType = null;
  let severity = 'warning';
  if (/\.env|etc\/passwd|wp-admin|xmlrpc\.php/i.test(url)) { eventType = 'sensitive_path_scan'; severity = 'high'; }
  else if (/<script|javascript:|onerror\s*=/i.test(url)) { eventType = 'xss_probe'; severity = 'high'; }
  else if (/union\s+(all\s+)?select|sleep\s*\(|benchmark\s*\(/i.test(url)) { eventType = 'sql_injection_probe'; severity = 'high'; }
  else if (/\.\.(\/|%2f|%5c)/i.test(url)) { eventType = 'path_traversal_probe'; severity = 'high'; }
  if (eventType) recordSecurityEvent({ event_type: eventType, severity, ip: req.ip, method: req.method, url });
  next();
});
const port = process.env.PORT || 4173;
const host = process.env.HOST || '0.0.0.0';
const frontendDir = path.join(__dirname, '..', 'frontend');
const dataDir = path.join(__dirname, 'data');
const appVersion = packageJson.version || '1.0.0';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'public', version: appVersion });
});

app.get('/config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.APP_CONFIG = ${JSON.stringify({ version: appVersion, matomoUrl: '//matomo.oblivium.ch/', matomoSiteId: '1' })};`);
});

app.use('/data', express.static(dataDir, {
  maxAge: 0,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));
app.use('/api/words', wordsRouter);
app.use('/api', statsRouter);
app.post('/api/reports', (req, res) => {
  const word = String(req.body?.word || '').trim();
  const message = String(req.body?.message || '').trim();
  const wordId = String(req.body?.word_id || '').trim().slice(0, 80);
  const playerId = String(req.body?.player_id || '').trim().slice(0, 80);
  if (!word || word.length > 200 || !message || message.length > 500) {
    return res.status(400).json({ error: 'invalid_report' });
  }
  try {
    return res.status(201).json({ ok: true, report: createWordReport({ word, message, word_id: wordId, player_id: playerId }) });
  } catch (error) {
    return res.status(500).json({ error: 'failed_to_save_report', message: error.message });
  }
});
app.use(express.static(frontendDir, {
  maxAge: 0,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(port, host, () => {
  console.log(`Pendu public running on http://${host}:${port}`);
});
