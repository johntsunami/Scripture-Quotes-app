// Settings window renderer.
// Talks to main via IPC. Main owns the data; renderer just shows it.
//
// IPC channels used:
//   settings:load        ->  { intervalMin, intervalCustom, quietEnabled, quietFrom, quietTo,
//                              fontSize, opacity, categories: [{name, enabled}] }
//   settings:save        ->  same shape, returns { ok: true }
//   quotes:list          ->  { quotes: [...], categories: [...], stats: {...} }
//   quotes:import        ->  ({ json: string }) -> { imported, skipped, errors }
//   quotes:toggle-fav    ->  ({ id }) -> { isFavorite }
//   quotes:delete        ->  ({ id }) -> { ok }
//   quotes:restore-all   ->  () -> { restored }

const ipc = (() => {
  try { return require('electron').ipcRenderer; } catch { return null; }
})();

// =============================================================================
// Tab switching
// =============================================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('is-active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    const target = tab.dataset.tab;
    document.querySelectorAll('.panel').forEach(p => {
      p.classList.toggle('is-active', p.id === `panel-${target}`);
    });
    if (target === 'quotes') refreshLibrary();
  });
});

// =============================================================================
// Settings tab
// =============================================================================
const els = {
  intervalRadios: document.querySelectorAll('input[name="interval"]'),
  quietFrom:      document.getElementById('quiet-from'),
  quietTo:        document.getElementById('quiet-to'),
  quietEnabled:   document.getElementById('quiet-enabled'),
  autoStart:      document.getElementById('auto-start'),
  showOnLaunch:   document.getElementById('show-on-launch'),
  positionGrid:   document.getElementById('position-grid'),
  fontSize:       document.getElementById('font-size'),
  fontSizeVal:    document.getElementById('font-size-val'),
  opacity:        document.getElementById('opacity'),
  opacityVal:     document.getElementById('opacity-val'),
  fontColor:      document.getElementById('font-color'),
  fontColorVal:   document.getElementById('font-color-val'),
  fontColorReset: document.getElementById('font-color-reset'),
  revealDuration: document.getElementById('reveal-duration'),
  revealDurationVal: document.getElementById('reveal-duration-val'),
  revealDelay:    document.getElementById('reveal-delay'),
  revealDelayVal: document.getElementById('reveal-delay-val'),
  revealModeRadios: document.querySelectorAll('input[name="reveal-mode"]'),
  wordSpeed:      document.getElementById('word-speed'),
  wordSpeedVal:   document.getElementById('word-speed-val'),
  wordSpeedRow:   document.getElementById('word-speed-row'),
  previewReplay:  document.getElementById('preview-replay'),
  previewText:    document.querySelector('.preview__text'),
  previewSource:  document.querySelector('.preview__source'),
  deckList:       document.getElementById('deck-list'),
  newDeckBtn:     document.getElementById('new-deck-btn'),
  saveBtn:        document.getElementById('save-settings'),
  saveFeedback:   document.getElementById('save-feedback'),
};

// Currently-selected position. Position picker is button-based not radio-based.
let currentPosition = 'center';

// Wire the position picker
els.positionGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.pos-btn');
  if (!btn) return;
  currentPosition = btn.dataset.pos;
  els.positionGrid.querySelectorAll('.pos-btn').forEach(b => {
    b.classList.toggle('is-active', b === btn);
  });
});

function setPosition(pos) {
  currentPosition = pos;
  els.positionGrid.querySelectorAll('.pos-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.pos === pos);
  });
}

