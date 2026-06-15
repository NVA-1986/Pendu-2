const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'hangman.db');
const wordsPath = path.join(__dirname, '..', 'data', 'words.json');

let db;
let wordsCache = null;
let wordsCacheMtimeMs = 0;

function initDatabase() {
  if (db) return db;

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      word TEXT,
      word_id TEXT,
      direction TEXT,
      result TEXT,
      errors INTEGER,
      letters_tried TEXT,
      duration_seconds INTEGER,
      hint_used INTEGER DEFAULT 0,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS word_stats (
      word_id TEXT PRIMARY KEY,
      play_count INTEGER DEFAULT 0,
      win_count INTEGER DEFAULT 0,
      lose_count INTEGER DEFAULT 0,
      abandon_count INTEGER DEFAULT 0,
      total_errors INTEGER DEFAULT 0,
      total_duration INTEGER DEFAULT 0,
      complexity_score REAL DEFAULT 0,
      complexity_label TEXT DEFAULT 'moyen',
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions(player_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_word_id ON game_sessions(word_id);
  `);

  return db;
}

function getDb() {
  return initDatabase();
}

function safeParseWords(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('words.json must contain an array');
  }
  return parsed.map(normalizeWordRecord);
}

function normalizeWordRecord(word) {
  const id = String(word?.id || '').trim();
  const translation = String(word?.translation || '').trim();
  const deutch = String(word?.deutch || '').trim();
  const category = String(word?.category || '').trim();
  const dialect = String(word?.dialect || '').trim();
  const hint = String(word?.hint || '').trim();
  const enabled = word?.enabled === false ? false : true;

  if (!id) {
    throw new Error('word.id is required');
  }

  const fallbackWord = translation || deutch || '[mot manquant]';
  const baseWord = String(word?.word || fallbackWord).trim();
  const length = Number.isInteger(word?.length) && word.length > 0 ? word.length : [...baseWord].length;

  if (!word?.word || !String(word.word).trim()) {
    console.warn(`[words] entrée sans mot pour ${id}, fallback appliqué`);
  }

  return {
    id,
    word: baseWord,
    translation,
    deutch,
    category,
    dialect,
    hint,
    length,
    enabled
  };
}

function loadWords(forceRefresh = false) {
  const stat = fs.statSync(wordsPath);
  if (!forceRefresh && wordsCache && wordsCacheMtimeMs === stat.mtimeMs) {
    return wordsCache;
  }

  const raw = fs.readFileSync(wordsPath, 'utf8');
  wordsCache = safeParseWords(raw);
  wordsCacheMtimeMs = stat.mtimeMs;
  return wordsCache;
}

function writeWords(words) {
  const normalized = words.map(normalizeWordRecord);
  const tempPath = `${wordsPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, wordsPath);
  wordsCache = normalized;
  wordsCacheMtimeMs = fs.statSync(wordsPath).mtimeMs;
  return normalized;
}

function listWords() {
  return loadWords(true);
}

function getWordById(wordId) {
  return loadWords(true).find((word) => word.id === wordId) || null;
}

function upsertWord(input) {
  const words = loadWords(true);
  const normalized = normalizeWordRecord({
    id: input.id || generateWordId(),
    word: input.word,
    translation: input.translation || '',
    deutch: input.deutch || '',
    category: input.category || '',
    dialect: input.dialect || '',
    hint: input.hint || '',
    length: Number.isInteger(input.length) ? input.length : undefined,
    enabled: input.enabled !== false
  });

  const index = words.findIndex((word) => word.id === normalized.id);
  if (index >= 0) {
    words[index] = normalized;
  } else {
    words.push(normalized);
  }

  writeWords(words);
  return normalized;
}

function deleteWord(wordId) {
  const words = loadWords(true);
  const next = words.filter((word) => word.id !== wordId);
  if (next.length === words.length) {
    return false;
  }
  writeWords(next);
  return true;
}

function setAllWordsEnabled(enabled) {
  const words = loadWords(true);
  const next = words.map((word) => ({ ...word, enabled: Boolean(enabled) }));
  writeWords(next);
  return next.length;
}

function importWords(records, options = {}) {
  if (!Array.isArray(records)) {
    throw new Error('words must be an array');
  }

  const replace = options?.replace === true;
  const base = replace ? [] : loadWords(true);
  const byId = new Map(base.map((word) => [word.id, word]));

  for (const rawWord of records) {
    const prepared = {
      ...rawWord,
      id: String(rawWord?.id || '').trim() || generateWordId()
    };
    const normalized = normalizeWordRecord(prepared);
    byId.set(normalized.id, normalized);
  }

  const merged = Array.from(byId.values());
  writeWords(merged);

  return {
    imported: records.length,
    total: merged.length,
    replaced: replace
  };
}

function generateWordId() {
  return `word_${crypto.randomUUID().slice(0, 8)}`;
}

function getRandomWordRecord() {
  const words = loadWords();
  const enabledWords = words.filter((word) => word.enabled !== false);
  if (!enabledWords.length) return null;
  const index = Math.floor(Math.random() * enabledWords.length);
  return enabledWords[index];
}

function normalizeDirection(direction) {
  return direction === 'DE_TO_FR' ? 'DE_TO_FR' : 'FR_TO_DE';
}

function normalizeResult(result) {
  if (result === 'won' || result === 'lost' || result === 'abandoned') return result;
  return null;
}

function computeComplexity(row) {
  const playCount = Number(row?.play_count || 0);
  const winCount = Number(row?.win_count || 0);
  const totalErrors = Number(row?.total_errors || 0);
  const abandonCount = Number(row?.abandon_count || 0);

  if (playCount <= 0) {
    return { score: 0, label: 'moyen' };
  }

  const successRate = winCount / playCount;
  const avgErrors = totalErrors / playCount;
  const abandonRate = abandonCount / playCount;

  let score = (1 - successRate) * 50 + (avgErrors / 7) * 30 + abandonRate * 20;
  score = Math.max(0, Math.min(100, Number(score.toFixed(2))));

  let label = 'moyen';
  if (score < 25) label = 'facile';
  else if (score < 50) label = 'moyen';
  else if (score < 75) label = 'difficile';
  else label = 'très difficile';

  return { score, label };
}

function upsertPlayer(playerId) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO players (id, last_seen)
    VALUES (?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP
  `);
  stmt.run(playerId);
  return database.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

function recordGameSession(session) {
  const database = getDb();
  const cleanDirection = normalizeDirection(session.direction);
  const cleanResult = normalizeResult(session.result);

  if (!cleanResult) {
    throw new Error('Invalid result value');
  }

  const insertTransaction = database.transaction((payload) => {
    upsertPlayer(payload.player_id);

    const existing = database.prepare('SELECT id FROM game_sessions WHERE id = ?').get(payload.session_id);
    if (existing) {
      return { duplicate: true };
    }

    database.prepare(`
      INSERT INTO game_sessions (
        id, player_id, word, word_id, direction, result, errors, letters_tried, duration_seconds, hint_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.session_id,
      payload.player_id,
      payload.word,
      payload.word_id,
      cleanDirection,
      cleanResult,
      payload.errors,
      JSON.stringify(payload.letters_tried || []),
      payload.duration_seconds,
      payload.hint_used ? 1 : 0
    );

    const increment = {
      play_count: 1,
      win_count: cleanResult === 'won' ? 1 : 0,
      lose_count: cleanResult === 'lost' ? 1 : 0,
      abandon_count: cleanResult === 'abandoned' ? 1 : 0,
      total_errors: Number(payload.errors || 0),
      total_duration: Number(payload.duration_seconds || 0)
    };

    database.prepare(`
      INSERT INTO word_stats (
        word_id, play_count, win_count, lose_count, abandon_count, total_errors, total_duration, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(word_id) DO UPDATE SET
        play_count = play_count + excluded.play_count,
        win_count = win_count + excluded.win_count,
        lose_count = lose_count + excluded.lose_count,
        abandon_count = abandon_count + excluded.abandon_count,
        total_errors = total_errors + excluded.total_errors,
        total_duration = total_duration + excluded.total_duration,
        last_updated = CURRENT_TIMESTAMP
    `).run(
      payload.word_id,
      increment.play_count,
      increment.win_count,
      increment.lose_count,
      increment.abandon_count,
      increment.total_errors,
      increment.total_duration
    );

    const statsRow = database.prepare('SELECT * FROM word_stats WHERE word_id = ?').get(payload.word_id);
    const complexity = computeComplexity(statsRow);

    database.prepare(`
      UPDATE word_stats
      SET complexity_score = ?, complexity_label = ?, last_updated = CURRENT_TIMESTAMP
      WHERE word_id = ?
    `).run(complexity.score, complexity.label, payload.word_id);

    return { duplicate: false };
  });

  return insertTransaction(session);
}

