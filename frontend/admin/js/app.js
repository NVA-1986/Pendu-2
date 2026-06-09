const state = {
  authenticated: false,
  words: [],
  sessions: [],
  wordStats: [],
  summary: null,
  activeTab: 'stats'
};

const els = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  passwordInput: document.getElementById('password-input'),
  loginError: document.getElementById('login-error'),
  logoutBtn: document.getElementById('logout-btn'),
  summaryKpis: document.getElementById('summary-kpis'),
  sessionsTable: document.getElementById('sessions-table'),
  wordStatsTable: document.getElementById('word-stats-table'),
  wordsTable: document.getElementById('words-table'),
  wordForm: document.getElementById('word-form'),
  wordId: document.getElementById('word-id'),
  wordInput: document.getElementById('word-input'),
  translationInput: document.getElementById('translation-input'),
  deutchInput: document.getElementById('deutch-input'),
  hintInput: document.getElementById('hint-input'),
  categoryInput: document.getElementById('category-input'),
  dialectInput: document.getElementById('dialect-input'),
  lengthInput: document.getElementById('length-input'),
  wordReset: document.getElementById('word-reset')
};

function qs(path) {
  return fetch(path, { credentials: 'include' });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function showLogin(message = '') {
  state.authenticated = false;
  els.loginView.classList.remove('hidden');
  els.appView.classList.add('hidden');
  els.loginError.hidden = !message;
  els.loginError.textContent = message;
}

function showApp() {
  state.authenticated = true;
  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.loginError.hidden = true;
}

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

function renderKpis() {
  const s = state.summary || {};
  const items = [
    ['Joueurs', s.players],
    ['Parties', s.sessions],
    ['Victoires', s.won],
    ['Défaites', s.lost],
    ['Abandons', s.abandoned],
    ['Erreurs totales', s.total_errors],
    ['Durée moy. (s)', s.average_duration],
    ['Mots', s.dictionary_size]
  ];

  els.summaryKpis.innerHTML = items.map(([label, value]) => `
    <div class="kpi">
      <div class="kpi__label">${label}</div>
      <div class="kpi__value">${formatValue(value)}</div>
    </div>
  `).join('');
}

function renderSessions() {
  const rows = state.sessions || [];
  els.sessionsTable.innerHTML = `
    <thead>
      <tr>
        <th>Date</th><th>Mot</th><th>Résultat</th><th>Err.</th><th>Durée</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${new Date(row.played_at).toLocaleString('fr-CH')}</td>
          <td>${row.word}</td>
          <td>${row.result}</td>
          <td>${row.errors}</td>
          <td>${row.duration_seconds}s</td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

function renderWordStats() {
  const rows = state.wordStats || [];
  els.wordStatsTable.innerHTML = `
    <thead>
      <tr>
        <th>Mot</th><th>FR</th><th>Parties</th><th>Succès</th><th>Complexité</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${row.word}</td>
          <td>${formatValue(row.translation)}</td>
          <td>${row.play_count || 0}</td>
          <td>${row.win_count || 0}</td>
          <td>${row.complexity_label || 'moyen'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

function renderWords() {
  const rows = state.words || [];
  els.wordsTable.innerHTML = `
    <thead>
      <tr>
        <th>ID</th><th>Mot</th><th>FR</th><th>Hint</th><th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.word}</td>
          <td>${formatValue(row.translation)}</td>
          <td>${formatValue(row.hint)}</td>
          <td>
            <div class="actions">
              <button class="btn btn--ghost" data-edit="${row.id}" type="button">Éditer</button>
              <button class="btn btn--ghost" data-delete="${row.id}" type="button">Suppr.</button>
            </div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  `;

  els.wordsTable.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => fillWordForm(rows.find((w) => w.id === btn.dataset.edit)));
  });
  els.wordsTable.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteWord(btn.dataset.delete));
  });
}

function fillWordForm(word = null) {
  els.wordForm.reset();
  els.wordId.value = word?.id || '';
  els.wordInput.value = word?.word || '';
  els.translationInput.value = word?.translation || '';
  els.deutchInput.value = word?.deutch || '';
  els.hintInput.value = word?.hint || '';
  els.categoryInput.value = word?.category || '';
  els.dialectInput.value = word?.dialect || '';
  els.lengthInput.value = word?.length || '';
}

async function loadData() {
  const [summary, sessions, wordStats, words] = await Promise.all([
    api('/api/stats/summary'),
    api('/api/stats/sessions?limit=100'),
    api('/api/stats/word-stats'),
    api('/api/words')
  ]);
  state.summary = summary;
  state.sessions = sessions;
  state.wordStats = wordStats;
  state.words = words;
  renderKpis();
  renderSessions();
  renderWordStats();
  renderWords();
}

async function deleteWord(id) {
  if (!confirm('Supprimer ce mot ?')) return;
  await api(`/api/words/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadData();
}

function setTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tab));
  document.getElementById('tab-stats').classList.toggle('hidden', tab !== 'stats');
  document.getElementById('tab-dictionary').classList.toggle('hidden', tab !== 'dictionary');
}

async function handleLogin(event) {
  event.preventDefault();
  const password = els.passwordInput.value.trim();
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    showApp();
    await loadData();
  } catch (error) {
    showLogin('Mot de passe invalide');
  }
}

async function handleLogout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' });
  showLogin('');
}

async function handleWordSubmit(event) {
  event.preventDefault();
  const payload = {
    id: els.wordId.value || undefined,
    word: els.wordInput.value.trim(),
    translation: els.translationInput.value.trim(),
    deutch: els.deutchInput.value.trim(),
    hint: els.hintInput.value.trim(),
    category: els.categoryInput.value.trim(),
    dialect: els.dialectInput.value.trim(),
    length: els.lengthInput.value ? Number(els.lengthInput.value) : undefined
  };

  await api(payload.id ? `/api/words/${encodeURIComponent(payload.id)}` : '/api/words', {
    method: payload.id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  fillWordForm();
  await loadData();
}

async function boot() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.wordForm.addEventListener('submit', handleWordSubmit);
  els.wordReset.addEventListener('click', () => fillWordForm());
  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  const auth = await qs('/api/auth/me');
  if (!auth.ok) {
    showLogin('');
    return;
  }

  showApp();
  await loadData();
}

boot().catch((error) => {
  console.error(error);
  showLogin('Erreur de chargement');
});