// Live preview when any appearance control changes
function updatePreview({ replay = false } = {}) {
  const size = parseInt(els.fontSize.value, 10);
  const op   = parseInt(els.opacity.value, 10);
  const dur  = parseInt(els.revealDuration.value, 10);  // seconds
  const delay = parseInt(els.revealDelay.value, 10);    // seconds
  const wordSpeedMs = parseInt(els.wordSpeed.value, 10);
  const color = els.fontColor.value;
  const isDefaultColor = color.toLowerCase() === '#3d342b';
  const mode = document.querySelector('input[name="reveal-mode"]:checked')?.value || 'all';

  els.fontSizeVal.textContent       = `${size}pt`;
  els.opacityVal.textContent        = `${op}%`;
  els.revealDurationVal.textContent = `${dur}s`;
  els.revealDelayVal.textContent    = `${delay}s`;
  els.fontColorVal.textContent      = isDefaultColor ? 'Default (brown)' : color.toUpperCase();
  els.wordSpeedVal.textContent      = `${(wordSpeedMs / 1000).toFixed(1)}s per word`;

  els.previewText.style.fontSize     = `${size * 0.7}pt`;
  els.previewSource.style.fontSize   = `${size * 0.4}pt`;
  els.previewText.style.opacity      = (op / 100).toString();
  els.previewSource.style.opacity    = (op / 100).toString();
  els.previewText.style.color        = color;
  els.previewSource.style.color      = color;

  const sourceText = 'Psalm 46:10';
  const verseText  = 'Be still, and know that I am God.';

  if (!replay) {
    els.previewText.style.animation = 'none';
    els.previewSource.style.animation = 'none';
    if (mode === 'word') {
      renderPreviewPerWordStatic(verseText);
    } else {
      els.previewText.classList.remove('quote__text--per-word');
      els.previewText.textContent = verseText;
    }
    els.previewSource.textContent = sourceText;
    return;
  }

  const durMs = dur * 1000;
  els.previewSource.textContent = sourceText;

  if (mode === 'word') {
    renderPreviewPerWordAnimated(verseText, durMs, wordSpeedMs);
    const sourceDelayMs = Math.round(durMs * 0.92);
    fireFadeIn(els.previewSource, durMs, sourceDelayMs);
  } else {
    els.previewText.classList.remove('quote__text--per-word');
    els.previewText.textContent = verseText;
    fireFadeIn(els.previewText, durMs, 0);
    const sourceDelayMs = Math.round(durMs * 0.22);
    fireFadeIn(els.previewSource, durMs, sourceDelayMs);
  }
}

// Apply a one-shot fadeIn animation by toggling it off, forcing reflow, then on.
// The keyframe `fadeIn` is defined in popup.css which is NOT loaded by the
// settings window, so we define it inline in settings.css separately.
function fireFadeIn(el, durationMs, delayMs) {
  el.style.animation = 'none';
  // Force reflow so the browser actually applies the 'none' before we change it back
  void el.offsetWidth;
  el.style.animation = `fadeIn ${durationMs}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${delayMs}ms forwards`;
}

// Per-word preview WITH animation (used by Replay)
function renderPreviewPerWordAnimated(text, durationMs, wordSpeedMs) {
  els.previewText.classList.add('quote__text--per-word');
  els.previewText.innerHTML = '';
  const words = text.split(/(\s+)/).filter(s => s.length > 0);
  const visibleCount = words.filter(w => !/^\s+$/.test(w)).length;
  if (visibleCount === 0) { els.previewText.textContent = text; return; }
  const perWordFadeMs = Math.max(200, wordSpeedMs);
  const stagger = Math.max(0, durationMs - perWordFadeMs);
  const step = visibleCount > 1 ? Math.round(stagger / (visibleCount - 1)) : 0;
  // Reset the parent's animation override
  els.previewText.style.animation = 'none';
  let i = 0;
  words.forEach(tok => {
    if (/^\s+$/.test(tok)) {
      els.previewText.appendChild(document.createTextNode(tok));
      return;
    }
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = tok;
    span.style.animation = `fadeInWord ${perWordFadeMs}ms cubic-bezier(0.22, 0.61, 0.36, 1) ${i * step}ms forwards`;
    span.style.opacity = '0';
    span.style.display = 'inline-block';
    els.previewText.appendChild(span);
    i++;
  });
}

// Per-word preview WITHOUT animation — just show the final state.
function renderPreviewPerWordStatic(text) {
  els.previewText.classList.add('quote__text--per-word');
  els.previewText.innerHTML = '';
  const words = text.split(/(\s+)/).filter(s => s.length > 0);
  words.forEach(tok => {
    if (/^\s+$/.test(tok)) {
      els.previewText.appendChild(document.createTextNode(tok));
      return;
    }
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = tok;
    span.style.opacity = '1';            // skip the fade
    span.style.display = 'inline-block';
    els.previewText.appendChild(span);
  });
}

