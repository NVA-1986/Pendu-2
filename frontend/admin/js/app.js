const state = {
  authenticated: false,
  words: [],
  sessions: [],
  wordStats: [],
  summary: null,
  players: [], activity: [], securityEvents: [], securityBans: [], reports: [],
  activeTab: 'stats',
  sorts: {
    sessions: { key: 'played_at', dir: 'desc' },
    wordStats: { key: 'play_count', dir: 'desc' },
    words: { key: 'word', dir: 'asc' },
    players: { key: 'last_seen', dir: 'desc' }
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
  playersTable: document.getElementById('players-table'),
  activityChart: document.getElementById('activity-chart'),
  securityEvents: document.getElementById('security-events'),
  securityEventsFull: document.getElementById('security-events-full'),
  reportsTable: document.getElementById('reports-table'),
  reportsBadge: document.getElementById('reports-badge'),
  securityBadge: document.getElementById('security-badge'),
  securityCountryCards: document.getElementById('security-country-cards'),
  securityIpTable: document.getElementById('security-ip-table'),
  securityBansTable: document.getElementById('security-bans-table'),
  sessionsTable: document.getElementById('sessions-table'),
  wordStatsTable: document.getElementById('word-stats-table'),
  wordsTable: document.getElementById('words-table'),
  wordForm: document.getElementById('word-form'),
  wordId: document.getElementById('word-id'),
  wordInput: document.getElementById('word-input'),
  translationInput: document.getElementById('translation-input'),
  deutchInput: document.getElementById('deutch-input'),
  englishInput: document.getElementById('english-input'),
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
function formatDateTime(value) {
  if (!value) return '—';
  const raw = String(value);
  const date = new Date(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'medium' });
}
function esc(value) {
  return String(formatValue(value)).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

function renderPlayers() {
  const rows = sortRows(state.players || [], state.sorts.players);
  els.playersTable.innerHTML = `<thead><tr><th>${renderSortHeader('players', 'player_id', 'Identifiant')}</th><th>${renderSortHeader('players', 'sessions', 'Parties')}</th><th>${renderSortHeader('players', 'wins', 'Victoires')}</th><th>${renderSortHeader('players', 'total_duration', 'Temps total')}</th><th>${renderSortHeader('players', 'last_seen', 'Dernière activité')}</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${esc(p.player_id)}</td><td>${p.sessions}</td><td>${p.wins}</td><td>${Math.round(p.total_duration / 60)} min</td><td>${esc(p.last_seen)}</td></tr>`).join('')}</tbody>`;
}
function renderReports() {
  const open = state.reports.filter((r) => r.status === 'open');
  els.reportsBadge.textContent = open.length;
  els.reportsBadge.classList.toggle('hidden', open.length === 0);
  els.reportsTable.innerHTML = `<thead><tr><th>Date</th><th>Mot</th><th>Joueur</th><th>Message</th><th>Statut</th><th>Action</th></tr></thead><tbody>${state.reports.map((r) => `<tr><td>${formatDateTime(r.created_at)}</td><td>${esc(r.word)}</td><td>${esc(r.player_id)}</td><td>${esc(r.message)}</td><td>${r.status === 'open' ? '<span class="report-open">À traiter</span>' : '<span class="report-done">Traité</span>'}</td><td>${r.status === 'open' ? `<button class="btn btn--outline" data-resolve-report="${esc(r.id)}" type="button">Marquer traité</button>` : '—'}</td></tr>`).join('')}</tbody>`;
  els.reportsTable.querySelectorAll('[data-resolve-report]').forEach((button) => button.addEventListener('click', () => resolveReport(button.dataset.resolveReport)));
}
function renderSecurityStats() {
  const countries = new Map();
  const ips = new Map();
  state.securityEvents.forEach((event) => {
    const country = event.country && event.country !== 'XX' ? event.country : 'Inconnu';
    countries.set(country, (countries.get(country) || 0) + 1);
    const ip = event.ip || 'inconnu';
    const current = ips.get(ip) || { ip, count: 0, country };
    current.count += 1; current.country = country; ips.set(ip, current);
  });
  els.securityCountryCards.innerHTML = [...countries.entries()].sort((a,b) => b[1]-a[1]).map(([country,count]) => `<div class="security-country-card"><div class="security-country-code">${esc(country)}</div><strong>${count}</strong><small>requête${count > 1 ? 's' : ''}</small></div>`).join('') || '<span class="muted">Aucune donnée</span>';
  const ranked = [...ips.values()].sort((a,b) => b.count-a.count);
  els.securityIpTable.innerHTML = `<thead><tr><th>IP</th><th>Pays</th><th>Requêtes</th></tr></thead><tbody>${ranked.map((x) => `<tr><td>${esc(x.ip)}</td><td>${esc(x.country)}</td><td><strong>${x.count}</strong></td></tr>`).join('')}</tbody>`;
  els.securityBansTable.innerHTML = `<thead><tr><th>IP</th><th>Requêtes</th><th>Date</th><th></th></tr></thead><tbody>${state.securityBans.map((x) => `<tr><td>${esc(x.ip)}</td><td>${x.request_count}</td><td>${formatDateTime(x.created_at)}</td><td><button class="btn btn--outline" data-unban="${esc(x.ip)}" type="button">DéBAN</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune IP bannie</td></tr>'}</tbody>`;
  els.securityBansTable.querySelectorAll('[data-unban]').forEach((button) => button.addEventListener('click', () => unbanIp(button.dataset.unban)));
}

function renderActivity() {
  const max = Math.max(1, ...state.activity.map((x) => Number(x.sessions)));
  els.activityChart.innerHTML = state.activity.slice().reverse().map((x) => `<div class="activity-bar" title="${esc(x.day)} : ${x.sessions} parties"><span style="height:${Math.max(4, x.sessions / max * 100)}%"></span><small>${esc(x.day?.slice(5))}</small></div>`).join('') || '<span class="muted">Pas encore de données</span>';
  const securityText = state.securityEvents.length ? state.securityEvents.map((x) => `${formatDateTime(x.created_at)} — ${x.severity} — ${x.event_type} — ${x.ip || 'inconnu'} — ${x.url || ''}`).join('\n') : 'Aucune alerte détectée';
  els.securityEvents.textContent = securityText;
  els.securityEventsFull.textContent = securityText;
  els.securityBadge.textContent = state.securityEvents.length;
  els.securityBadge.classList.toggle('hidden', state.securityEvents.length === 0);
  renderSecurityStats();
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
          <td>${esc(row.word)}</td>
          <td>${esc(row.translation)}</td>
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
          <td>${esc(row.id)}</td>
          <td>${esc(row.word)}</td>
          <td>${esc(row.translation)}</td>
          <td>${esc(row.hint)}</td>
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
  renderPlayers();
  renderActivity();
  renderReports();
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
  els.englishInput.value = word?.english || '';
  els.hintInput.value = word?.hint || '';
  els.categoryInput.value = word?.category || '';
  els.dialectInput.value = word?.dialect || '';
  els.lengthInput.value = word?.length || '';
  els.enabledInput.checked = word ? word.enabled !== false : true;
}

async function loadData() {
  const [summary, sessions, players, activity, securityEvents, securityBans, reports, wordStats, words] = await Promise.all([
    api('/api/stats/summary'), api('/api/stats/sessions?limit=100'), api('/api/stats/players'),
    api('/api/stats/activity'), api('/api/security/events'), api('/api/security/bans'), api('/api/reports'), api('/api/stats/word-stats'), api('/api/words')
  ]);
  state.summary = summary;
  state.sessions = sessions;
  state.players = players;
  state.activity = activity;
  state.securityEvents = securityEvents;
  state.securityBans = securityBans;
  state.reports = reports;
  state.wordStats = wordStats;
  state.words = words;
  renderKpis();
  renderAllTables();
}

async function unbanIp(ip) {
  if (!confirm(`Débannir ${ip} ?`)) return;
  await api(`/api/security/bans/${encodeURIComponent(ip)}`, { method: 'DELETE' });
  await loadData();
}

async function resolveReport(id) {
  await api(`/api/reports/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ status: 'resolved' }) });
  await loadData();
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
  ['stats', 'dictionary', 'reports', 'security'].forEach((name) => document.getElementById(`tab-${name}`).classList.toggle('hidden', tab !== name));
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
    deutsch: els.deutchInput.value.trim(),
    english: els.englishInput.value.trim(),
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
