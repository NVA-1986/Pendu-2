const express = require('express');
const {
  getRandomWordRecord,
  normalizeDirection,
  loadWords
} = require('../db/database');

const router = express.Router();

function buildPayload(word, direction) {
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

router.get('/random', (req, res) => {
  const direction = normalizeDirection(req.query.direction);
  const word = getRandomWordRecord();

  if (!word) {
    return res.status(404).json({ error: 'No word available' });
  }

  return res.json(buildPayload(word, direction));
});

router.get('/', (req, res) => {
  const direction = normalizeDirection(req.query.direction);
  const words = loadWords();
  return res.json(words.map((word) => buildPayload(word, direction)));
});

module.exports = router;
