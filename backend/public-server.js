const express = require('express');
const path = require('path');
const packageJson = require('../package.json');
const { initDatabase } = require('./db/database');
const wordsRouter = require('./routes/words');
const statsRouter = require('./routes/stats');

initDatabase();

const app = express();
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
