# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Run with ts-node (development)
npm run build        # Clean, compile TypeScript, copy EJS/static assets to dist/
npm start            # Build then run dist/index.js
npx eslint src/      # Lint TypeScript sources
npx tsc --noEmit     # Type-check without emitting
```

No test suite exists. Verify changes by running the dev server and exercising the affected route manually.

## Architecture

CMS-Loader is an Express 5 + TypeScript server that acts as a web UI for batch-loading users and contest participations into a [CMS](https://cms-dev.github.io/) installation via its CLI tools (`cmsAddUser`, `cmsAddParticipation`).

**Request flow for the two main workflows:**

1. **Upload CSV** → `POST /analyzeCSV` — parses the file with `csv/sync`, stores records and column names in session, returns the column list as JSON so the browser can let the user map CSV columns to CMS fields.
2. **Column mapping form submit** → `POST /registerUsers` or `POST /addParticipation` — reads session records, maps each row to CLI arguments using `shell-escape` for safety, and shells out via `child_process.exec`. Returns a CSV of errors (or generated passwords for `registerUsers`).

**Key architectural decisions:**
- Session (`express-session`) is the only state store — no database. If the session is missing when a processing route is hit, the server redirects to the upload page.
- `src/index.ts` promisifies `session.save` and attaches it as `req.session.saveAsync` so async handlers can await session persistence before responding.
- `NODE_ENV=production` toggles secure cookies, `sameSite: "none"`, and trust-proxy settings — this matters for deployment behind a reverse proxy.
- EJS views live in `src/views/` and are copied to `dist/views/` during build by `copy-files`. Static HTML/CSS/JS lives in `src/public/` (not tracked here) and is served at `/public` and `/`.

**Controller pattern:** each controller is a file that creates a `Router`, registers its routes, and `export default router`. Add new endpoints by following this pattern and mounting them in `src/router.ts`.

## Pitfalls

- `shellescape` is used intentionally to prevent shell injection when building `cmsAddUser`/`cmsAddParticipation` CLI calls. Do not bypass it.
- The `replace(/'""'/g, '""')` applied after `shellescape` is intentional — it unquotes empty string arguments that CMS CLI expects as bare `""`.
- `multer` temp files are deleted in the `finally` block of `analyzeCSV`; ensure any refactor preserves this cleanup.
- CSV column union (not intersection) is computed across all rows so that sparse CSVs show all possible columns to the user.
