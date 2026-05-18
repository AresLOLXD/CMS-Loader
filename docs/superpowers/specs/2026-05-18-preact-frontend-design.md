# Spec: Preact Frontend Rewrite

**Date:** 2026-05-18
**Status:** Approved (revised 2026-05-18 — single package.json + shared tsconfig)

## Overview

Replace all legacy frontend (static HTML, vanilla JS, EJS views) with a Preact SPA built with Vite. The Express backend stays, but its tooling migrates from `ts-node` to `tsx` so that a single `tsconfig.json` can cover both backend and frontend. Add automated semantic versioning via Husky + semantic-release. Surface the app version in the UI.

## Goals

- Single Preact SPA covering login, CSV upload, column mapping, and job progress
- Single `package.json` and single `tsconfig.json` for the whole project
- Automated semver versioning tied to Conventional Commits
- App version visible in the UI footer, read from `package.json`
- No changes to any existing Express controller, session, or CSRF logic

## Non-Goals

- Replacing Express (evaluated and rejected)
- Server-side rendering on the frontend
- Adding a database or changing the session store
- Migrating the test suite

---

## Architecture

### Directory Structure

```
CMS-Loader/
├── src/                        # Express backend (mostly unchanged)
├── client/                     # Preact SPA source (new)
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── signals.ts
│       ├── config.ts
│       ├── App.tsx
│       ├── vite-env.d.ts
│       └── components/
│           ├── Login.tsx
│           └── steps/
│               ├── UploadStep.tsx
│               ├── MappingStep.tsx
│               ├── ProcessingStep.tsx
│               └── DoneStep.tsx
├── tsconfig.json               # MODIFIED: shared backend + frontend config
├── vite.config.ts              # NEW: at root, root option points to client/
├── package.json                # MODIFIED: tsx, Preact + Vite deps, new scripts
├── .husky/
│   ├── commit-msg
│   └── pre-push
├── .commitlintrc.json
├── .releaserc.json
└── CHANGELOG.md
```

### Why `tsx` replaces `ts-node`

`ts-node` requires `moduleResolution: "nodenext"` for modern Node.js ESM. Vite requires `moduleResolution: "bundler"`. These are incompatible in a single `tsconfig.json`.

`tsx` (powered by esbuild) supports `moduleResolution: "bundler"` and runs TypeScript directly without a compilation step. This allows one `tsconfig.json` to serve both the backend runtime and the Vite frontend build.

Node.js 24 is in use, so `import.meta.dirname` is available without workarounds.

### Integration with Express

**Development — two processes, one port for the browser:**
- Express via `tsx src/index.ts` on `:9995`
- Vite dev server on `:5173`, proxying all API paths to Express

**Production:**
- `vite build` outputs Preact SPA to `client/dist/`
- Express serves `client/dist/` as static files
- `tsx src/index.ts` runs the server (no compilation step)
- SPA catch-all: any non-API GET returns `client/dist/index.html`

---

## `tsconfig.json` Changes

The current `tsconfig.json` uses `module: "nodenext"` and `moduleResolution: "nodenext"`. It must be updated to:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "allowJs": true
  },
  "include": ["src/**/*", "client/**/*", "vite.config.ts"],
  "exclude": ["src/__tests__", "client/dist"]
}
```

Key changes from current:
- `module`: `"nodenext"` → `"ESNext"`
- `moduleResolution`: `"nodenext"` → `"bundler"`
- Added: `lib`, `jsx`, `jsxImportSource`, `allowImportingTsExtensions`, `isolatedModules`, `moduleDetection`, `noEmit`
- Removed: `outDir`, `sourceMap`
- `include`: adds `"client/**/*"` and `"vite.config.ts"`

---

## `package.json` Changes

```json
{
  "type": "module",
  "scripts": {
    "dev:backend": "tsx src/index.ts",
    "dev:frontend": "vite",
    "dev": "echo 'Run dev:backend and dev:frontend in separate terminals'",
    "build": "vite build",
    "start": "pnpm run build && tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepare": "husky"
  }
}
```

Dependencies added:
- `preact`, `@preact/signals` (runtime deps)
- `vite`, `@preact/preset-vite`, `tsx` (devDeps)
- `husky`, `@commitlint/cli`, `@commitlint/config-conventional` (devDeps)
- `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git` (devDeps)

Dependencies removed:
- `ts-node`, `copyfiles`, `ejs`, `@types/ejs` (if present)

---

## `src/index.ts` Changes

Replace `__dirname` (not available in ESM) with `import.meta.dirname` (Node.js 21.2+):

| Before | After |
|---|---|
| `join(__dirname, "logs")` | `join(import.meta.dirname, "logs")` |
| `app.use("/public", express.static(join(__dirname, "public")))` | removed |
| `app.use("/", express.static(join(__dirname, "public", "html")))` | removed |
| `app.set("views", join(__dirname, "views"))` | removed |
| `app.set('view engine', 'ejs')` | removed |

Added:
```ts
app.use(express.static(join(import.meta.dirname, '../client/dist')))
// ... routes ...
app.get('*', (_req, res) => {
  res.sendFile(join(import.meta.dirname, '../client/dist', 'index.html'))
})
```

---

## `vite.config.ts` (at root)

```ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')
) as { version: string }

