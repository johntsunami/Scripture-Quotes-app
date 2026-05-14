// Quotes — main process.
//
// Milestones:
//   [x] M1  Transparent fade-in popup with always-on-top + close X
//   [x] M2  Real JSON storage: QuoteStore + SettingsStore (atomic writes, dedupe, soft delete)
//   [x] M3  Tray icon (illuminated-manuscript Q), right-click menu, scheduler driven by settings,
//           quiet hours, favorites filter, category filter
//   [x] M3+ Settings + Quotes Manager window (tabs)
//   [ ] M4  Railway sync + Phase-2 NCLEX deck mode

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

const { SettingsStore } = require('./settings-store');
const { DeckStore, CAPS } = require('./deck-store');

// ----- Single-instance lock --------------------------------------------------
// Without this, double-clicking the Q icon in tray (or relaunching from a
// shortcut) would spawn a second main process, second tray icon, and a second
// scheduler that races the first. The second instance immediately quits and
// signals the first one to surface the settings window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => openSettingsWindow());

// ----- Paths -----------------------------------------------------------------
// Project root (one level up from src/main). When packaged, this resolves to
// the resources dir, which is what we want for the bundled tray icon and
// renderer HTML; the data/ directory will move to user-data in M4.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR     = path.join(PROJECT_ROOT, 'data');
const ASSETS_DIR   = path.join(PROJECT_ROOT, 'assets');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ----- Args ------------------------------------------------------------------
const IS_PREVIEW = process.argv.includes('--preview-popup');
const IS_DEV     = process.argv.includes('--dev');

// ----- Stores ----------------------------------------------------------------
const settingsStore = new SettingsStore(DATA_DIR);
const deckStore     = new DeckStore(DATA_DIR, path.join(ASSETS_DIR, 'decks'));

// ----- Position helper -------------------------------------------------------
// Translates a settings position string ('top-left', 'center', etc.) into
// pixel x/y coordinates for the popup window, with a comfortable margin
// from the edges of the work area so popups don't kiss the taskbar.
function positionForCorner(corner, workArea, width, height) {
  const MARGIN = 40;
  const { x: ax, y: ay, width: aw, height: ah } = workArea;

  // Horizontal anchor
  let x;
  if (corner.includes('left'))       x = ax + MARGIN;
  else if (corner.includes('right')) x = ax + aw - width - MARGIN;
  else                                x = ax + Math.round((aw - width) / 2);

  // Vertical anchor
  let y;
  if (corner.startsWith('top'))         y = ay + MARGIN;
  else if (corner.startsWith('bottom')) y = ay + ah - height - MARGIN;
  else                                   y = ay + Math.round((ah - height) / 2);

  return { x: Math.round(x), y: Math.round(y) };
}

// ----- Auto-start with Windows ------------------------------------------------
// Toggles the registry entry under HKCU\...\Run via Electron's API. On
// Windows, app.setLoginItemSettings adds/removes the entry cleanly. In
// development mode (no packaged .exe), the entry will point at electron.exe
// with the project path; this works but may flash a console on boot. The
// cleanest experience comes once the app is packaged via electron-builder.
function applyAutoStart(enabled) {
  // macOS/Linux paths are no-ops here; this is a Windows app.
  if (process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      // Start minimized to tray (no popup window on boot). The on-launch
      // popup is handled separately by the showOnLaunch logic below.
      args: ['--hidden'],
    });
  } catch (e) {
    console.error('Failed to update auto-start setting:', e);
  }
}

// ----- Windows + tray --------------------------------------------------------
/** @type {BrowserWindow | null} */ let popupWindow    = null;
/** @type {BrowserWindow | null} */ let settingsWindow = null;
/** @type {Tray          | null} */ let tray           = null;

