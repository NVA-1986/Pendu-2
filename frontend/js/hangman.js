const PARTS_ORDER = ['head', 'body', 'left-arm', 'right-arm', 'left-leg', 'right-leg', 'final-mark'];

function setHangmanErrors(errorCount) {
  const parts = document.querySelectorAll('#hangman-svg .hangman-part');
  const current = Math.max(0, Math.min(Number(errorCount || 0), 7));

  parts.forEach((part) => {
    const partIndex = PARTS_ORDER.indexOf(part.dataset.part);
    if (partIndex >= 0 && partIndex < current) {
      part.classList.add('is-visible');
    } else {
      part.classList.remove('is-visible');
    }
  });
}

function resetHangman() {
  setHangmanErrors(0);
}

export { setHangmanErrors, resetHangman };
