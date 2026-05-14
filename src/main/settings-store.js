// Settings store. Reads/writes data/settings.json atomically.
// Returns sensible defaults if the file doesn't exist or is malformed.

const fs   = require('fs');
const path = require('path');

const DEFAULTS = {
  intervalMin:  30,                  // 30 min between popups
  quietEnabled: true,                // quiet hours on by default
  quietFrom:    '22:00',
  quietTo:      '07:00',
  fontSize:     60,
  fontColor:    '#3D342B',
  opacity:      100,
  revealMode:        'all',          // 'all' | 'word'
  revealDurationMs:  7000,
  revealDelayMs:     1000,           // quiet moment before the reveal animation starts
  wordSpeedMs:       1200,           // per-word fade time when revealMode = 'word'
  position:          'center',       // top-left | top-center | top-right | center | bottom-left | bottom-center | bottom-right
  autoStart:         true,           // launch with Windows by default; user can disable in Settings
  showOnLaunch:      true,           // show a popup immediately when the app starts; user can disable in Settings
};

class SettingsStore {
  constructor(dataDir) {
    this.path = path.join(dataDir, 'settings.json');
    this._cache = null;
  }

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = fs.readFileSync(this.path, 'utf8');
      this._cache = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this._cache = { ...DEFAULTS };
    }
    return this._cache;
  }

  save(partial) {
    const next = { ...this.load(), ...partial };
    this._cache = next;
    writeAtomic(this.path, JSON.stringify(next, null, 2));
    return next;
  }

  get(key) { return this.load()[key]; }

  intervalMs() { return this.load().intervalMin * 60 * 1000; }

  // Returns true if `now` is inside the quiet-hours window.
  isInQuietHours(now = new Date()) {
    const s = this.load();
    if (!s.quietEnabled) return false;
    if (s.quietFrom === s.quietTo) return false;
    const cur  = now.getHours() * 60 + now.getMinutes();
    const from = toMinutes(s.quietFrom);
    const to   = toMinutes(s.quietTo);
    if (from < to) return cur >= from && cur < to;     // same-day window (e.g. 13:00-15:00)
    return cur >= from || cur < to;                    // wraps midnight (e.g. 22:00-07:00)
  }

  // ms from `now` until quiet hours END. Only meaningful when currently in quiet hours.
  msUntilQuietEnd(now = new Date()) {
    const s = this.load();
    const cur = now.getHours() * 60 + now.getMinutes();
    const to  = toMinutes(s.quietTo);
    let mins;
    if (cur < to) mins = to - cur;
    else          mins = (24 * 60 - cur) + to;
    return mins * 60 * 1000 - now.getSeconds() * 1000;
  }
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(n => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function writeAtomic(filepath, contents) {
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filepath);
}

module.exports = { SettingsStore };
