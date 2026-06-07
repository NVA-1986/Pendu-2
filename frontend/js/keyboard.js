const MAIN_KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const SPECIAL_KEYS = ['ä', 'ö', 'ü', 'é', 'à', 'è'];

const keyMap = new Map();
let keyboardRoot = null;
let keyPressHandler = null;

function normalizeKey(letter) {
  return String(letter || '').trim().toLowerCase();
}

function makeButton(letter) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key';
  button.dataset.letter = letter;
  button.setAttribute('aria-label', `Lettre ${letter.toUpperCase()}`);
  button.textContent = letter.toUpperCase();

  button.addEventListener('click', () => {
    if (button.disabled || button.dataset.locked === 'true') return;
    if (typeof keyPressHandler === 'function') {
      keyPressHandler(letter);
    }
  });

  keyMap.set(letter, button);
  return button;
}

function renderKeyboard(root, onPress) {
  keyboardRoot = root;
  keyPressHandler = onPress;
  keyMap.clear();
  root.innerHTML = '';

  const mainRow = document.createElement('div');
  mainRow.className = 'keyboard-row keyboard-row--main';
  for (const letter of MAIN_KEYS) {
    mainRow.appendChild(makeButton(letter));
  }

  const specialRow = document.createElement('div');
  specialRow.className = 'keyboard-row keyboard-row--special';
  for (const letter of SPECIAL_KEYS) {
    specialRow.appendChild(makeButton(letter));
  }

  root.append(mainRow, specialRow);
}

function setKeyState(letter, state) {
  const normalized = normalizeKey(letter);
  const button = keyMap.get(normalized);
  if (!button) return;

  button.classList.remove('is-correct', 'is-wrong', 'is-disabled');
  button.dataset.locked = 'true';

  if (state === 'correct') {
    button.classList.add('is-correct');
  } else if (state === 'wrong') {
    button.classList.add('is-wrong');
  } else if (state === 'disabled') {
    button.classList.add('is-disabled');
    button.disabled = true;
  }
}

function resetKeyboard() {
  for (const button of keyMap.values()) {
    button.classList.remove('is-correct', 'is-wrong', 'is-disabled');
    button.disabled = false;
    button.dataset.locked = 'false';
  }
}

function lockKeyboard(locked) {
  for (const button of keyMap.values()) {
    button.disabled = Boolean(locked);
    if (locked) {
      button.classList.add('is-disabled');
    } else {
      button.classList.remove('is-disabled');
    }
  }
}

function isSupportedKey(letter) {
  return keyMap.has(normalizeKey(letter));
}

function normalizeEventKey(eventKey) {
  const normalized = normalizeKey(eventKey);
  if (isSupportedKey(normalized)) return normalized;
  return '';
}

function getKeyboardRoot() {
  return keyboardRoot;
}

export {
  renderKeyboard,
  setKeyState,
  resetKeyboard,
  lockKeyboard,
  normalizeEventKey,
  isSupportedKey,
  getKeyboardRoot
};
