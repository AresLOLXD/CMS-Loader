# CSRF / Session Cookie TLS Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple cookie security flags (`secure`, `sameSite`, `__Host-` prefix) from `NODE_ENV` by introducing a dedicated `HTTPS_ENABLED` env var, so the container can run with `NODE_ENV=production` over plain HTTP without CSRF 403 errors.

**Architecture:** Add `useSecureCookies = process.env.HTTPS_ENABLED === 'true'` in both `src/csrf.ts` and `src/index.ts`. Every cookie flag decision switches from `isProd` to `useSecureCookies`. A startup warning is emitted when `NODE_ENV=production` but `HTTPS_ENABLED` is unset.

**Tech Stack:** TypeScript, Express 5, csrf-csrf 4.0.3, express-session 1.19.0

---

### Task 1: Update `src/csrf.ts`

**Files:**
- Modify: `src/csrf.ts`

- [ ] **Step 1: Open the file and verify current state**

The file currently reads:
```ts
const isProd = process.env.NODE_ENV === 'production'

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET!,
  getSessionIdentifier: (req: Request) => req.sessionID,
  cookieName: isProd ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    httpOnly: true,
    path: '/'
  },
  getCsrfTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string | undefined) ??
    (req.body?._csrf as string | undefined)
})
```

- [ ] **Step 2: Replace cookie flag logic**

Replace the entire file content with:
```ts
import { doubleCsrf } from 'csrf-csrf'
import type { Request } from 'express'

const useSecureCookies = process.env.HTTPS_ENABLED === 'true'

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET!,
  getSessionIdentifier: (req: Request) => req.sessionID,
  cookieName: useSecureCookies ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    sameSite: useSecureCookies ? 'none' : 'lax',
    secure: useSecureCookies,
    httpOnly: true,
    path: '/'
  },
  getCsrfTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string | undefined) ??
    (req.body?._csrf as string | undefined)
})

// Re-export with the name consumers (auth.ts, views.ts) expect
export const generateToken = generateCsrfToken
export { doubleCsrfProtection }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/csrf.ts
git commit -m "fix: decouple csrf cookie flags from NODE_ENV via HTTPS_ENABLED"
```

---

### Task 2: Update `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add `useSecureCookies` variable after `isProd`**

Find this line (line 36):
```ts
const isProd = process.env.NODE_ENV === "production"
```

Add immediately after it:
```ts
const useSecureCookies = process.env.HTTPS_ENABLED === 'true'
```

- [ ] **Step 2: Update session cookie flags**

Find the session cookie block:
```ts
cookie: {
  secure: isProd,
  maxAge: 1000 * 60 * 5,
  sameSite: isProd ? "none" : "lax",
},
```

Replace with:
```ts
cookie: {
  secure: useSecureCookies,
  maxAge: 1000 * 60 * 5,
  sameSite: useSecureCookies ? "none" : "lax",
},
```

- [ ] **Step 3: Add startup warning**

Find the `validateEnv` function:
```ts
function validateEnv(): void {
  const required = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASSWORD']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}
```

Replace with:
```ts
function validateEnv(): void {
  const required = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASSWORD']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
  if (process.env.NODE_ENV === 'production' && !process.env.HTTPS_ENABLED) {
    console.warn('Warning: NODE_ENV=production but HTTPS_ENABLED is not set. Defaulting to insecure cookies.')
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "fix: decouple session cookie flags from NODE_ENV via HTTPS_ENABLED"
```

---

### Task 3: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Verify with `HTTPS_ENABLED` unset (dev default)**

```bash
npm run dev
```

Open browser → `http://localhost:9995`. Check DevTools → Application → Cookies:
- Cookie name: `csrf` (no `__Host-` prefix)
- `Secure`: unchecked
- `SameSite`: Lax

Try a POST (e.g. upload a CSV). Expected: no 403.

- [ ] **Step 2: Verify with `NODE_ENV=production HTTPS_ENABLED=false`**

```bash
NODE_ENV=production HTTPS_ENABLED=false npm run dev
```

Check terminal output: warning message should appear:
```
Warning: NODE_ENV=production but HTTPS_ENABLED is not set. Defaulting to insecure cookies.
```

Wait — `HTTPS_ENABLED=false` is explicitly set so the warning should NOT appear. Correct expected output: **no warning**.

Check cookies:
- Cookie name: `csrf`
- `Secure`: unchecked
- `SameSite`: Lax

Try a POST. Expected: no 403.

- [ ] **Step 3: Verify `NODE_ENV=production` without `HTTPS_ENABLED`**

```bash
NODE_ENV=production npm run dev
```

Check terminal output. Expected warning:
```
Warning: NODE_ENV=production but HTTPS_ENABLED is not set. Defaulting to insecure cookies.
```

App still starts. Cookies: `csrf`, insecure, Lax.

- [ ] **Step 4: Verify with `HTTPS_ENABLED=true` (simulate real prod)**

This requires HTTPS. Skip on plain HTTP — just confirm the cookie name would be `__Host-csrf` by reading the code. If you have a local HTTPS setup (e.g. `mkcert`), run:

```bash
NODE_ENV=production HTTPS_ENABLED=true npm run dev
```

Check cookies:
- Cookie name: `__Host-csrf`
- `Secure`: checked
- `SameSite`: None

- [ ] **Step 5: Lint**

```bash
npx eslint src/
```

Expected: no new errors.
