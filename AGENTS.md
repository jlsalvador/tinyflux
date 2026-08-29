# AGENTS.md — Tinyflux

A Manifest V3 browser extension for [Miniflux](https://miniflux.app).

## Dev commands

| Command | Description |
|---|---|
| `npm ci` | Install dependencies (the `allowScripts` field whitelists esbuild/sharp postinstall scripts — keep its version pins in sync with the lockfile) |
| `npm run build` | Full production build → `dist/` |
| `npm run watch` | Watch mode with inline sourcemaps, no minification |
| `npm run format` | Prettier over `src/` and `package.json` |
| `npm run lint` | ESLint (`@eslint/js` recommended config) with `--fix` |
| `npm run test` | Run tests via Node native `node:test` (no external framework) |

Tests use `node:test` with a minimal `expect` polyfill at `src/test/setup.js` (shared by all tests via the `--import` flag in the `test` script). Test files are `*.test.js` modules living **next to the code they cover** (e.g. `src/pages/popup.test.js` tests `src/pages/popup.js`) — they are not collected in a `src/test` directory; `src/test/` only holds `setup.js` and the shared fixtures in `src/test/fixtures/`. `setup.js` pre-defines `globalThis.browser` and `globalThis.chrome` mocks (both with `runtime.id`), so `webextension-polyfill` passes `globalThis.browser` through untouched and test files import `common.js` / `background.js` directly. Override browser APIs and `fetch` per test with node:test's `t.mock.method(obj, "name", impl)` — originals auto-restore at test end, so no manual save/restore, `t.after`, or try/finally is needed.

## Build system (custom, not a framework)

The build is a custom Node script at `src/build/index.js` using **esbuild** (JS bundling), **sharp** (icon rasterization), and **adm-zip** (packing). It is **not** webpack, vite, or rollup.

Build pipeline:
1. **Manifests** — `src/manifests/common.json` is shallow-merged with `chromium.json` or `firefox.json`. Placeholders `#name#`, `#description#`, `#version#` are replaced from `package.json`.
2. **Locales** — `src/locales/{lang}.json` → `_locales/{lang}/messages.json` (WebExtensions i18n format).
3. **Icons** — `src/pages/assets/icon-{light,dark}.svg` → PNGs at 16/32/48/196 px via sharp, plus Apple-touch variants.
4. **JS** — `background.js` (bundled standalone), `popup.js` + `options.js` (bundled with code splitting).
5. **HTML/CSS** — copied verbatim.
6. **Pack** — produces `dist/tinyflux.{version}.crx` and `dist/tinyflux.{version}.xpi` (dots in the version are replaced by underscores, e.g. `dist/tinyflux.0_11_3.crx`), plus unpacked `dist/chromium/` and `dist/firefox/` directories. The intermediate `dist/resources/` directory is removed after packing.

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
- `src/pages/popup.js` — popup/sidebar UI (the main reading view).
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

These four steps (lint, format, test, build) are **required before every `git commit`** — never commit code that has not been linted, formatted, and verified to build.

## Git commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short imperative summary

Optional body explaining why, not what.
```

- **Subject**: `<type>(<scope>): <summary>` in lowercase imperative form, no trailing period (e.g. `fix(options): keep fallback text when i18n messages are missing`). Common types: `feat`, `fix`, `refactor`, `chore`, `docs`.
- **Scope**: the area touched, usually the page/module (e.g. `options`, `popup`, `background`); omit when the change is cross-cutting (e.g. `fix: merge optimistic rollbacks into the latest entries cache`).
- **Body**: optional; separated from the subject by a blank line. Write it in English as one or more short paragraphs explaining the *reason* for the change (motivation, context, trade-offs), not a restatement of the diff. Wrap at ~72 columns.

## Other

- All code comments must be written in English.
- `assets/` is tracked with **Git LFS** (`.gitattributes`).
- `dist/` is gitignored; always regenerate with `npm run build`.
- No CI workflows, no pre-commit hooks, no formatter config files (prettier uses defaults). Commit message conventions are therefore enforced manually — see the [Git commits](#git-commits) section.
