---
name: release
description: Cuts a new Tinyflux release — checks for dependency updates (asking the user), bumps the version, verifies the project, writes the release commit with a plain-language changelog, and tags it. Use when the user asks to release, cut, or publish a new version (e.g. "prepara la release 0.13.0").
---

# Tinyflux release

Prepares a release commit and tag on the `next` branch. **Never pushes** — the user pushes manually at the end.

## 1. Pre-checks

- Working tree must be clean (`git status --porcelain`) and the current branch must be `next`. If there are uncommitted changes, stop and tell the user.
- Find the last release: `git tag --sort=-v:refname | head -1` (tags are lightweight, e.g. `v0.12.0`).
- List what will be released: `git log --oneline <last-tag>..HEAD`. If it is empty, stop and tell the user there is nothing to release.
- Decide the new version if the user did not give one: any `feat` commit since the last tag means a **minor** bump, otherwise a **patch** bump. If unsure, ask the user.

## 2. Dependency updates

Check for available dependency upgrades:

```
npx ncu -u
```

- If nothing is available, skip this step.
- Otherwise, ask the user whether they want to update the dependencies now.
- If the user declines, continue without updating (and omit the dependencies bullet from the changelog).
- If the user agrees:
  1. Run `npm install` to apply the new versions and update `package-lock.json`.
  2. If the lockfile version of a package listed in `allowScripts` in `package.json` changed, update the pin to stay in sync.
  3. Verify: `npm run format`, `npm run lint`, `npm test`, `npm run build`. All must pass.
  4. Commit with the repo's convention, listing the updated packages, e.g. `chore(deps): upgrade dompurify, htmlnano, sharp, svgo` (same GPG fallback and standalone-command rule as the release commit below).

## 3. Draft the changelog

Read the commits since the last tag — including any dependency-upgrade commit made in the previous step — and group them into a short bullet list for the release commit. Audience: informed users who are not programmers.

- Lead with user-visible features, then improvements, then "Upgraded internal dependencies" as a catch-all (only when dependencies were actually updated).
- Plain language, no internals (no module names, no test counts, no tooling details).
- Keep it to roughly 5–10 bullets.

## 4. Bump the version and verify

```bash
npm ci
npm version X.Y.Z --no-git-tag-version
npm run format
npm run lint
npm test
npm run build
```

All four steps must pass. The build must produce `dist/tinyflux.X_Y_Z.crx` and `dist/tinyflux.X_Y_Z.xpi` (dots in the version become underscores).

## 5. Commit and tag

Stage only the two files the bump touched:

```bash
git add package.json package-lock.json
git commit -m "next release X.Y.Z

Changelog:
- ..."
```

- Subject is exactly `next release X.Y.Z`, then a blank line, then `Changelog:` with the bullets.
- Run `git commit` normally first (GPG signing). If it fails with a GPG or pinentry error, retry once with `git commit --no-gpg-sign`.
- Run the commit as a standalone command so its exit status is visible. Do not chain it with pipes (`| tail`), `&&`, or `||` — a pipe to `tail` makes the chain report success even when the commit failed, and the fallback never triggers.
- Tag the commit with a lightweight tag: `git tag vX.Y.Z`.

## 6. Report

Summarize the commit hash, tag, and verification results, and give the user the push command without running it:

```
git push origin next vX.Y.Z
```