els.fontSize.addEventListener('input',       () => updatePreview());
els.opacity.addEventListener('input',        () => updatePreview());
els.fontColor.addEventListener('input',      () => updatePreview());
els.revealDuration.addEventListener('input', () => updatePreview());
els.revealDelay.addEventListener('input', () => updatePreview());
els.wordSpeed.addEventListener('input',      () => updatePreview());
els.revealModeRadios.forEach(r => r.addEventListener('change', () => {
  updateWordSpeedRowVisibility();
  updatePreview({ replay: true });
}));

els.fontColorReset.addEventListener('click', (e) => {
  e.preventDefault();
  els.fontColor.value = '#3D342B';
  updatePreview();
});

els.previewReplay.addEventListener('click', () => updatePreview({ replay: true }));

async function loadSettings() {
  if (!ipc) return;
  const s = await ipc.invoke('settings:load');
  // interval -- match against the preset list; if no match, default to 30min
  const presets = ['0.0167','0.1667','0.5','1','5','15','30','60','120','180','240','480'];
  const intervalKey = presets.includes(String(s.intervalMin))
    ? String(s.intervalMin) : '30';
  const intervalEl = document.querySelector(`input[name="interval"][value="${intervalKey}"]`);
  if (intervalEl) intervalEl.checked = true;
  // quiet hours
  els.quietFrom.value    = s.quietFrom || '22:00';
  els.quietTo.value      = s.quietTo   || '07:00';
  els.quietEnabled.checked = !!s.quietEnabled;
  // startup
  els.autoStart.checked    = s.autoStart    !== false;  // default true if missing
  els.showOnLaunch.checked = s.showOnLaunch !== false;  // default true if missing
  // position
  setPosition(s.position || 'center');
  // appearance
  els.fontSize.value       = s.fontSize       ?? 30;
  els.opacity.value        = s.opacity        ?? 100;
  els.fontColor.value      = s.fontColor      || '#3D342B';
  els.revealDuration.value = s.revealDurationMs ? Math.round(s.revealDurationMs / 1000) : 7;
  els.revealDelay.value    = s.revealDelayMs    != null ? Math.round(s.revealDelayMs    / 1000) : 1;
  els.wordSpeed.value      = s.wordSpeedMs    ?? 1200;
  const mode = s.revealMode || 'all';
  document.querySelector(`input[name="reveal-mode"][value="${mode}"]`).checked = true;
  updateWordSpeedRowVisibility();
  updatePreview();
  // decks
  renderDeckList(s.decks || []);
}

function updateWordSpeedRowVisibility() {
  const mode = document.querySelector('input[name="reveal-mode"]:checked')?.value || 'all';
  els.wordSpeedRow.style.display = mode === 'word' ? '' : 'none';
}

// Renders the deck list in the Settings tab. Each row shows the deck name,
// quote count, and progress, with a toggle for inclusion in rotation.
// Built-in decks show a badge and hide the delete button.
function renderDeckList(decks) {
  if (decks.length === 0) {
    els.deckList.innerHTML = '<em class="muted">No decks yet.</em>';
    return;
  }
  els.deckList.innerHTML = '';
  decks.forEach(d => {
    const row = document.createElement('div');
    row.className = 'deck-row';
    row.dataset.deckId = d.id;
    row.innerHTML = `
      <input type="checkbox" class="deck-row__check" data-deck-id="${escapeAttr(d.id)}" ${d.enabled ? 'checked' : ''} title="Include in rotation"/>
      <div class="deck-row__main">
        <div class="deck-row__name">
          <span class="deck-row__name-text">${escapeHtml(d.name)}</span>
          ${d.builtin ? '<span class="deck-row__badge">Built-in</span>' : ''}
        </div>
        <div class="deck-row__meta">${d.count} quote${d.count === 1 ? '' : 's'} · ${d.seen} seen this rotation</div>
      </div>
      ${d.builtin ? '' : `<button type="button" class="deck-row__action" data-action="rename" data-deck-id="${escapeAttr(d.id)}">Rename</button>`}
      ${d.builtin ? '' : `<button type="button" class="deck-row__action deck-row__action--danger" data-action="delete" data-deck-id="${escapeAttr(d.id)}">Delete</button>`}
    `;
    els.deckList.appendChild(row);
  });
}

