# AGENTS.md — Tinyflux

A Manifest V3 browser extension for [Miniflux](https://miniflux.app).

## Dev commands

| Command | Description |
|---|---|
| `npm ci` | Install dependencies (requires `--allow-scripts` for esbuild/sharp native binaries) |
| `npm run build` | Full production build → `dist/` |
| `npm run watch -- --dev` | Watch mode with inline sourcemaps, no minification |
| `npm run format` | Prettier over `src/` and `package.json` |
| `npm run lint` | ESLint (`@eslint/js` recommended config) with `--fix` |
| `npm run test` | Run tests via Node native `node:test` (no external framework) |

Tests use `node:test` with a minimal `expect` polyfill at `src/test/setup.js`. Test fixtures live in `src/test/fixtures/`. Because `common.js` imports `webextension-polyfill` (which throws outside a browser), tests that need its functions must inline them.

## Build system (custom, not a framework)

The build is a custom Node script at `src/build/index.js` using **esbuild** (JS bundling), **sharp** (icon rasterization), and **adm-zip** (packing). It is **not** webpack, vite, or rollup.

Build pipeline:
1. **Manifests** — `src/manifests/common.json` is shallow-merged with `chromium.json` or `firefox.json`. Placeholders `#name#`, `#description#`, `#version#` are replaced from `package.json`.
2. **Locales** — `src/locales/{lang}.json` → `_locales/{lang}/messages.json` (WebExtensions i18n format).
3. **Icons** — `src/pages/assets/icon-{light,dark}.svg` → PNGs at 16/32/48/196 px via sharp, plus Apple-touch variants.
4. **JS** — `background.js` (bundled standalone), `popup.js` + `options.js` (bundled with code splitting).
5. **HTML/CSS** — copied verbatim.
6. **Pack** — produces `dist/tinyflux.{version}.crx` and `dist/tinyflux.{version}.xpi`, plus unpacked `dist/chromium/` and `dist/firefox/` directories.

## Extension architecture

- `"type": "module"` — all source is ESM.
- `webextension-polyfill` is used for cross-browser API compatibility.
- `dompurify` sanitizes article content before rendering.

**Platform divergence:**
| Feature | Chromium | Firefox |
|---|---|---|
| Background | `service_worker` (MV3) | `scripts` array (legacy) |
| Sidebar | `side_panel` API | `sidebar_action` API |
| Fixed ID | — | `{12c2801b-5b88-529c-92bc-3b7a0e3e1ead}` in `manifests/firefox.json` |

**Source layout:**
- `src/pages/popup.js` — popup/sidebar UI (the main reading view, ~780 lines).
- `src/pages/options.js` — settings page (Miniflux endpoint + token configuration).
- `src/pages/background.js` — service worker (sync, alarms, badge updates).
- `src/pages/common.js` — shared utilities (API helpers, event bus).
- `src/pages/icons.js` — inline SVG icon helpers.
- `src/pages/localize.js` — i18n bootstrapping.
- `src/pages/timeago.js` — relative time formatting.

## Loading for development

- **Chromium**: `chrome://extensions` → Developer mode → Load unpacked → `dist/chromium`
- **Firefox**: `about:debugging` → Load Temporary Add-on → `dist/tinyflux.*.xpi`

## After making code changes

After modifying source files, run in this order:
1. `npm run lint` — ESLint with `--fix`
2. `npm run format` — Prettier over `src/` and `package.json`
3. `npm run test` — verify tests pass
4. `npm run build` — verify build succeeds

## Other

- `assets/` is tracked with **Git LFS** (`.gitattributes`).
- `dist/` is gitignored; always regenerate with `npm run build`.
- No CI workflows, no pre-commit hooks, no formatter config files (prettier uses defaults).
