// QuoteStore — single source of truth for the quote library.
//
// Files:
//   data/quotes.json   array of { id, text, source, tags, category, createdAt }
//   data/state.json    { favorites: [id...], deleted: [id...], queue: { seen: [id...] } }
//
// The queue uses a "seen" list: once a quote is shown, its id is appended.
// When seen contains every active id, it's cleared (full rotation complete).

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

class QuoteStore {
  constructor(dataDir) {
    this.dataDir   = dataDir;
    this.quotesPath = path.join(dataDir, 'quotes.json');
    this.statePath  = path.join(dataDir, 'state.json');
    this._quotes = null;
    this._state  = null;
  }

  // ---- Read ----
  _loadQuotes() {
    if (this._quotes) return this._quotes;
    try {
      const raw = fs.readFileSync(this.quotesPath, 'utf8');
      const arr = JSON.parse(raw);
      // Normalize old seed format (which lacked ids/tags/category)
      this._quotes = arr.map(q => normalizeQuote(q));
    } catch {
      this._quotes = [];
    }
    return this._quotes;
  }

  _loadState() {
    if (this._state) return this._state;
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8');
      const s = JSON.parse(raw);
      this._state = {
        favorites: Array.isArray(s.favorites) ? s.favorites : [],
        deleted:   Array.isArray(s.deleted)   ? s.deleted   : [],
        queue:     { seen: Array.isArray(s.queue?.seen) ? s.queue.seen : [] },
      };
    } catch {
      this._state = { favorites: [], deleted: [], queue: { seen: [] } };
    }
    return this._state;
  }

  _saveQuotes() {
    writeAtomic(this.quotesPath, JSON.stringify(this._quotes, null, 2));
  }
  _saveState() {
    writeAtomic(this.statePath, JSON.stringify(this._state, null, 2));
  }

  // ---- Public API used by main.js / IPC ----

  list() {
    const quotes    = this._loadQuotes();
    const state     = this._loadState();
    const favsSet   = new Set(state.favorites);
    const delSet    = new Set(state.deleted);
    const decorated = quotes
      .filter(q => !delSet.has(q.id))
      .map(q => ({ ...q, isFavorite: favsSet.has(q.id) }));
    // Synthesize 'uncategorized' for any quote without a category, so the
    // settings UI can show & toggle that bucket like any other.
    const catSet = new Set();
    decorated.forEach(q => catSet.add(q.category || 'uncategorized'));
    const categories = [...catSet].sort();
    const stats = {
      total:      decorated.length,
      favorites:  state.favorites.filter(id => !delSet.has(id)).length,
      categories: categories.length,
      deleted:    state.deleted.length,
      seen:       state.queue.seen.filter(id => !delSet.has(id)).length,
    };
    return { quotes: decorated, categories, stats };
  }

  // Returns a list of category names for settings UI, with counts and enabled flag.
  categoryFilterView(categoryFilter) {
    const { quotes } = this.list();
    const counts = {};
    quotes.forEach(q => {
      const c = q.category || 'uncategorized';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.keys(counts).sort().map(name => ({
      name,
      count: counts[name],
      enabled: categoryFilter[name] !== false,   // default ON unless explicitly disabled
    }));
  }

  // Import a JSON string. Returns { imported, skipped, errors, error? }.
  importJson(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { error: `Invalid JSON: ${e.message}` };
    }
    if (!Array.isArray(parsed)) {
      return { error: 'Expected a JSON array of quote objects.' };
    }

    const existing = this._loadQuotes();
    // dedupe key: trimmed-lowercased text + trimmed-lowercased source
    const seenKeys = new Set(existing.map(dedupeKey));

    let imported = 0, skipped = 0, errors = 0;
    parsed.forEach(raw => {
      if (!raw || typeof raw !== 'object') { errors++; return; }
      if (typeof raw.text !== 'string' || !raw.text.trim()) { errors++; return; }
      const q = normalizeQuote(raw);
      const k = dedupeKey(q);
      if (seenKeys.has(k)) { skipped++; return; }
      existing.push(q);
      seenKeys.add(k);
      imported++;
    });

    this._quotes = existing;
    this._saveQuotes();
    return { imported, skipped, errors };
  }

  toggleFavorite(id) {
    const state = this._loadState();
    const idx = state.favorites.indexOf(id);
    if (idx >= 0) state.favorites.splice(idx, 1);
    else          state.favorites.push(id);
    this._saveState();
    return { isFavorite: idx < 0 };
  }

  softDelete(id) {
    const state = this._loadState();
    if (!state.deleted.includes(id)) state.deleted.push(id);
    // also drop from seen-queue so it doesn't block rotation completion
    state.queue.seen = state.queue.seen.filter(sid => sid !== id);
    this._saveState();
    return { ok: true };
  }

  restoreAll() {
    const state = this._loadState();
    const restored = state.deleted.length;
    state.deleted = [];
    this._saveState();
    return { restored };
  }

  // ---- Queue / scheduler ----

  // Pick the next quote to show, respecting categoryFilter and optional favoritesOnly.
  // Updates the seen list. Returns the quote or null if nothing is available.
  nextForQueue({ categoryFilter = {}, favoritesOnly = false } = {}) {
    const { quotes }   = this.list();
    const state        = this._loadState();
    const favSet       = new Set(state.favorites);

    const pool = quotes.filter(q => {
      if (favoritesOnly && !favSet.has(q.id)) return false;
      const c = q.category || 'uncategorized';   // matches categoryFilterView's synthetic bucket
      if (categoryFilter[c] === false) return false;
      return true;
    });

    if (pool.length === 0) return null;

    const seenSet = new Set(state.queue.seen);
    let unseen = pool.filter(q => !seenSet.has(q.id));

    // Full rotation complete -> reset seen list
    if (unseen.length === 0) {
      state.queue.seen = [];
      unseen = pool;
    }

    // Random pick from unseen pool
    const pick = unseen[Math.floor(Math.random() * unseen.length)];
    state.queue.seen.push(pick.id);
    this._saveState();
    return { ...pick, isFavorite: favSet.has(pick.id) };
  }
}

// ---- Helpers ----

function normalizeQuote(q) {
  const text   = String(q.text).trim();
  const source = q.source ? String(q.source).trim() : '';
  const tags   = Array.isArray(q.tags) ? q.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean) : [];
  const category = q.category ? String(q.category).trim().toLowerCase() : '';
  const id = q.id || makeId(text, source);
  const createdAt = q.createdAt || new Date().toISOString();
  return { id, text, source, tags, category, createdAt };
}

function dedupeKey(q) {
  return (String(q.text || '').trim().toLowerCase() + '|' +
          String(q.source || '').trim().toLowerCase());
}

function makeId(text, source) {
  // Stable hash of text+source so re-importing the same quote on a fresh
  // machine still produces the same id (helpful for sync down the road).
  return crypto.createHash('sha1')
    .update(dedupeKey({ text, source }))
    .digest('hex')
    .slice(0, 12);
}

function writeAtomic(filepath, contents) {
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filepath);
}

module.exports = { QuoteStore };
