# Sub-project A: Security — Design Spec
**Date:** 2026-05-16
**Scope:** Harden CMS-Loader for internal use — secrets management, authentication, HTTP security headers, CSRF protection, rate limiting.

---

## 1. Secrets & Environment Configuration

### What changes
- Remove hardcoded `SESSION_SECRET` fallback from `src/index.ts:39`.
- Remove hardcoded `/var/local/lib/cms/cmsEnv.sh` path from `src/controllers/registerUsers.ts:67` and `src/controllers/addParticipation.ts:106`.
- Add `dotenv` to load `.env` in development. In production, env vars are injected by the host.
- At boot, validate all required env vars are present. If any is missing, log a clear error and `process.exit(1)`.

### Required env vars
```
SESSION_SECRET=        # 32+ random chars — required, no default
ADMIN_USER=            # login username
ADMIN_PASSWORD=        # login password
CMS_ENV_SCRIPT=/var/local/lib/cms/cmsEnv.sh   # path to CMS env script
PORT=9995              # optional, defaults to 9995
```

### Files affected
- `src/index.ts` — add boot-time validation, load dotenv
- `src/controllers/registerUsers.ts` — replace literal path with `process.env.CMS_ENV_SCRIPT`
- `src/controllers/addParticipation.ts` — same
- `.env.example` — new file documenting all vars (committed, no real values)
- `.env` — added to `.gitignore` if not already present

---

## 2. Authentication — Session-based Login

### What changes
- New controller `src/controllers/auth.ts` with:
  - `GET /login` — renders `src/views/login.ejs` (simple form, username + password)
  - `POST /login` — validates against `ADMIN_USER`/`ADMIN_PASSWORD` env vars using `timingSafeEqual` to prevent timing attacks; on success sets `req.session.authenticated = true` and redirects to `/`; on failure re-renders login with generic error message
  - `GET /logout` — destroys session, redirects to `/login`
- New middleware `src/middleware/requireAuth.ts`:
  - If `req.session.authenticated !== true`, redirects to `/login`
  - Applied to all routes in `src/router.ts` except `/login` and `/public`
- Extend `SessionData` in `src/index.ts` with `authenticated?: boolean`

### No database required
Credentials live only in env. Single admin user — appropriate for internal tool.

### Files affected
- `src/controllers/auth.ts` — new
- `src/middleware/requireAuth.ts` — new
- `src/views/login.ejs` — new (simple EJS form, reuses existing CSS)
- `src/router.ts` — mount `requireAuth` and `AuthController`
- `src/index.ts` — extend `SessionData`

---

## 3. HTTP Security Headers, CSRF & Rate Limiting

### Helmet
- `app.use(helmet())` added in `src/index.ts` before routes.
- CSP configured to allow self-hosted static assets: `defaultSrc 'self'`.
- Covers: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), HSTS, Referrer-Policy, X-XSS-Protection.

### CSRF — `csrf-csrf`
- Replaces deprecated `csurf`. Token generated per session.
- All EJS views include a hidden `_csrf` input field.
- JSON endpoint (`POST /analyzeCSV`) reads token from `x-csrf-token` header (set by frontend JS).
- CSRF middleware applied after session middleware, before routes.

### Rate Limiting — `express-rate-limit`
| Route | Limit | Window | Reason |
|-------|-------|--------|--------|
| `POST /login` | 10 req | 15 min | Anti-brute-force |
| `POST /analyzeCSV` | 20 req | 1 min | File upload cost |
| `POST /registerUsers` | 5 req | 1 min | Shells out N times |
| `POST /addParticipation` | 5 req | 1 min | Shells out N times |

Limiters applied per-route in their respective controllers (or in `router.ts`).

### New dependencies
```json
"helmet": "^8.x",
"csrf-csrf": "^3.x",
"express-rate-limit": "^7.x",
"dotenv": "^16.x"
```

### Files affected
- `src/index.ts` — add helmet, csrf-csrf middleware
- `src/controllers/analyzeCSV.ts` — add rate limiter, read CSRF token from header
- `src/controllers/registerUsers.ts` — add rate limiter
- `src/controllers/addParticipation.ts` — add rate limiter
- `src/views/*.ejs` — add CSRF hidden field
- `package.json` — add new dependencies

---

## Data Flow After Changes

```
Request
  → helmet (security headers)
  → session middleware
  → saveAsync patch
  → csrf-csrf (validate token)
  → requireAuth (redirect to /login if not authenticated)
  → rate limiter (per-route)
  → controller
```

---

## Out of Scope
- Multi-user auth, roles, or permissions
- OAuth / SSO
- Audit logging of actions (separate concern)
- HTTPS termination (handled by reverse proxy in production)
