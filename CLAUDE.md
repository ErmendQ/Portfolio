# Project notes

## Visual reference
`assets/reference-ios26-glass.png` — Erik's iOS 26 home screen. The canonical reference
for this portfolio's look: liquid-glass surfaces (heavy blur, low-opacity fills, bright
1px inner highlight on the top edge, soft outer shadow), generously rounded corners, pine
green + grey against a dark leafy backdrop. Keep new surfaces consistent with it.

## How the site is built
Static files on GitHub Pages (erikthomas.dev), no build step, no dependencies.
- `index.html` is the page shell. `i.html` is the same shell with `data-all` on `<html>`:
  it also shows the projects marked `unlisted: true` in the data. Keep the two identical otherwise.
- `site/data.js` holds all content (English, plus Hungarian keyed by the English string).
  `site/app.js` is the behaviour, `site/app.css` the styles.
- Media: originals go in `assets/`; `py tools/optimize-media.py` builds the web copies in
  `assets/web/` (and the wallpaper crops, `wall-*.webp`, from `assets/backdrop.jpg`).
- Preview locally with `py tools/serve.py` (http://127.0.0.1:8790). Plain `http.server`
  has no Range support, so clips would not seek.
- Routes are hashes (`#inventory/<project>`). A project opens as `<dialog class="page">`
  layered over the menu; the menu underneath is never re-rendered.
- Glass budget: only the menu shell, the phone dock and the floating page buttons run a
  real `backdrop-filter`. Everything on top of glass is a translucent plate, and phones
  use the pre-blurred `wall-*-frost.webp` twin instead of a live blur. Keep it that way.
- Functional text never goes below 11px.
- `support.js` only serves the two `.dc.html` design files; the site does not load it.

## Owner
Erik Thomas — game designer / gameplay programmer, Budapest, HU.