// Deck-list actions: rename + delete
els.deckList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.deckId;
  if (btn.dataset.action === 'rename') {
    const newName = prompt('New deck name:');
    if (!newName) return;
    const r = await ipc.invoke('decks:rename', { id, name: newName });
    if (r.error) { alert(r.error); return; }
    await reloadDecks();
  } else if (btn.dataset.action === 'delete') {
    if (!confirm('Delete this deck and all its quotes? This cannot be undone.')) return;
    const r = await ipc.invoke('decks:delete', { id });
    if (r.error) { alert(r.error); return; }
    await reloadDecks();
  }
});

els.newDeckBtn.addEventListener('click', async () => {
  const name = prompt('Name for the new deck:');
  if (!name) return;
  const r = await ipc.invoke('decks:create', { name });
  if (r.error) { alert(r.error); return; }
  await reloadDecks();
});

async function reloadDecks() {
  const s = await ipc.invoke('settings:load');
  renderDeckList(s.decks || []);
  // Also refresh the Quotes-tab deck dropdowns
  if (typeof refreshLibrary === 'function') refreshLibrary();
}

els.saveBtn.addEventListener('click', async () => {
  const intervalValue = document.querySelector('input[name="interval"]:checked')?.value;
  // parseFloat handles the 0.5 (30 sec) preset; all others are integers.
  const intervalMin = parseFloat(intervalValue);
  if (!intervalMin || intervalMin < 0) {
    flashFeedback(els.saveFeedback, 'Pick an interval.', 'error');
    return;
  }

  // Collect deck enable/disable from checkboxes
  const decks = Array.from(els.deckList.querySelectorAll('input[data-deck-id]'))
    .map(cb => ({ id: cb.dataset.deckId, enabled: cb.checked }));

  const payload = {
    intervalMin,
    quietEnabled: els.quietEnabled.checked,
    quietFrom: els.quietFrom.value,
    quietTo: els.quietTo.value,
    position: currentPosition,
    fontSize: parseInt(els.fontSize.value, 10),
    opacity:  parseInt(els.opacity.value, 10),
    fontColor: els.fontColor.value,
    revealDurationMs: parseInt(els.revealDuration.value, 10) * 1000,
    revealDelayMs:    parseInt(els.revealDelay.value, 10) * 1000,
    revealMode: document.querySelector('input[name="reveal-mode"]:checked')?.value || 'all',
    wordSpeedMs: parseInt(els.wordSpeed.value, 10),
    autoStart:    els.autoStart.checked,
    showOnLaunch: els.showOnLaunch.checked,
    decks,
  };
  if (ipc) {
    await ipc.invoke('settings:save', payload);
    flashFeedback(els.saveFeedback, 'Saved.', 'success');
  }
});

function flashFeedback(el, msg, kind) {
  el.textContent = msg;
  el.classList.remove('is-success', 'is-error');
  el.classList.add('is-visible');
  if (kind === 'success') el.style.color = '#2f7a3a';
  if (kind === 'error')   el.style.color = '#8b3a3a';
  setTimeout(() => el.classList.remove('is-visible'), 2400);
}

// =============================================================================
// Quotes tab
// =============================================================================
const qels = {
  statTotal:       document.getElementById('stat-total'),
  statFavorites:   document.getElementById('stat-favorites'),
  statDecks:       document.getElementById('stat-decks'),
  statDeleted:     document.getElementById('stat-deleted'),
  statSeen:        document.getElementById('stat-seen'),
  importTextarea:  document.getElementById('import-textarea'),
  importBtn:       document.getElementById('import-btn'),
  importFeedback:  document.getElementById('import-feedback'),
  importDeck:      document.getElementById('import-deck'),
  promptCount:     document.getElementById('prompt-count'),
  promptTopic:     document.getElementById('prompt-topic'),
  promptPreview:   document.getElementById('prompt-preview'),
  copyPromptBtn:   document.getElementById('copy-prompt'),
  copyPromptLabel: document.getElementById('copy-prompt-label'),
  search:          document.getElementById('search'),
  filterDeck:      document.getElementById('filter-deck'),
  filterFavorites: document.getElementById('filter-favorites'),
  quoteList:       document.getElementById('quote-list'),
  restoreBtn:      document.getElementById('restore-deleted'),
  // Add-quote form
  addQuoteText:    document.getElementById('add-quote-text'),
  addQuoteSource:  document.getElementById('add-quote-source'),
  addQuoteDeck:    document.getElementById('add-quote-deck'),
  addQuoteBtn:     document.getElementById('add-quote-btn'),
  addQuoteFeedback: document.getElementById('add-quote-feedback'),
  // Bulk-select toolbar
  bulkBar:         document.getElementById('bulk-bar'),
  bulkCount:       document.getElementById('bulk-count'),
  bulkFavBtn:      document.getElementById('bulk-fav-btn'),
  bulkUnfavBtn:    document.getElementById('bulk-unfav-btn'),
  bulkDeleteBtn:   document.getElementById('bulk-delete-btn'),
  bulkClearBtn:    document.getElementById('bulk-clear-btn'),
};

