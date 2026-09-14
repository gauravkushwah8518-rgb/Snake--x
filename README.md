# Snake X — Arcade Edition

Snake X is a modern arcade-style Snake game with a responsive interface, power-ups, levels, custom skins, high scores, pause/restart controls, touch gestures, mobile controls, and Progressive Web App support.

## Features

- Classic Snake gameplay
- Keyboard controls with Arrow keys and WASD
- Mobile D-Pad controls
- Swipe controls on touch devices
- Multiple power-ups
- Levels and increasing difficulty
- High-score support
- Custom snake skins
- Pause and restart controls
- Responsive desktop and mobile layout
- PWA support for installable and offline-friendly gameplay

## Controls

### Desktop
- Arrow keys or WASD — Move
- Space — Pause/Resume or restart after Game Over

### Mobile
- Use the on-screen D-Pad
- Swipe on the game board to move

## Project Structure

```text
Snake-X/
├── index.html
├── manifest.json
├── sw.js
└── assets/
    ├── index-Bla-lisd.js
    ├── index-Bs1E1E8D.css
    ├── manifest-B1N52TTr.json
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

## Run Locally

Because this project uses PWA features, run it through a local web server instead of opening `index.html` directly.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Deployment

The project can be deployed as a static website on services such as Netlify or GitHub Pages. Upload the project files with `index.html` at the root of the published folder.

## Author

Gaurav Kushwah
# Snake--x
