const express = require('express');
const path = require('path');
const { initDatabase } = require('./db/database');
const wordsRouter = require('./routes/words');
const statsRouter = require('./routes/stats');

initDatabase();

const app = express();
const port = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '..', 'frontend');
const dataDir = path.join(__dirname, 'data');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/data', express.static(dataDir, { maxAge: '1h' }));
app.use('/api/words', wordsRouter);
app.use('/api', statsRouter);
app.use(express.static(frontendDir, { maxAge: '1h' }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(port, () => {
  console.log(`Pendu Schwiiz running on http://localhost:${port}`);
});
