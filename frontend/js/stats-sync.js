const DB_NAME = 'pendu-schwiiz-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_stats';

let dbPromise = null;

function openDb() {
  if (!('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('session_id', 'session_id', { unique: true });
          store.createIndex('queued_at', 'queued_at', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

async function withStore(mode, handler) {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = handler(store, tx);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function enqueueStat(stat) {
  const payload = {
    ...stat,
    queued_at: Date.now()
  };

  return withStore('readwrite', (store) => store.put(payload));
}

async function getPendingStats() {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('queued_at');
    const items = [];

    index.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(items);
    tx.onerror = () => reject(tx.error);
  });
}

async function removePendingStat(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

async function sendStatToServer(stat) {
  const response = await fetch('/api/stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stat)
  });

  if (response.status === 409) return true;
  if (!response.ok) {
    throw new Error(`Stats API error: ${response.status}`);
  }

  return true;
}

async function flushPendingStats() {
  if (!navigator.onLine) return 0;

  let sent = 0;
  const pending = await getPendingStats();

  for (const item of pending) {
    try {
      await sendStatToServer(item);
      await removePendingStat(item.id);
      sent += 1;
    } catch (_error) {
      break;
    }
  }

  return sent;
}

async function queueAndSyncStat(stat) {
  if (!('indexedDB' in window)) {
    return sendStatToServer(stat);
  }

  await enqueueStat(stat);
  return flushPendingStats();
}

function startStatsSync() {
  window.addEventListener('online', () => {
    flushPendingStats().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushPendingStats().catch(() => {});
    }
  });

  flushPendingStats().catch(() => {});
}

export {
  openDb,
  enqueueStat,
  getPendingStats,
  removePendingStat,
  sendStatToServer,
  flushPendingStats,
  queueAndSyncStat,
  startStatsSync
};
