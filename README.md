# Scripture Quotes

Transparent, always-on-top scripture and inspirational quote popups for Windows 11.
Verses fade in over the screen at a configurable interval, designed to keep
scripture in your day without breaking your focus.

Built with Electron + vanilla JS + JSON storage. Warm off-white / brown / gold
design language to feel like an illuminated manuscript, not a notification.

## Install from GitHub

Requires [Node.js](https://nodejs.org/) (v18 or later) and [Git](https://git-scm.com/).

```powershell
# Clone the repo
cd C:\Users\$env:USERNAME\Code        # or wherever you keep code
git clone https://github.com/johntsunami/Scripture-Quotes-app.git
cd Scripture-Quotes-app

# Install + run
powershell -ExecutionPolicy Bypass -File .\setup.ps1
npm start
```

To pull future updates:

If you have a new `quotes.zip` from a fresh build, the smart update script
handles everything — stops the running app, extracts files, preserves your
`data/` and `.git/`, runs setup, and offers to commit + push:

```powershell
cd C:\Users\$env:USERNAME\Code\Scripture-Quotes-app
powershell -ExecutionPolicy Bypass -File .\scripts\update-from-zip.ps1
```

If you'd rather pull from GitHub directly:

```powershell
cd C:\Users\$env:USERNAME\Code\Scripture-Quotes-app
git pull
npm install                # only if package.json changed
npm start
```

Your personal data in `data/` (favorites, settings, user-created decks)
is gitignored and stays on your machine across updates.

## Quick start (already installed)

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
npm run popup-preview      # one-shot popup, dismiss to exit
npm start                  # normal run with tray icon and scheduler
```

## Project layout

```
quotes/
├─ src/
│  ├─ main/
│  │  ├─ main.js                  # Electron main process; window factory, IPC, lifecycle, scheduler, tray
│  │  ├─ settings-store.js        # settings.json with atomic writes
│  │  └─ deck-store.js            # multi-deck storage, round-robin queue, caps enforcement
│  ├─ renderer/
│  │  ├─ popup/                   # transparent always-on-top quote popup
│  │  │  ├─ popup.html
│  │  │  ├─ popup.css             # dual-shadow readability recipe
│  │  │  └─ popup.js              # IPC bridge, fade/word-reveal animations
│  │  └─ settings/                # settings + decks + library tab UI
│  │     ├─ settings.html
│  │     ├─ settings.css
│  │     └─ settings.js
│  └─ shared/
│     └─ tokens.css               # design tokens — palette, fonts, dual-shadow rule
├─ assets/
│  ├─ tray-icon.png / .svg        # gold illuminated-Q in the system tray
│  └─ decks/                      # built-in shipped decks (read-only source)
│     └─ bible-kjv-essentials.json  # 436 KJV verses, public domain
├─ data/                          # gitignored
│  ├─ decks/                      # per-deck JSON files (copies of shipped + user-created)
│  ├─ state.json                  # favorites, deletions, per-deck rotation pointers
│  └─ settings.json               # user preferences
├─ scripts/
│  └─ build_bible_kjv_deck.py     # rebuilds the Bible deck; extend by editing VERSES list
├─ setup.ps1                      # one-liner bootstrap
└─ package.json
```

## Decks (v0.6.0)

Quotes are organized into **decks** — each one a separate JSON file in `data/decks/`.

- **Built-in decks** ship in `assets/decks/` and are copied to `data/decks/` on first launch. You can disable them in Settings but can't rename, delete, or import into them. Restoring is automatic: delete the file in `data/decks/` and restart the app.
- **User decks** are anything you create through the import flow or the "+ New empty deck" button. Fully editable.
- **Rotation**: when multiple decks are enabled, popups round-robin through them. Each deck tracks its own seen-queue, so toggling one on/off doesn't reset progress in another.
- **Caps**: 20 decks max, 5,000 quotes per deck, 50,000 quotes total, 500 chars per quote. All soft caps with friendly error messages.

## Default seed pack

The Bible deck ships with **436 hand-curated KJV verses** spanning all 66 books, with heavy representation from Psalms, Proverbs, the Gospels, and Paul's epistles. KJV is in the public domain worldwide.

To extend toward 1,000: edit `scripts/build_bible_kjv_deck.py` (append to the `VERSES` list) and rerun `python3 scripts/build_bible_kjv_deck.py`. Or use the in-app AI prompt flow — pick a topic like "Psalm 119 verses" or "verses on perseverance from Hebrews", paste the AI's JSON back into the app, and they import into a new deck of your choice.

## Milestones

- [x] **M1 — Popup proof.** Transparent frameless always-on-top window, slow fade-in
      (12s), dual-shadow text, three buttons + always-visible close X, keyboard
      shortcuts, preview flag.
- [x] **M2 — Data & queue.** `QuoteStore` reads/writes `data/quotes.json` atomically,
      `nextForQueue()` rotates through all quotes once before repeating, favorites filter,
      delete is soft (moved to `deleted[]` in state.json, recoverable from the UI).
- [x] **M3 — Scheduler & tray.** Tray icon (illuminated-manuscript Q) with right-click
      menu (Show Now / Pause / Settings / Quit), scheduler reads interval from settings,
      quiet hours defer popups until end-of-quiet-window, single-instance lock.
- [x] **M3+ — Settings + Quotes manager UI.** Tabbed window: interval, quiet hours,
      font size, opacity, per-category filters; Quotes tab with paste-JSON import (dedupe,
      validation, error reporting), searchable/filterable library, favorite + delete from list.
- [ ] **M4 — Railway sync.** iPhone access to the same library + favorites via the
      same backend pattern as Task Assistant.
- [ ] **Phase 2 — Deck mode.** Same popup infrastructure repurposed for NCLEX-style
      multiple-choice review. Each "deck" is a JSON file under `data/decks/`; the
      popup gets a `mode: 'quote' | 'mcq'` discriminator on the IPC payload.

## Adding quotes

Open the app, right-click the **Q** in the system tray, choose **Open settings**, then go
to the **Quotes** tab and paste a JSON array into the import box. The format is documented
inline and in `AI_PROMPT_TEMPLATE.md` — use that template when asking an AI to generate
batches of quotes for you.

## Tray icon

The cream-and-gold **Q** in your system tray (bottom-right of the Windows taskbar) is the
app's home. Left-click opens settings. Right-click for the menu:

- **Show quote now** — fires a popup immediately, doesn't reset the interval
- **Pause / Resume quotes** — stops the scheduler until you flip it back on
- **Open settings…** — same as left-click
- **Quit Quotes** — closes the app entirely (the tray icon vanishes)

## Timer lifecycle (important)

The next-popup interval **does not advance while a popup is visible**. When a popup
closes, the wait-for-next-popup clock starts from that moment — not from when the
previous popup opened. This is deliberate: you should never get a new verse on top
of one you're still reading, and the spacing you set in Settings is the spacing
between *finishing reading* one quote and seeing the next, which matches how the
contemplative pacing actually feels in use.

See `Scheduler` in `src/main/main.js`. The rule is enforced by hooking the popup
window's `ready-to-show` and `closed` events; M3 just provides the timer value
and tray controls. The rule itself does not need to change.

## Queue persistence

The queue remembers which quotes you've already seen across app restarts,
computer shutdowns, and reboots. If you have 500 quotes and you've seen 173 of
them when you shut down your PC, then the next day when you boot up, the app
picks the 174th from the remaining 327 — not a random repeat from yesterday.

When you've seen every quote in your enabled categories once, the seen list
clears and the rotation starts over. Soft-deleting a quote also removes it
from the seen list so it never blocks rotation completion. The "X seen this
rotation" stat in the Quotes tab shows your current progress.

Storage:
- `data/state.json` — `queue.seen` array of quote ids you've been shown
- `data/quotes.json` — your quote library
- `data/settings.json` — your interval, position, appearance, quiet hours

All three are written atomically (write-temp + rename) so a crash mid-write
can never corrupt them.

## Popup interactions

| Action                         | Effect            |
|--------------------------------|-------------------|
| `Esc`                          | Dismiss           |
| `F`                            | Toggle favorite   |
| `Shift+Delete`                 | Delete forever    |
| **Double-click** anywhere      | Dismiss           |
| Hover, then click the `×`      | Dismiss (the X only appears on hover) |

## Design tokens

All colors, fonts, and the dual text-shadow live in `src/shared/tokens.css`.
The shadow is six layers stacked — three white, three black — tuned to keep
~24pt serif text readable on black, white, photographic, and gradient backgrounds.
Don't change it without testing against all four.

## Why nodeIntegration is on

To match the Task Assistant pattern: vanilla JS, no preload bundling overhead,
`require('electron')` directly in the renderer. The popup window never loads
remote content, so the usual sandbox argument doesn't apply here. If you ever
want to load remote HTML inside this app, flip `contextIsolation` on first.
