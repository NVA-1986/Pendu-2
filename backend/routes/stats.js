const express = require('express');
const { recordGameSession, upsertPlayer, normalizeDirection, normalizeResult } = require('../db/database');

const router = express.Router();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isArrayOfStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateStatsBody(body) {
  const errors = [];

  if (!isNonEmptyString(body.session_id)) errors.push('session_id');
  if (!isNonEmptyString(body.player_id)) errors.push('player_id');
  if (!isNonEmptyString(body.word_id)) errors.push('word_id');
  if (!isNonEmptyString(body.word)) errors.push('word');
  if (!normalizeResult(body.result)) errors.push('result');
  if (body.direction !== 'FR_TO_DE' && body.direction !== 'DE_TO_FR') errors.push('direction');
  if (!Number.isInteger(body.errors) || body.errors < 0) errors.push('errors');
  if (!isArrayOfStrings(body.letters_tried)) errors.push('letters_tried');
  if (!Number.isInteger(body.duration_seconds) || body.duration_seconds < 0) errors.push('duration_seconds');

  return errors;
}

router.post('/player', (req, res) => {
  const { player_id } = req.body || {};

  if (!isNonEmptyString(player_id)) {
    return res.status(400).json({ error: 'player_id is required' });
  }

  const player = upsertPlayer(player_id.trim());
  return res.status(200).json({ ok: true, player });
});

router.post('/stats', (req, res) => {
  const body = req.body || {};
  const validationErrors = validateStatsBody(body);

  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'invalid_payload',
      fields: validationErrors
    });
  }

  try {
    const result = recordGameSession({
      session_id: body.session_id.trim(),
      player_id: body.player_id.trim(),
      word_id: body.word_id.trim(),
      word: body.word.trim(),
      direction: normalizeDirection(body.direction),
      result: normalizeResult(body.result),
      errors: body.errors,
      letters_tried: body.letters_tried,
      duration_seconds: body.duration_seconds,
      hint_used: Boolean(body.hint_used)
    });

    return res.status(200).json({ ok: true, duplicate: Boolean(result?.duplicate) });
  } catch (error) {
    return res.status(500).json({ error: 'failed_to_save_stats', message: error.message });
  }
});

module.exports = router;