// ===== Prompt builder =====
// Generates a beginner-friendly AI prompt that the user can copy and paste
// into Claude / ChatGPT / etc. The AI's response (a JSON array) gets pasted
// back into the import box.
function buildPrompt() {
  const count = Math.max(1, Math.min(2000, parseInt(qels.promptCount.value, 10) || 100));
  const topic = (qels.promptTopic.value || 'positivity').trim();
  // Derive a one-word category from the topic for filtering. Lowercase the
  // first word; user can edit the JSON afterward if they want a different one.
  const category = topic.split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  return [
    `Please generate ${count} short quotes about ${topic}.`,
    ``,
    `Format your answer as a valid JSON array. Each item should look like this:`,
    `{`,
    `  "text": "The quote itself, kept under 200 characters.",`,
    `  "source": "Who said it -- a real person, book, or scripture reference. Use 'Anonymous' if unknown. Do not invent attributions.",`,
    `  "category": "${category}"`,
    `}`,
    ``,
    `Rules:`,
    `- Output ONLY the JSON array. No introduction, no markdown code fences, no commentary.`,
    `- Start your reply with [ and end it with ].`,
    `- All quotes must be genuinely attributable. Do not fabricate authors.`,
    `- Keep each quote concise enough to fit in a small popup window.`,
    `- Avoid duplicates.`,
  ].join('\n');
}

function refreshPromptPreview() {
  qels.promptPreview.textContent = buildPrompt();
}

qels.promptCount.addEventListener('input', refreshPromptPreview);
qels.promptTopic.addEventListener('input', refreshPromptPreview);

qels.copyPromptBtn.addEventListener('click', async () => {
  const text = buildPrompt();
  try {
    await navigator.clipboard.writeText(text);
    qels.copyPromptLabel.textContent = 'Copied!';
    setTimeout(() => { qels.copyPromptLabel.textContent = 'Copy prompt'; }, 2000);
  } catch (err) {
    // Fallback for environments where clipboard API is restricted
    qels.promptPreview.focus();
    const range = document.createRange();
    range.selectNodeContents(qels.promptPreview);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    qels.copyPromptLabel.textContent = 'Press Ctrl+C';
    setTimeout(() => { qels.copyPromptLabel.textContent = 'Copy prompt'; }, 3000);
  }
});

// Build the preview on first load
refreshPromptPreview();

// Drag-drop a .json file onto the textarea
qels.importTextarea.addEventListener('dragover', (e) => {
  e.preventDefault();
  qels.importTextarea.classList.add('is-drop-target');
});
qels.importTextarea.addEventListener('dragleave', () => {
  qels.importTextarea.classList.remove('is-drop-target');
});
qels.importTextarea.addEventListener('drop', async (e) => {
  e.preventDefault();
  qels.importTextarea.classList.remove('is-drop-target');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const text = await file.text();
  qels.importTextarea.value = text;
});

qels.importBtn.addEventListener('click', async () => {
  const json = qels.importTextarea.value.trim();
  if (!json) {
    flashFeedback(qels.importFeedback, 'Paste some JSON first.', 'error');
    return;
  }
  if (!ipc) return;

  // Determine target deck: __new__ means create one named from the topic field.
  const target = qels.importDeck.value;
  const deckId = target === '__new__' ? null : target;
  const deckName = target === '__new__'
    ? (qels.promptTopic.value || 'Imported').trim().replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const result = await ipc.invoke('quotes:import', { json, deckId, deckName });
  if (result.error) {
    flashFeedback(qels.importFeedback, result.error, 'error');
    return;
  }
  const msg = `Imported ${result.imported} new · skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}${result.errors ? ` · ${result.errors} invalid` : ''}.`
    + (result.warning ? ` ${result.warning}` : '');
  flashFeedback(qels.importFeedback, msg, result.warning ? 'error' : 'success');
  qels.importTextarea.value = '';
  refreshLibrary();
});

