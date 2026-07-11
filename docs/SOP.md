# SOP — Datatable changes flow package-first

The package is the single source of truth for all table mechanics. company-app
(and any future consumer) is a blueprint: it demonstrates needs and holds only
domain configuration (column defs, data fetching, `badgeVariants` maps, token
values). If a consumer needs a table *mechanism* the package lacks, that is a
package change — never app code.

## Trigger test

Package change: rendering, filtering, sorting, grouping, actions, theming/skins,
formatting, keyboard/selection behavior, any CSS the table owns.
App change: which columns exist, where data comes from, domain value→variant
maps, the app's `--dt-*` token values.

## The loop

1. **Capture** — add one line to `LESSONS.md` here the moment a consumer gap is
   noticed, even if not acting on it yet.
2. **Branch** — `feature/<name>` in this repo.
3. **Develop live against the app** — in company-app run `npm run dev:dt`
   (sets `DT_LOCAL=1`, aliasing the package import to `../electron-datatable/src`).
   Package edits hot-reload inside the real app with real data. No pack/install loop.
4. **TDD + gates** in this repo: `npm test`, `npx tsc --noEmit`, `npm run lint`,
   `npm run build`. New behavior lands with tests; theming/CSS claims are proven
   by grepping `dist/styles.css` / `dist/themes/*`.
5. **Version + CHANGELOG** — semver bump (breaking API → minor while 0.x, note
   migration lines in CHANGELOG).
6. **Merge to main and push to GitHub** — `git checkout main && git merge --no-ff
   feature/<name>`, re-run tests on the merge, `git push origin main`.
7. **Publish** — `npm publish --access public`. The npm account uses
   authenticator-app 2FA: publish from a real terminal (OTP prompt), or set up a
   granular automation token in CI. Never leave main unpublished for long.
8. **Embed in the consumer** — in company-app:
   `npm install @delta-and-beta/electron-datatable@^<version>`, then gates
   (`npm rebuild better-sqlite3` → `npx tsc --noEmit` → `npm test`, then rebuild
   better-sqlite3 for Electron per its CLAUDE.md), commit package.json+lockfile.
9. **Verify visually** — restart/reload the dev app; eyeball the touched surfaces.

## Hard rules

- No `file:`/tarball dependencies on a consumer's main except as a same-day
  interim while a publish is blocked; the publish + `^x.y.z` swap closes it.
- Never edit `node_modules/@delta-and-beta/electron-datatable` in a consumer.
- Never duplicate a package mechanism in a consumer "just for now".
- Token semantics are documented in README "Theming" — map by meaning
  (foreground vs background), never by eyeballing names.
