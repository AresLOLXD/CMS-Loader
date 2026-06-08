# Base Path Prefix — Design Spec

## Context

CMS-Loader runs in Docker and may be served at a sub-path of a domain (e.g. `/cms/`) instead of the root. The reverse proxy (nginx) handles path stripping before forwarding to Express, so the server always sees root-relative URLs. The problem is the Preact client, which hardcodes absolute fetch paths like `fetch('/api/csrf-token')` — these bypass the nginx location block once the prefix is stripped, causing 404s.

## Approach

Build-time configuration via Vite's `base` option. One env var (`VITE_BASE_PATH`) controls both static asset URLs in the generated `index.html` and API fetch calls in the client bundle. The server (Express) requires no changes.

## Changes

### 1. `vite.config.ts`

Add `base: process.env.VITE_BASE_PATH ?? '/'` to the Vite config. Vite will:
- Prefix all asset references in the built `index.html` with the base path.
- Expose the value as `import.meta.env.BASE_URL` (always with trailing slash) in the client bundle.

### 2. `client/src/api.ts` (new file)

A single helper used by all components to construct API URLs:

```ts
export function apiUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
```

Example: `apiUrl('/api/csrf-token')` with `BASE_URL = '/cms/'` → `'/cms/api/csrf-token'`.

### 3. Client fetch calls

Replace all hardcoded absolute fetch paths with `apiUrl(...)`. Files affected:

- `client/src/App.tsx` — `/api/csrf-token`, `/api/me`
- `client/src/components/Login.tsx` — `/login`
- `client/src/components/steps/UploadStep.tsx` — `/analyzeCSV`
- `client/src/components/steps/MappingStep.tsx` — `/registerUsers` or `/addParticipation`
- `client/src/components/steps/ProcessingStep.tsx` — `/jobs/...`

### 4. `.env.example`

Document the new variable:

```
VITE_BASE_PATH=/   # sub-path prefix when not served at domain root, e.g. /cms
```

## Deployment

### Nginx (path stripping)

```nginx
location /cms/ {
    proxy_pass http://app:9995/;
}
```

The trailing slash in `proxy_pass` is required — it tells nginx to strip the `/cms` prefix before forwarding.

### Docker build

Pass `VITE_BASE_PATH` as a build arg:

```dockerfile
ARG VITE_BASE_PATH=/
RUN VITE_BASE_PATH=$VITE_BASE_PATH npm run build
```

Or set it in the build environment before running `npm run build`.

## What does NOT change

- Express routes — unchanged, always mounted at `/`.
- Session, CSRF, auth middleware — unchanged.
- Server env vars (`SESSION_SECRET`, `ADMIN_USER`, etc.) — unchanged.
- Vite dev proxy — unchanged (dev always runs at root).