qels.search.addEventListener('input',           () => renderQuoteList());
qels.filterDeck.addEventListener('change',      () => renderQuoteList());
qels.filterFavorites.addEventListener('change', () => renderQuoteList());

qels.restoreBtn.addEventListener('click', async () => {
  if (!ipc) return;
  const r = await ipc.invoke('quotes:restore-all');
  flashFeedback(qels.importFeedback, `Restored ${r.restored} deleted quote${r.restored === 1 ? '' : 's'}.`, 'success');
  refreshLibrary();
});

// ===== Add Quote form =====
qels.addQuoteBtn.addEventListener('click', async () => {
  const text = qels.addQuoteText.value.trim();
  const source = qels.addQuoteSource.value.trim();
  const deckId = qels.addQuoteDeck.value;
  if (!text) {
    flashFeedback(qels.addQuoteFeedback, 'Enter the quote text.', 'error');
    return;
  }
  if (!deckId) {
    flashFeedback(qels.addQuoteFeedback, 'Choose a deck (built-in decks cannot accept new quotes — create or pick a user deck).', 'error');
    return;
  }
  if (!ipc) return;
  const r = await ipc.invoke('quotes:add', { deckId, text, source });
  if (r.error) {
    flashFeedback(qels.addQuoteFeedback, r.error, 'error');
    return;
  }
  flashFeedback(qels.addQuoteFeedback, 'Added.', 'success');
  qels.addQuoteText.value = '';
  qels.addQuoteSource.value = '';
  refreshLibrary();
});

// ===== Multi-select state =====
const selection = new Set();   // quote ids currently selected
let lastClickedIdx = null;     // index of last-clicked row (for shift-range)

function updateBulkBar() {
  if (selection.size === 0) {
    qels.bulkBar.hidden = true;
  } else {
    qels.bulkBar.hidden = false;
    qels.bulkCount.textContent = selection.size;
  }
}

qels.bulkFavBtn.addEventListener('click', async () => {
  if (!ipc) return;
  await ipc.invoke('quotes:bulk-fav', { ids: [...selection] });
  selection.clear();
  refreshLibrary();
});
qels.bulkUnfavBtn.addEventListener('click', async () => {
  if (!ipc) return;
  await ipc.invoke('quotes:bulk-unfav', { ids: [...selection] });
  selection.clear();
  refreshLibrary();
});
qels.bulkDeleteBtn.addEventListener('click', async () => {
  if (!ipc) return;
  if (!confirm(`Delete ${selection.size} quote${selection.size === 1 ? '' : 's'}? This can be undone via "Restore deleted".`)) return;
  await ipc.invoke('quotes:bulk-delete', { ids: [...selection] });
  selection.clear();
  refreshLibrary();
});
qels.bulkClearBtn.addEventListener('click', () => {
  selection.clear();
  document.querySelectorAll('.quote-row.is-selected').forEach(r => r.classList.remove('is-selected'));
  updateBulkBar();
});

let libraryCache = { quotes: [], decks: [], stats: {} };

async function refreshLibrary() {
  if (!ipc) return;
  const deckIdFilter = qels.filterDeck.value || '__all__';
  libraryCache = await ipc.invoke('quotes:list', { deckId: deckIdFilter });
  qels.statTotal.textContent     = libraryCache.stats.total     ?? 0;
  qels.statFavorites.textContent = libraryCache.stats.favorites ?? 0;
  qels.statDecks.textContent     = libraryCache.stats.decks     ?? 0;
  qels.statDeleted.textContent   = libraryCache.stats.deleted   ?? 0;
  qels.statSeen.textContent      = libraryCache.stats.seen      ?? 0;

  // Refresh the filter dropdown (preserves current selection)
  populateDeckSelect(qels.filterDeck, libraryCache.decks, deckIdFilter, true);
  // Refresh the add-quote target dropdown (user decks only — can't add to built-ins)
  populateDeckSelect(qels.addQuoteDeck, libraryCache.decks.filter(d => !d.builtin), qels.addQuoteDeck.value);
  // Refresh the import target dropdown (user decks + __new__)
  populateImportDeck(libraryCache.decks);

  selection.clear();
  updateBulkBar();
  renderQuoteList();
}