export default defineConfig({
  root: 'client',
  plugins: [preact()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:9995',
      '/login': {
        target: 'http://localhost:9995',
        bypass(req) {
          return req.method === 'GET' ? '/index.html' : undefined
        },
      },
      '/logout': 'http://localhost:9995',
      '/analyzeCSV': 'http://localhost:9995',
      '/registerUsers': 'http://localhost:9995',
      '/addParticipation': 'http://localhost:9995',
      '/jobs': 'http://localhost:9995',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

Note: with `root: 'client'`, Vite treats `client/` as the project root. `outDir: 'dist'` is relative to `root`, so output goes to `client/dist/`.

---

## State Management

Global state in `client/src/signals.ts` using Preact Signals.

| Signal | Type | Description |
|---|---|---|
| `authStatus` | `'checking' \| 'authenticated' \| 'unauthenticated'` | Session state on app mount |
| `csrfToken` | `string` | Fetched once after auth, reused across mutating requests |
| `wizardStep` | `'upload' \| 'mapping' \| 'processing' \| 'done'` | Current wizard step |
| `mode` | `'users' \| 'contest'` | Operation mode |
| `columns` | `string[]` | CSV column names from `/analyzeCSV` |
| `mapping` | `Record<string, string>` | Field → CSV column assignments |
| `jobId` | `string \| null` | Job ID from `/registerUsers` or `/addParticipation` |

---

## Component Tree

```
App
├── authStatus = 'checking'        → loading spinner
├── authStatus = 'unauthenticated' → <Login />
└── authStatus = 'authenticated'   → <Wizard />
    ├── wizardStep = 'upload'       → <UploadStep />
    ├── wizardStep = 'mapping'      → <MappingStep />
    ├── wizardStep = 'processing'   → <ProcessingStep />
    └── wizardStep = 'done'         → <DoneStep />
```

Footer (always visible when not checking): `v{VITE_APP_VERSION}`.

---

## Data Flow

### App Mount
1. `GET /api/me` → `{ authenticated: boolean }`
2. `GET /api/csrf-token` → `{ token }` → stored in signal (called regardless of auth state, login needs it too)

### Login
- `POST /login` with `{ username, password }` + `x-csrf-token` header → JSON `{ success: true }`
- Success → re-fetch CSRF token → `authStatus = 'authenticated'`

### UploadStep
- `POST /analyzeCSV` FormData `{ archivo }` → `{ success, data: { columnas: string[] } }`
- Store `columns`, advance to `mapping`

### MappingStep
- `POST /registerUsers` or `/addParticipation` JSON `{ ...mapping }` → `{ jobId }`
- Store `jobId`, advance to `processing`

### ProcessingStep
- `new EventSource('/jobs/${jobId}/events')`
- `progress` → update bar; `done` → download blob → advance to `done`; `job-error` / `onerror` → show error
- `EventSource` closed in `useEffect` cleanup

### CSRF Token Refresh
On 403: re-fetch `/api/csrf-token` and retry once.

---

## New Express Endpoint

**`GET /api/me`** — public (no `requireAuth`)
```
{ authenticated: true }   if req.session.authenticated === true
{ authenticated: false }  otherwise
```

---

## Backend Auth Changes

**`src/router.ts`:** Remove `requireAuth` from `GET /api/csrf-token`; add `GET /api/me` before the auth wall; remove `ViewsController` import and mount.

**`src/controllers/auth.ts`:** Remove `GET /` (EJS login page); change `POST /` to return `{ success: true }` JSON on success and `{ success: false, message }` 401 JSON on failure; `GET /logout` redirects to `/`.

**`src/middleware/requireAuth.ts`:** Return 401 JSON for requests that `Accept: application/json`; redirect to `/login` for browser navigations.

---

## Files Removed

- `src/public/html/` — all HTML files
- `src/public/js/` — all JS files
- `src/views/seleccionaColumnasUser.ejs`
- `src/views/seleccionaColumnasConcurso.ejs`
- `src/views/login.ejs`
- `src/controllers/views.ts`

---

## Automated Versioning

| Tool | Purpose |
|---|---|
| `husky` | Git hooks |
| `@commitlint/cli` + `@commitlint/config-conventional` | Validates Conventional Commits format |
| `semantic-release` | Bumps version, generates CHANGELOG, creates git tag |
| `@semantic-release/changelog` | Writes `CHANGELOG.md` |
| `@semantic-release/git` | Commits `package.json` + `CHANGELOG.md` |

**`commit-msg` hook:** validates format with commitlint.
**`pre-push` hook:** runs `semantic-release --no-ci`. If no releasable commits, exits 0 and push proceeds normally.

**Version in UI:** `vite.config.ts` reads `version` from `package.json` and exposes it as `import.meta.env.VITE_APP_VERSION`. The footer renders `v{import.meta.env.VITE_APP_VERSION}`.

---

## README Updates

The README must document:
1. Stack — add Preact, Vite, Preact Signals, tsx, semantic-release
2. Setup — single `pnpm install`
3. Development — two-terminal workflow
4. Build — `pnpm run build` (Vite only, no backend compilation)
5. Production — `pnpm start`
6. Versioning — Conventional Commits table, release flow, version in UI

---

## Dependencies Added

Runtime: `preact`, `@preact/signals`

DevDependencies: `vite`, `@preact/preset-vite`, `tsx`, `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`

Removed: `ts-node`, `copyfiles`, `ejs`
