// Popup renderer.
// Contract with main process:
//   - main sends 'quote:show' with { text, source, id, isFavorite } via webContents.send
//   - renderer sends back 'quote:action' with { id, action } where action is
//     'dismiss' | 'favorite' | 'unfavorite' | 'delete'
//   - 'preview' mode (no IPC available) uses a built-in sample so you can
//     see the popup before any of the queue/storage code exists.

const textEl     = document.getElementById('quote-text');
const sourceEl   = document.getElementById('quote-source');
const quoteEl    = document.getElementById('quote');
const favBtn     = document.querySelector('[data-action="favorite"]');
const favIcon    = document.getElementById('fav-icon');
const favLabel   = document.getElementById('fav-label');

let currentId   = null;
let isFavorite  = false;
let hasLeft     = false;

// --- IPC bridge (graceful fallback so popup.html opens standalone in a browser) ---
const ipc = (() => {
  try {
    // eslint-disable-next-line no-undef
    return require('electron').ipcRenderer;
  } catch {
    return null;
  }
})();

function render(payload) {
  const {
    text,
    source,
    id,
    isFavorite: fav,
    // appearance + animation, with sane defaults if main forgot anything
    fontSize         = 30,
    fontColor        = null,
    opacity          = 100,
    revealMode       = 'all',    // 'all' | 'word'
    revealDurationMs = 7000,    // total fade duration for the verse (all-at-once mode, or total budget for word mode)
    wordSpeedMs      = 1200,     // per-word fade time when revealMode = 'word'
  } = payload;

  currentId  = id ?? null;
  isFavorite = !!fav;

  // ----- Live appearance overrides -----
  document.documentElement.style.setProperty('--popup-size', `${fontSize}pt`);
  quoteEl.style.opacity = (Math.max(0, Math.min(100, opacity)) / 100).toString();
  if (fontColor) {
    textEl.style.color   = fontColor;
    sourceEl.style.color = fontColor;
  }
  document.documentElement.style.setProperty('--fade-duration', `${revealDurationMs}ms`);

  // ----- Source stagger delay -----
  const sourceDelayMs = revealMode === 'word'
    ? Math.round(revealDurationMs * 0.92)
    : Math.round(revealDurationMs * 0.22);
  sourceEl.style.animationDelay = `${sourceDelayMs}ms`;

  // ----- Render the text in the chosen mode -----
  if (revealMode === 'word' && text) {
    renderWordByWord(text, revealDurationMs, wordSpeedMs);
  } else {
    textEl.classList.remove('quote__text--per-word');
    textEl.style.removeProperty('--word-duration');
    textEl.textContent = text || '';
  }
  sourceEl.textContent = source || '';

  updateFavoriteUi();
}

// Splits the text into <span class="word"> elements with staggered animation.
//
//   revealDurationMs = total time budget from first word's start to last word's end
//   wordSpeedMs      = how long each individual word's fade takes
//
// Stagger between word starts = (revealDurationMs - wordSpeedMs) / (N-1).
// If the user sets a wordSpeedMs longer than the total budget allows, the
// words will overlap heavily but everything still completes in time.
function renderWordByWord(text, revealDurationMs, wordSpeedMs) {
  textEl.classList.add('quote__text--per-word');
  textEl.innerHTML = '';

  const words = text.split(/(\s+)/).filter(s => s.length > 0);
  const visibleWords = words.filter(w => !/^\s+$/.test(w));
  const total = visibleWords.length;
  if (total === 0) { textEl.textContent = text; return; }

  const perWordFadeMs = Math.max(200, wordSpeedMs);
  const remainingForStagger = Math.max(0, revealDurationMs - perWordFadeMs);
  const stepMs = total > 1 ? Math.round(remainingForStagger / (total - 1)) : 0;

  textEl.style.setProperty('--word-duration', `${perWordFadeMs}ms`);

  let wordIndex = 0;
  words.forEach(tok => {
    if (/^\s+$/.test(tok)) {
      textEl.appendChild(document.createTextNode(tok));
      return;
    }
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = tok;
    span.style.animationDelay = `${wordIndex * stepMs}ms`;
    textEl.appendChild(span);
    wordIndex++;
  });
}

function updateFavoriteUi() {
  favBtn.classList.toggle('is-active', isFavorite);
  favIcon.textContent = isFavorite ? '★' : '☆';
  favLabel.textContent = isFavorite ? 'Saved' : 'Save';
}

function leaveWith(action) {
  if (hasLeft) return;
  hasLeft = true;
  quoteEl.classList.add('is-leaving');

  if (ipc) {
    // give the fade-out time to play, then tell main to close the window
    setTimeout(() => ipc.send('quote:action', { id: currentId, action }), 2500);
  } else {
    // preview mode — just remove the text so you can see the exit animation
    setTimeout(() => { textEl.textContent = ''; sourceEl.textContent = ''; }, 2500);
  }
}

document.getElementById('quote-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'favorite') {
    // toggle locally for snappy feedback; main is the source of truth
    isFavorite = !isFavorite;
    updateFavoriteUi();
    if (ipc) ipc.send('quote:action', {
      id: currentId,
      action: isFavorite ? 'favorite' : 'unfavorite',
    });
    return; // do NOT close — favoriting keeps the quote on screen
  }

  leaveWith(action); // 'dismiss' or 'delete'
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape')                                   leaveWith('dismiss');
  else if (e.key === 'f' || e.key === 'F')                  favBtn.click();
  else if (e.key === 'Delete' && e.shiftKey)                leaveWith('delete');
});

// Top-right close X -- same exit path as Esc / Dismiss button
document.getElementById('quote-close').addEventListener('click', () => {
  leaveWith('dismiss');
});

// Double-click anywhere on the popup closes it. Excludes the bottom buttons
// so double-clicking Save Favorite doesn't accidentally dismiss.
document.getElementById('quote').addEventListener('dblclick', (e) => {
  if (e.target.closest('.quote__actions') || e.target.closest('.quote__close')) return;
  leaveWith('dismiss');
});

// Receive the real quote from main:
if (ipc) {
  ipc.on('quote:show', (_evt, payload) => render(payload));
  // Tell main we're ready so it knows when to send the first quote.
  ipc.send('quote:ready');
} else {
  // Standalone preview — useful when iterating on CSS in a regular browser.
  render({
    text: 'Be still, and know that I am God.',
    source: 'Psalm 46:10',
    id: 'preview',
    isFavorite: false,
  });
}