// =============================================================================
// SCHEDULER
// =============================================================================
//
// Lifecycle rule (unchanged from M1):
//   - Timer is PAUSED while a popup is on screen.
//   - When the popup closes, the wait until next popup starts FROM THAT MOMENT.
//   - If quiet hours are active when the timer would fire, defer until end of
//     quiet hours instead of `now + intervalMs`.
//   - Pause from tray menu freezes the timer entirely.

const Scheduler = {
  isPaused: false,
  _timer:   null,

  start() {
    // First popup goes out after `intervalMs` from app start, NOT immediately,
    // so launching the app doesn't instantly interrupt you.
    this._schedule(settingsStore.intervalMs());
  },

  popupIsOpen() {
    return !!(popupWindow && !popupWindow.isDestroyed());
  },

  notifyPopupOpened() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },

  notifyPopupClosed() {
    if (IS_PREVIEW) return;
    if (this.isPaused) return;
    this._schedule(settingsStore.intervalMs());
  },

  _schedule(ms) {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._fire(), ms);
    refreshTrayTooltip();
  },

  _fire() {
    this._timer = null;

    // Defer through quiet hours
    if (settingsStore.isInQuietHours()) {
      const wait = settingsStore.msUntilQuietEnd() + 1000;  // +1s safety
      this._schedule(wait);
      return;
    }

    showNextQuote();
  },

  pause() {
    this.isPaused = true;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    refreshTrayTooltip();
  },

  resume() {
    this.isPaused = false;
    this._schedule(settingsStore.intervalMs());
  },

  // Settings UI changed interval -> reschedule with new value if no popup is up.
  onSettingsChanged() {
    if (this.isPaused || this.popupIsOpen() || IS_PREVIEW) return;
    this._schedule(settingsStore.intervalMs());
  },

  msUntilNext() {
    if (this.isPaused) return null;
    if (this.popupIsOpen()) return null;
    // We don't have a high-precision "started at" so this is approximate;
    // good enough for the tooltip.
    return settingsStore.intervalMs();
  },
};

