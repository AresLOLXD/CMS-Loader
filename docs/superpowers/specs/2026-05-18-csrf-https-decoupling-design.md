# CSRF / Session Cookie Flags — Decouple TLS from NODE_ENV

**Date:** 2026-05-18  
**Status:** Approved

## Problem

`NODE_ENV=production` controls two unrelated concerns at once:

1. App behavior (trust proxy, morgan verbosity, etc.)
2. Cookie security flags (`secure: true`, `sameSite: 'none'`, `__Host-` prefix)

When running the container locally for testing with `NODE_ENV=production` but no TLS, browsers refuse to set `Secure` cookies over plain HTTP. The CSRF cookie is never stored, so every POST returns `403 ForbiddenError: invalid csrf token`.

## Solution

Introduce a dedicated `HTTPS_ENABLED=true|false` env var that exclusively controls cookie security flags. `NODE_ENV` retains control over app-level behavior only.

### Derivation rules

| Variable | Controls |
|---|---|
| `NODE_ENV=production` | trust proxy, morgan, non-cookie prod behavior |
| `HTTPS_ENABLED=true` | `secure`, `sameSite`, `__Host-` cookie prefix |

### Behavior matrix

| Scenario | NODE_ENV | HTTPS_ENABLED | Cookie name | secure | sameSite |
|---|---|---|---|---|---|
| Local dev | development | (unset) | `csrf` | false | lax |
| Container test | production | false | `csrf` | false | lax |
| Real prod (HTTPS) | production | true | `__Host-csrf` | true | none |

`HTTPS_ENABLED` defaults to `false` when unset to avoid breaking existing deployments.

## Changes

### `src/csrf.ts`

Replace `isProd` with `useSecureCookies` for all cookie flag decisions:

```ts
const isProd = process.env.NODE_ENV === 'production'
const useSecureCookies = process.env.HTTPS_ENABLED === 'true'

doubleCsrf({
  cookieName: useSecureCookies ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    sameSite: useSecureCookies ? 'none' : 'lax',
    secure: useSecureCookies,
    httpOnly: true,
    path: '/'
  },
  // ... rest unchanged
})
```

### `src/index.ts`

Same separation for the session cookie. `isProd` is still used for trust proxy and other app-level flags:

```ts
const useSecureCookies = process.env.HTTPS_ENABLED === 'true'

session({
  cookie: {
    secure: useSecureCookies,
    sameSite: useSecureCookies ? "none" : "lax",
    maxAge: 1000 * 60 * 5,
  },
  // ... rest unchanged
})
```

Add a startup warning (not a fatal error) when `NODE_ENV=production` and `HTTPS_ENABLED` is unset:

```ts
if (isProd && !process.env.HTTPS_ENABLED) {
  console.warn('Warning: NODE_ENV=production but HTTPS_ENABLED is not set. Defaulting to insecure cookies.')
}
```

## Out of scope

- Adding TLS termination or a reverse proxy
- Changes to `trust proxy` logic
- Any other middleware or route changes
