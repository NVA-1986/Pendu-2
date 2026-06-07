const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'hangman.db');
const wordsPath = path.join(__dirname, '..', 'data', 'words.json');

let db;
let wordsCache = null;

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

function loadWords() {
  if (wordsCache) return wordsCache;

  const raw = fs.readFileSync(wordsPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('words.json must contain an array');
  }
  wordsCache = parsed;
  return wordsCache;
}

function getRandomWordRecord() {
  const words = loadWords();
  if (!words.length) return null;
  const index = Math.floor(Math.random() * words.length);
  return words[index];
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

module.exports = {
  initDatabase,
  getDb,
  loadWords,
  getRandomWordRecord,
  upsertPlayer,
  recordGameSession,
  computeComplexity,
  normalizeDirection,
  normalizeResult
};