function getStatsSummary() {
  const database = getDb();
  const sessions = database.prepare(`
    SELECT
      COUNT(*) AS sessions,
      SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) AS lost,
      SUM(CASE WHEN result = 'abandoned' THEN 1 ELSE 0 END) AS abandoned,
      COALESCE(SUM(errors), 0) AS total_errors,
      COALESCE(AVG(duration_seconds), 0) AS avg_duration
    FROM game_sessions
  `).get();

  const players = database.prepare('SELECT COUNT(*) AS count FROM players').get();
  const words = loadWords(true);

  return {
    players: Number(players?.count || 0),
    sessions: Number(sessions?.sessions || 0),
    won: Number(sessions?.won || 0),
    lost: Number(sessions?.lost || 0),
    abandoned: Number(sessions?.abandoned || 0),
    total_errors: Number(sessions?.total_errors || 0),
    average_duration: Number(Number(sessions?.avg_duration || 0).toFixed(2)),
    dictionary_size: words.length
  };
}

function listSessions(limit = 100) {
  const database = getDb();
  return database.prepare(`
    SELECT id, player_id, word, word_id, direction, result, errors, letters_tried, duration_seconds, hint_used, played_at
    FROM game_sessions
    ORDER BY played_at DESC
    LIMIT ?
  `).all(Number(limit) || 100).map((row) => ({
    ...row,
    letters_tried: safeJsonParse(row.letters_tried, [])
  }));
}

function listWordStats() {
  const database = getDb();
  const words = loadWords(true);
  const stats = database.prepare('SELECT * FROM word_stats').all();
  const statsMap = new Map(stats.map((row) => [row.word_id, row]));

  return words.map((word) => {
    const row = statsMap.get(word.id) || {
      word_id: word.id,
      play_count: 0,
      win_count: 0,
      lose_count: 0,
      abandon_count: 0,
      total_errors: 0,
      total_duration: 0,
      complexity_score: 0,
      complexity_label: 'moyen',
      last_updated: null
    };

    return {
      ...word,
      ...row
    };
  });
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || '[]');
  } catch (_error) {
    return fallback;
  }
}

module.exports = {
  initDatabase,
  getDb,
  loadWords,
  writeWords,
  listWords,
  getWordById,
  upsertWord,
  deleteWord,
  setAllWordsEnabled,
  importWords,
  getRandomWordRecord,
  upsertPlayer,
  recordGameSession,
  computeComplexity,
  normalizeDirection,
  normalizeResult,
  getStatsSummary,
  listSessions,
  listWordStats,
  normalizeWordRecord,
  generateWordId
};
