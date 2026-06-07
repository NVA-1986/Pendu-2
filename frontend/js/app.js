import { fetchRandomWord } from './words.js';
import {
  renderKeyboard,
  setKeyState,
  resetKeyboard,
  lockKeyboard,
  normalizeEventKey
} from './keyboard.js';
import { setHangmanErrors, resetHangman } from './hangman.js';
import { queueAndSyncStat, startStatsSync } from './stats-sync.js';
import { setupMatomo } from './matomo.js';

const MAX_ERRORS = 7;
const PLAYER_ID_KEY = 'pendu-schwiiz-player-id';
const DIRECTION_KEY = 'pendu-schwiiz-direction';
const ABANDON_KEY = 'pendu-schwiiz-pending-abandon';

const els = {
  newGameBtn: document.getElementById('new-game-btn'),
  directionBtn: document.getElementById('direction-btn'),
  hintText: document.getElementById('hint-text'),
  hintMeta: document.getElementById('hint-meta'),
  wordDisplay: document.getElementById('word-display'),
  statusText: document.getElementById('status-text'),
  keyboard: document.getElementById('keyboard'),
  themeBtn: document.getElementById('theme-btn'),
  appVersion: document.getElementById('app-version')
};

const state = {
  playerId: getOrCreatePlayerId(),
  direction: getSavedDirection(),
  currentWord: null,
  sessionId: null,
  startedAt: 0,
  completed: false,
  result: null,
  errors: 0,
  guessedLetters: new Set(),
  lettersTried: [],
  loading: false,
  theme: getSavedTheme()
};

function getSavedDirection() {
  return localStorage.getItem(DIRECTION_KEY) === 'DE_TO_FR' ? 'DE_TO_FR' : 'FR_TO_DE';
}

function getSavedTheme() {
  return 'dark';
}

function saveDirection(direction) {
  localStorage.setItem(DIRECTION_KEY, direction);
}

function saveTheme(theme) {
  localStorage.setItem('pendu-schwiiz-theme', theme);
}

function getOrCreatePlayerId() {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = createUuid();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function normalizeChar(char) {
  return String(char || '').toLowerCase();
}

function isGuessableChar(char) {
  return /\p{L}/u.test(char);
}

function getAnswer() {
  return state.currentWord?.answer || '';
}

function getPromptHint() {
  return state.currentWord?.prompt_hint || '';
}

function getLengthHint() {
  const provided = Number(state.currentWord?.display_length);
  if (Number.isInteger(provided) && provided > 0) return provided;
  return [...getAnswer()].filter((char) => isGuessableChar(char)).length;
}

function renderDirectionLabel() {
  els.directionBtn.textContent = state.direction === 'FR_TO_DE' ? 'FR → DE-CH' : 'DE-CH → FR';
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle('theme-dark', theme === 'dark');
  document.body.dataset.theme = theme;
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  els.themeBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  els.themeBtn.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode foncé';
  els.themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode foncé');
  saveTheme(theme);
}

function renderHintMeta() {
  const meta = [];
  if (getLengthHint()) meta.push(`Longueur : ${getLengthHint()}`);
  if (state.currentWord?.secondary_hint) meta.push(`Indice secondaire : ${state.currentWord.secondary_hint}`);
  els.hintMeta.textContent = meta.join(' • ');
}

function renderHint() {
  const prompt = getPromptHint() || '—';
  const hint = state.currentWord?.secondary_hint ? state.currentWord.secondary_hint.toUpperCase() : '';
  els.hintText.textContent = hint ? `[(${hint}) - ${prompt}]` : prompt;
  renderHintMeta();
}

function renderWordDisplay() {
  const answer = getAnswer();
  els.wordDisplay.innerHTML = '';

  const revealAll = state.completed && Boolean(state.result);

  [...answer].forEach((char) => {
    const span = document.createElement('span');
    span.className = 'word-char';

    if (!isGuessableChar(char)) {
      span.classList.add('is-special');
      span.textContent = char === ' ' ? '\u00A0' : char;
    } else {
      const isRevealed = revealAll || state.guessedLetters.has(normalizeChar(char));
      span.classList.add(isRevealed ? 'is-revealed' : 'is-hidden');
      span.textContent = isRevealed ? char : '_';
    }

    els.wordDisplay.appendChild(span);
  });

  els.wordDisplay.classList.toggle('is-won', state.completed && state.result === 'won');
  els.wordDisplay.classList.toggle('is-lost', state.completed && state.result === 'lost');
}

function updateStatus(message = '') {
  els.statusText.textContent = message;
}

function resetRoundUi() {
  state.errors = 0;
  state.completed = false;
  state.result = null;
  state.guessedLetters = new Set();
  state.lettersTried = [];
  state.startedAt = 0;
  state.sessionId = createUuid();
  state.currentWord = null;
  state.loading = true;

  resetKeyboard();
  lockKeyboard(false);
  resetHangman();
  els.wordDisplay.classList.remove('is-won', 'is-lost');
  els.wordDisplay.innerHTML = '';
  els.hintText.textContent = 'Chargement...';
  els.hintMeta.textContent = '';
  updateStatus('');
}

async function loadNewWord() {
  state.loading = true;
  renderDirectionLabel();

  try {
    const word = await fetchRandomWord(state.direction);
    state.currentWord = word;
    state.startedAt = Date.now();
    state.loading = false;
    renderHint();
    renderWordDisplay();
    updateStatus('');
  } catch (error) {
    state.loading = false;
    updateStatus(`Impossible de charger un mot : ${error.message}`);
  }
}

async function startNewGame() {
  if (state.startedAt && !state.completed && state.currentWord) {
    await finalizeSession('abandoned');
  }

  resetRoundUi();
  await loadNewWord();
}

function allLettersRevealed() {
  const answer = getAnswer();
  return [...answer].every((char) => !isGuessableChar(char) || state.guessedLetters.has(normalizeChar(char)));
}

function buildSessionPayload(result) {
  const durationSeconds = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));

  return {
    session_id: state.sessionId,
    player_id: state.playerId,
    word_id: state.currentWord?.id,
    word: state.currentWord?.answer,
    direction: state.direction,
    result,
    errors: state.errors,
    letters_tried: state.lettersTried,
    duration_seconds: durationSeconds,
    hint_used: 0
  };
}

