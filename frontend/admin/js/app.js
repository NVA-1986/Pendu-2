const state = {
  authenticated: false,
  words: [],
  sessions: [],
  wordStats: [],
  summary: null,
  activeTab: 'stats',
  sorts: {
    sessions: { key: 'played_at', dir: 'desc' },
    wordStats: { key: 'play_count', dir: 'desc' },
    words: { key: 'word', dir: 'asc' }
  }
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
  enabledInput: document.getElementById('enabled-input'),
  wordReset: document.getElementById('word-reset'),
  exportBtn: document.getElementById('export-btn'),
  enableAllBtn: document.getElementById('enable-all-btn'),
  disableAllBtn: document.getElementById('disable-all-btn'),
  importForm: document.getElementById('import-form'),
  importFile: document.getElementById('import-file'),
  importReplace: document.getElementById('import-replace')
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

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

function sortRows(rows, sortConfig) {
  const { key, dir } = sortConfig;
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
    return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' }) * factor;
  });
}

function updateSort(table, key) {
  const current = state.sorts[table];
  if (current.key === key) {
    current.dir = current.dir === 'asc' ? 'desc' : 'asc';
  } else {
    current.key = key;
    current.dir = 'asc';
  }
}

function renderSortHeader(table, key, label) {
  const current = state.sorts[table];
  const arrow = current.key === key ? (current.dir === 'asc' ? '▲' : '▼') : '';
  return `<button class="btn btn--ghost" data-sort-table="${table}" data-sort-key="${key}" type="button">${label} ${arrow}</button>`;
}

function attachSortHandlers() {
  document.querySelectorAll('[data-sort-table]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSort(btn.dataset.sortTable, btn.dataset.sortKey);
      renderAllTables();
    });
  });
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

function renderKpis() {
  const s = state.summary || {};
  const items = [
    ['Joueurs', s.players],
    ['Parties', s.sessions],
    ['Victoires', s.won],
    ['Défaites', s.lost],
    ['Abandons', s.abandoned],
    ['Erreurs', s.total_errors],
    ['Durée moy. (s)', s.average_duration],
    ['Mots', s.dictionary_size]
  ];
  els.summaryKpis.innerHTML = items
    .map(([label, value]) => `<div class="kpi"><div class="kpi__label">${label}</div><div class="kpi__value">${formatValue(value)}</div></div>`)
    .join('');
}

function renderSessions() {
  const rows = sortRows(state.sessions || [], state.sorts.sessions);
  els.sessionsTable.innerHTML = `
    <thead>
      <tr>
        <th>${renderSortHeader('sessions', 'played_at', 'Date')}</th>
        <th>${renderSortHeader('sessions', 'word', 'Mot')}</th>
        <th>${renderSortHeader('sessions', 'result', 'Résultat')}</th>
        <th>${renderSortHeader('sessions', 'errors', 'Err.')}</th>
        <th>${renderSortHeader('sessions', 'duration_seconds', 'Durée')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${new Date(row.played_at).toLocaleString('fr-CH')}</td>
          <td>${formatValue(row.word)}</td>
          <td>${formatValue(row.result)}</td>
          <td>${formatValue(row.errors)}</td>
          <td>${formatValue(row.duration_seconds)}s</td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

function renderWordStats() {
  const rows = sortRows(state.wordStats || [], state.sorts.wordStats);
  els.wordStatsTable.innerHTML = `
    <thead>
      <tr>
        <th>${renderSortHeader('wordStats', 'word', 'Mot')}</th>
        <th>${renderSortHeader('wordStats', 'translation', 'FR')}</th>
        <th>${renderSortHeader('wordStats', 'play_count', 'Parties')}</th>
        <th>${renderSortHeader('wordStats', 'win_count', 'Victoires')}</th>
        <th>${renderSortHeader('wordStats', 'complexity_label', 'Complexité')}</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${formatValue(row.word)}</td>
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
  const rows = sortRows(state.words || [], state.sorts.words);
  els.wordsTable.innerHTML = `
    <thead>
      <tr>
        <th>${renderSortHeader('words', 'id', 'ID')}</th>
        <th>${renderSortHeader('words', 'word', 'Mot')}</th>
        <th>${renderSortHeader('words', 'translation', 'FR')}</th>
        <th>${renderSortHeader('words', 'hint', 'Région')}</th>
        <th>${renderSortHeader('words', 'enabled', 'Actif')}</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.word}</td>
          <td>${formatValue(row.translation)}</td>
          <td>${formatValue(row.hint)}</td>
          <td>${row.enabled !== false ? 'Oui' : 'Non'}</td>
          <td>
            <div class="actions">
              <button class="btn btn--ghost" data-edit="${row.id}" type="button">Éditer</button>
              <button class="btn btn--ghost" data-toggle="${row.id}" type="button">${row.enabled !== false ? 'Désactiver' : 'Activer'}</button>
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
  els.wordsTable.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => toggleWord(btn.dataset.toggle));
  });
  els.wordsTable.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteWord(btn.dataset.delete));
  });
}

function renderAllTables() {
  renderSessions();
  renderWordStats();
  renderWords();
  attachSortHandlers();
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
  els.enabledInput.checked = word ? word.enabled !== false : true;
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
  renderAllTables();
}

async function deleteWord(id) {
  if (!confirm('Supprimer ce mot ?')) return;
  await api(`/api/words/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadData();
}

async function toggleWord(id) {
  const word = state.words.find((w) => w.id === id);
  if (!word) return;
  await api(`/api/words/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...word, enabled: word.enabled === false })
  });
  await loadData();
}

async function setAllWordsEnabled(enabled) {
  await api('/api/words/bulk-enable', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  });
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
  } catch (_error) {
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
    length: els.lengthInput.value ? Number(els.lengthInput.value) : undefined,
    enabled: els.enabledInput.checked
  };

  await api(payload.id ? `/api/words/${encodeURIComponent(payload.id)}` : '/api/words', {
    method: payload.id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  fillWordForm();
  await loadData();
}

async function handleImport(event) {
  event.preventDefault();
  const file = els.importFile.files?.[0];
  if (!file) return;

  const content = await file.text();
  const parsed = JSON.parse(content);
  await api('/api/words/import', {
    method: 'POST',
    body: JSON.stringify({
      words: parsed,
      replace: els.importReplace.checked
    })
  });

  els.importForm.reset();
  await loadData();
}

async function handleExport() {
  const response = await fetch('/api/words/export', { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Export impossible (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || 'words-export.json';

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function boot() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.wordForm.addEventListener('submit', handleWordSubmit);
  els.wordReset.addEventListener('click', () => fillWordForm());
  els.exportBtn.addEventListener('click', () => {
    handleExport().catch((error) => alert(`Export impossible: ${error.message}`));
  });
  els.enableAllBtn.addEventListener('click', () => setAllWordsEnabled(true));
  els.disableAllBtn.addEventListener('click', () => setAllWordsEnabled(false));
  els.importForm.addEventListener('submit', (event) => {
    handleImport(event).catch((error) => alert(`Import impossible: ${error.message}`));
  });
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
