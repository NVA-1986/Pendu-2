let wordsCatalogPromise = null;

function normalizeDirection(direction) {
  return direction === 'DE_TO_FR' ? 'DE_TO_FR' : 'FR_TO_DE';
}

async function loadWordsCatalog() {
  if (!wordsCatalogPromise) {
    wordsCatalogPromise = fetch('/data/words.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load words catalog (${response.status})`);
        }
        return response.json();
      })
      .then((items) => {
        if (!Array.isArray(items)) {
          throw new Error('Invalid words catalog format');
        }
        return items;
      })
      .catch((error) => {
        wordsCatalogPromise = null;
        throw error;
      });
  }

  return wordsCatalogPromise;
}

function buildWordPayload(word, direction) {
  const cleanDirection = normalizeDirection(direction);
  const answer = cleanDirection === 'FR_TO_DE' ? word.word : word.translation;
  const promptHint = cleanDirection === 'FR_TO_DE' ? word.translation : word.word;

  return {
    ...word,
    direction: cleanDirection,
    prompt_hint: promptHint,
    secondary_hint: word.hint || '',
    answer,
    display_length: Number.isInteger(word.length) ? word.length : String(answer).length,
    prompt_language: cleanDirection === 'FR_TO_DE' ? 'fr' : 'de-ch',
    answer_language: cleanDirection === 'FR_TO_DE' ? 'de-ch' : 'fr',
    german_translation: word.deutch || ''
  };
}

function pickRandomWord(words, direction) {
  const enabledWords = words.filter((word) => word.enabled !== false);
  if (!enabledWords.length) {
    throw new Error('No enabled word available');
  }

  const index = Math.floor(Math.random() * enabledWords.length);
  return buildWordPayload(enabledWords[index], direction);
}

async function fetchRandomWord(direction = 'FR_TO_DE') {
  const cleanDirection = normalizeDirection(direction);

  try {
    const response = await fetch(`/api/words/random?direction=${encodeURIComponent(cleanDirection)}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid API payload');
    }

    return payload;
  } catch (_error) {
    const words = await loadWordsCatalog();
    return pickRandomWord(words, cleanDirection);
  }
}

export { loadWordsCatalog, fetchRandomWord, pickRandomWord, buildWordPayload, normalizeDirection };
