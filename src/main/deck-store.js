// DeckStore — multi-deck storage layer.
//
// Layout:
//   assets/decks/*.json     bundled shipped decks (read-only source)
//   data/decks/*.json       user-visible deck files (writable, includes copies of shipped decks)
//   data/state.json         per-deck rotation state, plus favorites and deleted ids
//
// Each deck file:
//   {
//     "name": "Display name",
//     "description": "Short description",
//     "builtin": false,      // true for shipped decks; user can't delete but can disable
//     "version": 1,
//     "quotes": [ { id, text, source, category, tags, createdAt }, ... ]
//   }
//
// Quote ids are stable hashes of text+source so the same quote across decks
// has the same id (helpful for favorites/deletes that span decks).

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ===== Caps (soft, with friendly error messages) =====
const CAPS = {
  MAX_DECKS:               20,
  MAX_QUOTES_PER_DECK:     5000,
  MAX_TOTAL_QUOTES:        50000,
  MAX_QUOTE_TEXT_LENGTH:   500,
  MAX_DECK_NAME_LENGTH:    60,
};

class DeckStore {
  constructor(dataDir, assetsDecksDir) {
    this.dataDir       = dataDir;
    this.decksDir      = path.join(dataDir, 'decks');
    this.assetsDecksDir = assetsDecksDir;
    this.statePath     = path.join(dataDir, 'state.json');
    this.legacyQuotesPath = path.join(dataDir, 'quotes.json');
    this._decks = null;    // Map<deckId, deckObject>
    this._state = null;

    if (!fs.existsSync(this.decksDir)) fs.mkdirSync(this.decksDir, { recursive: true });
    this._installShippedDecks();
    this._migrateLegacyQuotesJson();
  }

  // Copy any shipped decks from assets/decks/ into data/decks/ if not present.
  // We DON'T overwrite if already there — user may have edited/disabled them.
  _installShippedDecks() {
    if (!fs.existsSync(this.assetsDecksDir)) return;
    const files = fs.readdirSync(this.assetsDecksDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const dest = path.join(this.decksDir, f);
      if (fs.existsSync(dest)) continue;  // user already has this deck
      const src = path.join(this.assetsDecksDir, f);
      fs.copyFileSync(src, dest);
    }
  }

  // One-time migration from the old single-file quotes.json into a deck.
  _migrateLegacyQuotesJson() {
    if (!fs.existsSync(this.legacyQuotesPath)) return;
    try {
      const raw = fs.readFileSync(this.legacyQuotesPath, 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) {
        // Nothing to migrate; just clean up.
        fs.renameSync(this.legacyQuotesPath, this.legacyQuotesPath + '.migrated');
        return;
      }
      // Create a deck named "Imported" with whatever was there.
      const deckId = 'imported-legacy';
      const deckPath = path.join(this.decksDir, `${deckId}.json`);
      if (!fs.existsSync(deckPath)) {
        const deck = {
          id: deckId,
          name: 'Imported',
          description: `Quotes migrated from the previous single-file storage on ${new Date().toISOString().slice(0,10)}.`,
          builtin: false,
          version: 1,
          quotes: arr.map(q => normalizeQuote(q)),
        };
        writeAtomic(deckPath, JSON.stringify(deck, null, 2));
      }
      // Rename the legacy file so we don't migrate twice.
      fs.renameSync(this.legacyQuotesPath, this.legacyQuotesPath + '.migrated');
    } catch (e) {
      console.error('Legacy migration failed:', e);
    }
  }

