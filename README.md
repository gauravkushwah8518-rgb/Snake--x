# Snake X — Arcade Edition

A modern **Snake game** with a clean flat 2D board — vanilla JavaScript, zero dependencies, full PWA support (installable + offline).

![version](https://img.shields.io/badge/version-2.1.3-emerald)

## Features

- 🎯 **Clean 2D checkerboard board** — rounded snake with a glowing head, glossy apple, neon rim
- 🌌 **Animated starfield background** — subtle twinkling stars keep the game alive
- ⚡ **Power-ups** — Speed, Slow, Shield (saves you once), Magnet (pulls food toward you)
- 📈 **Levels** — every 100 points the snake gets faster
- 🎨 **7 snake skins** unlocked by your best score
- 🏆 **Top-10 high scores** (saved locally)
- ⚙️ **Settings** — sound, wall collision (or wrap-around), difficulty, on-screen keys toggle
- 🔊 **Synthesized sound** via WebAudio — no audio files to download
- 💥 **Juice** — particle bursts, floating score popups, screen shake, countdown
- 🐍 **Game Over character** — a dead snake with X eyes drops onto the panel
- 🎮 **On-screen D-Pad always available** — works with mouse clicks and touch, toggleable in settings
- 📊 **Colorful HUD scoreboard** — Score (green), Best (gold), Level (cyan)
- 📱 **Mobile ready** — swipe controls + D-Pad, crisp on high-DPI screens
- ⏸️ **Auto-pause** when you switch tabs
- 📴 **PWA** — installable, offline-playable

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | Arrow keys / WASD | Swipe or D-Pad |
| Pause | Space / Esc | Pause button |

The D-Pad below the board works everywhere — click it with the mouse or tap it on mobile.

## Run locally

Any static server works:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (A server is needed for the service worker; opening `index.html` directly disables offline mode.)

## Project structure

```text
Snake-X/
├── index.html        # App shell + screens
├── manifest.json     # PWA manifest
├── sw.js             # Service worker (offline)
└── assets/
    ├── game.js       # The whole game (vanilla JS)
    ├── style.css     # UI styling
    └── icons/        # PWA icons
```

## Deployment

Deploy as a static site to Netlify, GitHub Pages, or any web host — keep `index.html` at the root of the published folder.

## Author

Gaurav Kushwah
