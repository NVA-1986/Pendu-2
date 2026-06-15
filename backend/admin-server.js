const express = require('express');
const path = require('path');
const { initDatabase, getStatsSummary, listSessions, listWordStats, listWords, upsertWord, deleteWord, getWordById, setAllWordsEnabled, importWords } = require('./db/database');
const { authCookie, createSessionToken, validatePassword, verifySessionToken, readSessionToken, requireAdmin } = require('./admin-auth');

initDatabase();

const app = express();
const port = process.env.PORT || 4174;
const host = process.env.HOST || '127.0.0.1';
const adminDir = path.join(__dirname, '..', 'frontend', 'admin');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(adminDir, { maxAge: '0' }));

function isAuthenticated(req) {
  return verifySessionToken(readSessionToken(req));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'admin' });
});

app.post('/api/auth/login', (req, res) => {
  const password = String(req.body?.password || '');
  if (!validatePassword(password)) {
    return res.status(401).json({ error: 'invalid_password' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', authCookie({ value: token, secure: false }));
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