  // ----- Load all decks into memory -----
  _loadDecks(force = false) {
    if (this._decks && !force) return this._decks;
    this._decks = new Map();
    if (!fs.existsSync(this.decksDir)) return this._decks;
    const files = fs.readdirSync(this.decksDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const full = path.join(this.decksDir, f);
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const deck = JSON.parse(raw);
        const id = path.basename(f, '.json');
        deck.id = id;
        deck.quotes = (deck.quotes || []).map(q => normalizeQuote(q));
        this._decks.set(id, deck);
      } catch (e) {
        console.error(`Failed to load deck ${f}:`, e);
      }
    }
    return this._decks;
  }

  _loadState() {
    if (this._state) return this._state;
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8');
      const s = JSON.parse(raw);
      this._state = {
        favorites:     Array.isArray(s.favorites)     ? s.favorites     : [],
        deleted:       Array.isArray(s.deleted)       ? s.deleted       : [],
        deckSeen:      typeof s.deckSeen === 'object' && s.deckSeen ? s.deckSeen : {},
        roundRobinIdx: typeof s.roundRobinIdx === 'number' ? s.roundRobinIdx : 0,
        // Per-deck enabled flag. Defaults to true if missing.
        deckEnabled:   typeof s.deckEnabled === 'object' && s.deckEnabled ? s.deckEnabled : {},
      };
    } catch {
      this._state = { favorites: [], deleted: [], deckSeen: {}, roundRobinIdx: 0, deckEnabled: {} };
    }
    return this._state;
  }

  _saveDeck(deckId) {
    const deck = this._decks.get(deckId);
    if (!deck) return;
    const filePath = path.join(this.decksDir, `${deckId}.json`);
    const toWrite = { ...deck };
    delete toWrite.id;  // id is derived from filename, don't persist it
    writeAtomic(filePath, JSON.stringify(toWrite, null, 2));
  }

  _saveState() {
    writeAtomic(this.statePath, JSON.stringify(this._state, null, 2));
  }

  // =========================================================================
  // Public API
  // =========================================================================

  // List all decks with metadata for the Settings UI.
  // Each: { id, name, description, builtin, count, enabled }
  listDecks() {
    const decks = this._loadDecks();
    const state = this._loadState();
    const delSet = new Set(state.deleted);
    const out = [];
    for (const [id, deck] of decks) {
      const liveCount = deck.quotes.filter(q => !delSet.has(q.id)).length;
      out.push({
        id,
        name: deck.name || id,
        description: deck.description || '',
        builtin: !!deck.builtin,
        count: liveCount,
        seen: (state.deckSeen[id] || []).filter(qid => !delSet.has(qid)).length,
        enabled: state.deckEnabled[id] !== false,  // default ON
      });
    }
    // Stable order: built-ins first, then alphabetical
    out.sort((a, b) => {
      if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  }

  // Stats for the top-bar in the Quotes tab.
  stats() {
    const decks = this._loadDecks();
    const state = this._loadState();
    const delSet = new Set(state.deleted);
    let total = 0;
    decks.forEach(d => { total += d.quotes.filter(q => !delSet.has(q.id)).length; });
    const favorites = state.favorites.filter(id => !delSet.has(id)).length;
    let seenTotal = 0;
    Object.values(state.deckSeen).forEach(arr => {
      seenTotal += arr.filter(id => !delSet.has(id)).length;
    });
    return {
      total,
      favorites,
      decks: decks.size,
      deleted: state.deleted.length,
      seen: seenTotal,
    };
  }

  // List quotes from one specific deck (for the deck-filtered library view).
  // Pass deckId='__all__' to list across all decks.
  listQuotes(deckId = '__all__') {
    const decks = this._loadDecks();
    const state = this._loadState();
    const favSet = new Set(state.favorites);
    const delSet = new Set(state.deleted);
    const out = [];
    for (const [id, deck] of decks) {
      if (deckId !== '__all__' && id !== deckId) continue;
      for (const q of deck.quotes) {
        if (delSet.has(q.id)) continue;
        out.push({
          ...q,
          deckId: id,
          deckName: deck.name,
          isFavorite: favSet.has(q.id),
        });
      }
    }
    return out;
  }

  // Create a new (empty) user deck. Returns { id } or { error }.
  createDeck(name) {
    name = String(name || '').trim();
    if (!name) return { error: 'Deck name required.' };
    if (name.length > CAPS.MAX_DECK_NAME_LENGTH) {
      return { error: `Deck name too long (max ${CAPS.MAX_DECK_NAME_LENGTH} characters).` };
    }
    const decks = this._loadDecks();
    if (decks.size >= CAPS.MAX_DECKS) {
      return { error: `Maximum ${CAPS.MAX_DECKS} decks reached. Delete one first.` };
    }
    const id = sanitizeDeckId(name) + '-' + crypto.randomBytes(2).toString('hex');
    const deck = {
      id,
      name,
      description: '',
      builtin: false,
      version: 1,
      quotes: [],
    };
    decks.set(id, deck);
    this._saveDeck(id);
    return { id };
  }

  renameDeck(deckId, newName) {
    const deck = this._loadDecks().get(deckId);
    if (!deck) return { error: 'Deck not found.' };
    if (deck.builtin) return { error: 'Cannot rename a built-in deck.' };
    newName = String(newName || '').trim();
    if (!newName) return { error: 'Name cannot be empty.' };
    if (newName.length > CAPS.MAX_DECK_NAME_LENGTH) {
      return { error: `Name too long (max ${CAPS.MAX_DECK_NAME_LENGTH} chars).` };
    }
    deck.name = newName;
    this._saveDeck(deckId);
    return { ok: true };
  }

  deleteDeck(deckId) {
    const deck = this._loadDecks().get(deckId);
    if (!deck) return { error: 'Deck not found.' };
    if (deck.builtin) return { error: 'Cannot delete a built-in deck (you can disable it instead).' };
    const filePath = path.join(this.decksDir, `${deckId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    this._loadDecks().delete(deckId);
    // Clean up state entries for this deck
    const state = this._loadState();
    delete state.deckSeen[deckId];
    delete state.deckEnabled[deckId];
    this._saveState();
    return { ok: true };
  }

  setDeckEnabled(deckId, enabled) {
    const deck = this._loadDecks().get(deckId);
    if (!deck) return { error: 'Deck not found.' };
    const state = this._loadState();
    state.deckEnabled[deckId] = !!enabled;
    this._saveState();
    return { ok: true };
  }

  // Import a JSON string into a target deck. If deckId is null, creates a new deck.
  importJson(jsonString, deckId, deckName) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { error: `Invalid JSON: ${e.message}` };
    }
    // Tolerate two shapes:
    //   1. Raw array: [{ text, source, ... }, ...]
    //   2. Deck object: { name, quotes: [...] }
    let raw;
    let suggestedName = deckName;
    if (Array.isArray(parsed)) {
      raw = parsed;
    } else if (parsed && Array.isArray(parsed.quotes)) {
      raw = parsed.quotes;
      if (!suggestedName) suggestedName = parsed.name;
    } else {
      return { error: 'Expected a JSON array of quote objects, or a deck object with a "quotes" array.' };
    }

    // Determine target deck
    let deck;
    if (deckId && this._loadDecks().has(deckId)) {
      deck = this._loadDecks().get(deckId);
      if (deck.builtin) return { error: 'Cannot import into a built-in deck. Create a new deck instead.' };
    } else {
      const created = this.createDeck(suggestedName || 'Imported');
      if (created.error) return created;
      deck = this._loadDecks().get(created.id);
    }

    // Validate + dedupe
    const seenKeys = new Set(deck.quotes.map(dedupeKey));
    let imported = 0, skipped = 0, errors = 0;
    const tooLong = [];

    // Global cap check
    const currentTotal = this.stats().total;
    const headroom = CAPS.MAX_TOTAL_QUOTES - currentTotal;
    const deckHeadroom = CAPS.MAX_QUOTES_PER_DECK - deck.quotes.length;
    const cap = Math.min(headroom, deckHeadroom);

    for (const r of raw) {
      if (!r || typeof r !== 'object') { errors++; continue; }
      if (typeof r.text !== 'string' || !r.text.trim()) { errors++; continue; }
      if (r.text.length > CAPS.MAX_QUOTE_TEXT_LENGTH) {
        tooLong.push(r.text.slice(0, 40));
        errors++;
        continue;
      }
      const q = normalizeQuote(r);
      const k = dedupeKey(q);
      if (seenKeys.has(k)) { skipped++; continue; }
      if (imported >= cap) {
        return {
          imported,
          skipped,
          errors,
          warning: cap === headroom
            ? `Stopped at ${imported} imports — total library cap is ${CAPS.MAX_TOTAL_QUOTES}. Delete some quotes to make room.`
            : `Stopped at ${imported} imports — this deck holds at most ${CAPS.MAX_QUOTES_PER_DECK}. Create a new deck for more.`,
          deckId: deck.id,
        };
      }
      deck.quotes.push(q);
      seenKeys.add(k);
      imported++;
    }

    this._saveDeck(deck.id);
    return { imported, skipped, errors, deckId: deck.id };
  }

  // Add a single quote to a deck (used by the "+ Add quote" form)
  addQuote(deckId, { text, source = '', category = '', tags = [] }) {
    const deck = this._loadDecks().get(deckId);
    if (!deck) return { error: 'Deck not found.' };
    if (deck.builtin) return { error: 'Cannot add to a built-in deck.' };
    text = String(text || '').trim();
    if (!text) return { error: 'Quote text required.' };
    if (text.length > CAPS.MAX_QUOTE_TEXT_LENGTH) {
      return { error: `Quote too long (max ${CAPS.MAX_QUOTE_TEXT_LENGTH} characters).` };
    }
    if (deck.quotes.length >= CAPS.MAX_QUOTES_PER_DECK) {
      return { error: `Deck full (max ${CAPS.MAX_QUOTES_PER_DECK}).` };
    }
    if (this.stats().total >= CAPS.MAX_TOTAL_QUOTES) {
      return { error: `Library full (max ${CAPS.MAX_TOTAL_QUOTES}).` };
    }
    const q = normalizeQuote({ text, source, category, tags });
    // Dedupe within this deck
    if (deck.quotes.some(existing => dedupeKey(existing) === dedupeKey(q))) {
      return { error: 'This quote is already in the deck.' };
    }
    deck.quotes.push(q);
    this._saveDeck(deckId);
    return { ok: true, id: q.id };
  }

  toggleFavorite(id) {
    const state = this._loadState();
    const idx = state.favorites.indexOf(id);
    if (idx >= 0) state.favorites.splice(idx, 1);
    else          state.favorites.push(id);
    this._saveState();
    return { isFavorite: idx < 0 };
  }

  // Bulk favorite — sets all given ids to favorite=true (idempotent).
  bulkFavorite(ids) {
    const state = this._loadState();
    const set = new Set(state.favorites);
    for (const id of ids) set.add(id);
    state.favorites = [...set];
    this._saveState();
    return { count: ids.length };
  }

  // Bulk unfavorite — opposite of above.
  bulkUnfavorite(ids) {
    const state = this._loadState();
    const set = new Set(state.favorites);
    for (const id of ids) set.delete(id);
    state.favorites = [...set];
    this._saveState();
    return { count: ids.length };
  }

  softDelete(id) {
    const state = this._loadState();
    if (!state.deleted.includes(id)) state.deleted.push(id);
    // Drop from every deck's seen-queue so rotation doesn't stall on it.
    for (const deckId of Object.keys(state.deckSeen)) {
      state.deckSeen[deckId] = state.deckSeen[deckId].filter(sid => sid !== id);
    }
    this._saveState();
    return { ok: true };
  }

  bulkDelete(ids) {
    const state = this._loadState();
    const set = new Set(state.deleted);
    for (const id of ids) set.add(id);
    state.deleted = [...set];
    // Drop from every deck's seen-queue
    const delSet = new Set(ids);
    for (const deckId of Object.keys(state.deckSeen)) {
      state.deckSeen[deckId] = state.deckSeen[deckId].filter(sid => !delSet.has(sid));
    }
    this._saveState();
    return { count: ids.length };
  }

  restoreAll() {
    const state = this._loadState();
    const restored = state.deleted.length;
    state.deleted = [];
    this._saveState();
    return { restored };
  }

  // =========================================================================
  // Queue / scheduler
  // =========================================================================
  //
  // Round-robin across enabled decks. Within each deck, pick a random unseen
  // quote; reset that deck's seen-list once everyone in it has been shown.
  //
  // Round-robin pointer is persisted, so toggling decks on/off doesn't reset
  // the rotation order.

  nextForQueue() {
    const decks = this._loadDecks();
    const state = this._loadState();
    const favSet = new Set(state.favorites);
    const delSet = new Set(state.deleted);

    // Build the ordered list of enabled deck ids in the same order listDecks() returns
    const enabled = this.listDecks().filter(d => d.enabled && d.count > 0).map(d => d.id);
    if (enabled.length === 0) return null;

    // Advance round-robin pointer modulo enabled list length
    const idx = state.roundRobinIdx % enabled.length;
    const deckId = enabled[idx];
    state.roundRobinIdx = (idx + 1) % enabled.length;

    const deck = decks.get(deckId);
    const livePool = deck.quotes.filter(q => !delSet.has(q.id));
    if (livePool.length === 0) {
      this._saveState();
      // Try the next deck recursively, but cap the recursion to enabled.length
      // to avoid infinite loop if all enabled decks happen to be empty after filtering.
      return this._nextWithFallback(enabled.length - 1);
    }

    if (!Array.isArray(state.deckSeen[deckId])) state.deckSeen[deckId] = [];
    const seen = new Set(state.deckSeen[deckId]);
    let unseen = livePool.filter(q => !seen.has(q.id));
    if (unseen.length === 0) {
      state.deckSeen[deckId] = [];
      unseen = livePool;
    }
    const pick = unseen[Math.floor(Math.random() * unseen.length)];
    state.deckSeen[deckId].push(pick.id);
    this._saveState();

    return {
      ...pick,
      deckId,
      deckName: deck.name,
      isFavorite: favSet.has(pick.id),
    };
  }

  _nextWithFallback(remainingTries) {
    if (remainingTries <= 0) return null;
    return this.nextForQueue();
  }
}

// ----- Helpers -----

function normalizeQuote(q) {
  const text   = String(q.text).trim();
  const source = q.source ? String(q.source).trim() : '';
  const tags   = Array.isArray(q.tags)
    ? q.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
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
  return crypto.createHash('sha1')
    .update(dedupeKey({ text, source }))
    .digest('hex')
    .slice(0, 12);
}

function sanitizeDeckId(name) {
  return String(name || 'deck')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'deck';
}

function writeAtomic(filepath, contents) {
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filepath);
}

module.exports = { DeckStore, CAPS };