function populateDeckSelect(selectEl, decks, currentValue, includeAll = false) {
  const prev = currentValue || selectEl.value;
  selectEl.innerHTML = '';
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = '__all__';
    opt.textContent = 'All decks';
    selectEl.appendChild(opt);
  }
  decks.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.count})`;
    selectEl.appendChild(opt);
  });
  if (prev && [...selectEl.options].some(o => o.value === prev)) {
    selectEl.value = prev;
  }
}

function populateImportDeck(decks) {
  const prev = qels.importDeck.value;
  qels.importDeck.innerHTML = '';
  const optNew = document.createElement('option');
  optNew.value = '__new__';
  optNew.textContent = '+ New deck (named from topic)';
  qels.importDeck.appendChild(optNew);
  decks.filter(d => !d.builtin).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    qels.importDeck.appendChild(opt);
  });
  if (prev && [...qels.importDeck.options].some(o => o.value === prev)) {
    qels.importDeck.value = prev;
  }
}

function renderQuoteList() {
  const search = qels.search.value.trim().toLowerCase();
  const favsOnly = qels.filterFavorites.checked;

  // Note: deck filtering happens server-side via refreshLibrary; libraryCache.quotes
  // is already deck-filtered. Search and favorites are applied client-side here.
  const filtered = libraryCache.quotes.filter(q => {
    if (favsOnly && !q.isFavorite) return false;
    if (search) {
      const hay = `${q.text} ${q.source || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    qels.quoteList.innerHTML = '<em class="muted">No quotes match these filters.</em>';
    return;
  }

  qels.quoteList.innerHTML = '';
  const slice = filtered.slice(0, 200);
  slice.forEach((q, i) => qels.quoteList.appendChild(renderQuoteRow(q, i, slice)));
  if (filtered.length > 200) {
    const more = document.createElement('em');
    more.className = 'muted';
    more.textContent = `… and ${filtered.length - 200} more. Use search to narrow.`;
    qels.quoteList.appendChild(more);
  }
}

function renderQuoteRow(q, idx, visibleList) {
  const row = document.createElement('div');
  row.className = 'quote-row';
  row.dataset.id = q.id;
  row.dataset.idx = idx;
  if (selection.has(q.id)) row.classList.add('is-selected');

  row.innerHTML = `
    <div class="quote-row__main">
      <div class="quote-row__text">${escapeHtml(q.text)}</div>
      <div class="quote-row__meta">
        ${q.source ? escapeHtml(q.source) : '<em style="font-style:italic;">no source</em>'}
        ${q.deckName ? `<span class="quote-row__deck-pill">${escapeHtml(q.deckName)}</span>` : ''}
      </div>
    </div>
    <button class="quote-row__fav ${q.isFavorite ? 'is-fav' : ''}" title="${q.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${q.isFavorite ? '★' : '☆'}</button>
    <button class="quote-row__del" title="Delete forever">🗑</button>
  `;

  // Row click: toggle selection (with shift-range)
  row.addEventListener('click', (e) => {
    // Don't trigger select on button clicks
    if (e.target.closest('.quote-row__fav') || e.target.closest('.quote-row__del')) return;
    const id = q.id;
    if (e.shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end   = Math.max(lastClickedIdx, idx);
      for (let i = start; i <= end; i++) {
        selection.add(visibleList[i].id);
        const r = qels.quoteList.querySelector(`.quote-row[data-idx="${i}"]`);
        if (r) r.classList.add('is-selected');
      }
    } else {
      if (selection.has(id)) {
        selection.delete(id);
        row.classList.remove('is-selected');
      } else {
        selection.add(id);
        row.classList.add('is-selected');
      }
      lastClickedIdx = idx;
    }
    updateBulkBar();
  });

  row.querySelector('.quote-row__fav').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!ipc) return;
    await ipc.invoke('quotes:toggle-fav', { id: q.id });
    refreshLibrary();
  });
  row.querySelector('.quote-row__del').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!ipc) return;
    if (!confirm(`Delete this quote?\n\n"${q.text}"`)) return;
    await ipc.invoke('quotes:delete', { id: q.id });
    refreshLibrary();
  });
  return row;
}

// =============================================================================
// Utilities
// =============================================================================
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

// =============================================================================
// Initial load
// =============================================================================
loadSettings();
// Quotes library loads lazily when the Quotes tab is first clicked,
// to keep the initial open snappy.