async function finalizeSession(result) {
  if (!state.currentWord || state.completed) return;

  state.completed = true;
  state.result = result;
  lockKeyboard(true);
  renderWordDisplay();

  if (result === 'won') {
    updateStatus('Victoire !');
  } else if (result === 'lost') {
    updateStatus(`Défaite — le mot était : ${state.currentWord.answer}`);
  } else {
    updateStatus('Partie abandonnée.');
  }

  try {
    await queueAndSyncStat(buildSessionPayload(result));
  } catch (_error) {
    // queueAndSyncStat peut échouer si IndexedDB est indisponible ; on garde le jeu fluide.
  }
}

function handleGuess(rawLetter) {
  const letter = normalizeEventKey(rawLetter);
  if (!letter || state.loading || state.completed || !state.currentWord) return;
  if (state.guessedLetters.has(letter)) return;

  state.startedAt ||= Date.now();
  state.guessedLetters.add(letter);
  state.lettersTried.push(letter);

  const answer = getAnswer();
  const hits = [...answer].some((char) => isGuessableChar(char) && normalizeChar(char) === letter);

  setKeyState(letter, hits ? 'correct' : 'wrong');

  if (!hits) {
    state.errors += 1;
    setHangmanErrors(state.errors);
  }

  renderWordDisplay();

  if (allLettersRevealed()) {
    finalizeSession('won').catch(() => {});
    return;
  }

  if (state.errors >= MAX_ERRORS) {
    finalizeSession('lost').catch(() => {});
  }
}

async function toggleDirection() {
  if (state.currentWord && !state.completed) {
    await finalizeSession('abandoned');
  }

  state.direction = state.direction === 'FR_TO_DE' ? 'DE_TO_FR' : 'FR_TO_DE';
  saveDirection(state.direction);
  renderDirectionLabel();
  await startNewGame();
}

async function restorePendingAbandonment() {
  const raw = localStorage.getItem(ABANDON_KEY);
  if (!raw) return;

  localStorage.removeItem(ABANDON_KEY);

  try {
    const payload = JSON.parse(raw);
    await queueAndSyncStat(payload);
  } catch (_error) {
    // ignore
  }
}

function registerBeforeUnload() {
  window.addEventListener('beforeunload', () => {
    if (!state.currentWord || state.completed) return;

    const payload = buildSessionPayload('abandoned');
    localStorage.setItem(ABANDON_KEY, JSON.stringify(payload));
  });
}

function registerPhysicalKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const letter = normalizeEventKey(event.key);
    if (!letter) return;
    handleGuess(letter);
  });
}

function registerPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

async function init() {
  renderKeyboard(els.keyboard, handleGuess);
  renderDirectionLabel();
  applyTheme(state.theme);
  els.appVersion.textContent = `v${window.APP_CONFIG?.version || '1.0.5'}`;
  registerPhysicalKeyboard();
  registerBeforeUnload();
  registerPwa();
  startStatsSync();
  setupMatomo();

  els.newGameBtn.addEventListener('click', () => {
    startNewGame().catch(() => {});
  });

  els.directionBtn.addEventListener('click', () => {
    toggleDirection().catch(() => {});
  });

  els.themeBtn.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  await restorePendingAbandonment();

  try {
    await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: state.playerId })
    });
  } catch (_error) {
    // Le jeu reste jouable sans connexion.
  }

  await startNewGame();
}

init().catch((error) => {
  updateStatus(`Erreur d'initialisation : ${error.message}`);
});