// =============================================================================
// POPUP WINDOW
// =============================================================================
function createPopupWindow(quote) {
  const { workArea } = screen.getPrimaryDisplay();
  const width  = 880;
  const height = 380;
  const settings = settingsStore.load();

  const { x, y } = positionForCorner(
    settings.position || 'center',
    workArea,
    width,
    height,
  );

  const win = new BrowserWindow({
    width, height,
    x, y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Critical: focusable:false means the OS will NOT yank keyboard focus to
    // this window when it opens. Your typing keeps flowing to whatever app
    // you were already using. The trade-off: keyboard shortcuts (Esc/F/Del)
    // won't work until the user clicks on the popup to focus it.
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Pair with focusable:false -- ignores mouse events ONLY when the user
  // hasn't moved their cursor over the popup. The 'forward: true' option
  // lets mouse-enter still flag the window so :hover and clicks work.
  // We DON'T use setIgnoreMouseEvents here -- we want full mouse interactivity
  // (click buttons, hover for X). The combination of focusable:false +
  // showInactive() gives the no-focus-steal behavior without sacrificing
  // mouse interaction.

  win.loadFile(path.join(__dirname, '..', 'renderer', 'popup', 'popup.html'));

  // Stash the quote on the window so 'quote:ready' can send it.
  win._pendingQuote = quote;

  win.once('ready-to-show', () => {
    // showInactive() displays the window WITHOUT bringing it to the
    // foreground or stealing keyboard focus.
    win.showInactive();
    Scheduler.notifyPopupOpened();
  });

  win.on('closed', () => {
    if (popupWindow === win) popupWindow = null;
    Scheduler.notifyPopupClosed();
  });

  if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function showNextQuote() {
  if (Scheduler.popupIsOpen()) return;

  // Round-robin across enabled decks. Disabled decks are skipped automatically.
  const quote = deckStore.nextForQueue();

  if (!quote) {
    // Library is empty (no enabled decks with quotes). Surface settings.
    openSettingsWindow();
    return;
  }

  popupWindow = createPopupWindow(quote);
}

// =============================================================================
// SETTINGS WINDOW
// =============================================================================
function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 920,
    height: 760,
    backgroundColor: '#F8F6F2',
    title: 'Quotes — Settings',
    autoHideMenuBar: true,
    icon: trayIconPath(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
  if (IS_DEV) settingsWindow.webContents.openDevTools({ mode: 'detach' });
}

// =============================================================================
// TRAY ICON
// =============================================================================
function trayIconPath() {
  // The 32x32 PNG is plenty for Windows tray. Hi-DPI displays will pick up @2x
  // automatically when the path matches the convention.
  return path.join(ASSETS_DIR, 'tray-icon.png');
}

function createTray() {
  const img = nativeImage.createFromPath(trayIconPath());
  tray = new Tray(img);
  tray.setToolTip('Quotes');

  rebuildTrayMenu();

  // Left-click opens settings (Windows convention).
  tray.on('click', () => openSettingsWindow());
}

function rebuildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show quote now',
      click: () => showNextQuote(),
    },
    {
      label: Scheduler.isPaused ? 'Resume quotes' : 'Pause quotes',
      click: () => {
        if (Scheduler.isPaused) Scheduler.resume();
        else                    Scheduler.pause();
        rebuildTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Open settings…',
      click: () => openSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit Quotes',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(menu);
}

function refreshTrayTooltip() {
  if (!tray) return;
  if (Scheduler.isPaused) {
    tray.setToolTip('Quotes — paused');
  } else if (Scheduler.popupIsOpen()) {
    tray.setToolTip('Quotes — showing now');
  } else {
    const ms = settingsStore.intervalMs();
    let label;
    if (ms < 60_000) label = `${Math.round(ms / 1000)} sec`;
    else             label = `${Math.round(ms / 60_000)} min`;
    tray.setToolTip(`Quotes — next in ~${label}`);
  }
}

// =============================================================================
// IPC
// =============================================================================

// Popup -> main
ipcMain.on('quote:ready', (evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  const q = win && win._pendingQuote;
  if (!q) return;
  const s = settingsStore.load();
  evt.sender.send('quote:show', {
    ...q,
    // Appearance + animation settings travel with the quote, so the popup
    // doesn't need its own IPC roundtrip to fetch them on every show.
    fontSize:         s.fontSize,
    fontColor:        s.fontColor,
    opacity:          s.opacity,
    revealMode:       s.revealMode,
    revealDurationMs: s.revealDurationMs,
    revealDelayMs:    s.revealDelayMs,
    wordSpeedMs:      s.wordSpeedMs,
  });
});

ipcMain.on('quote:action', (_evt, { id, action }) => {
  if (action === 'favorite' || action === 'unfavorite') {
    deckStore.toggleFavorite(id);
    return; // popup stays open
  }
  if (action === 'delete') {
    deckStore.softDelete(id);
  }
  // dismiss + delete both close the popup
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close();
  if (IS_PREVIEW) app.quit();
});

// Settings window -> main
ipcMain.handle('settings:load', () => {
  const s = settingsStore.load();
  return {
    ...s,
    decks: deckStore.listDecks(),   // for the Decks section UI
  };
});

ipcMain.handle('settings:save', (_evt, payload) => {
  const next = {
    intervalMin:      payload.intervalMin,
    quietEnabled:     payload.quietEnabled,
    quietFrom:        payload.quietFrom,
    quietTo:          payload.quietTo,
    fontSize:         payload.fontSize,
    fontColor:        payload.fontColor,
    opacity:          payload.opacity,
    revealMode:       payload.revealMode,
    revealDurationMs: payload.revealDurationMs,
    revealDelayMs:    payload.revealDelayMs,
    wordSpeedMs:      payload.wordSpeedMs,
    position:         payload.position,
    autoStart:        payload.autoStart,
    showOnLaunch:     payload.showOnLaunch,
  };
  settingsStore.save(next);

  // Apply system-level side-effects of certain settings.
  applyAutoStart(next.autoStart);

  // Deck enable/disable goes through deckStore, not settings.
  (payload.decks || []).forEach(d => {
    deckStore.setDeckEnabled(d.id, d.enabled);
  });

  Scheduler.onSettingsChanged();
  refreshTrayTooltip();
  return { ok: true };
});

// ----- Deck IPC -----
ipcMain.handle('decks:list',         () => deckStore.listDecks());
ipcMain.handle('decks:create',       (_e, { name })       => deckStore.createDeck(name));
ipcMain.handle('decks:rename',       (_e, { id, name })   => deckStore.renameDeck(id, name));
ipcMain.handle('decks:delete',       (_e, { id })         => deckStore.deleteDeck(id));
ipcMain.handle('decks:set-enabled',  (_e, { id, enabled })=> deckStore.setDeckEnabled(id, enabled));

// ----- Quote IPC -----
ipcMain.handle('quotes:list',        (_e, { deckId } = {}) => ({
  quotes: deckStore.listQuotes(deckId || '__all__'),
  decks:  deckStore.listDecks(),
  stats:  deckStore.stats(),
}));
ipcMain.handle('quotes:import',      (_e, { json, deckId, deckName }) =>
  deckStore.importJson(json, deckId, deckName));
ipcMain.handle('quotes:add',         (_e, { deckId, text, source, category, tags }) =>
  deckStore.addQuote(deckId, { text, source, category, tags }));
ipcMain.handle('quotes:toggle-fav',  (_e, { id }) => deckStore.toggleFavorite(id));
ipcMain.handle('quotes:bulk-fav',    (_e, { ids }) => deckStore.bulkFavorite(ids));
ipcMain.handle('quotes:bulk-unfav',  (_e, { ids }) => deckStore.bulkUnfavorite(ids));
ipcMain.handle('quotes:delete',      (_e, { id }) => deckStore.softDelete(id));
ipcMain.handle('quotes:bulk-delete', (_e, { ids }) => deckStore.bulkDelete(ids));
ipcMain.handle('quotes:restore-all', ()           => deckStore.restoreAll());

// =============================================================================
// LIFECYCLE
// =============================================================================
app.whenReady().then(() => {
  if (IS_PREVIEW) {
    // Preview mode: skip tray + scheduler, just show one popup.
    showNextQuote();
    return;
  }

  createTray();
  Scheduler.start();

  // Sync the Windows auto-start registry entry with the saved setting.
  // This makes sure it stays in step with what the user has chosen even
  // after re-installs or external registry edits.
  const s = settingsStore.load();
  applyAutoStart(s.autoStart);

  // Optional: open settings on first launch if the library is empty,
  // so the user has a place to paste their first batch of quotes.
  const stats = deckStore.stats();
  if (stats.total === 0) {
    openSettingsWindow();
    return;  // don't also fire the launch popup; the empty-library state matters more
  }

  // Show a popup right away on app start (unless the user disabled this,
  // or unless we're inside quiet hours — don't startle anyone at 2am).
  // We also skip when the app was auto-launched at Windows login WITH the
  // --hidden flag, so silent boot doesn't immediately throw a popup; the
  // normal scheduled timer will handle the first one in that case.
  const launchedHidden = process.argv.includes('--hidden');
  if (s.showOnLaunch && !launchedHidden && !settingsStore.isInQuietHours()) {
    // Small delay so the tray icon finishes installing first.
    setTimeout(showNextQuote, 1500);
  }
});

app.on('window-all-closed', (e) => {
  // The tray keeps the app alive. Closing all windows is normal usage.
  if (IS_PREVIEW) return;     // preview mode quits on close
  e.preventDefault();
});

app.on('before-quit', () => { app.isQuitting = true; });
