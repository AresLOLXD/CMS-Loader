# Preact Frontend Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all legacy frontend with a Preact SPA built with Vite, migrating the backend toolchain from `ts-node` to `tsx` so a single `tsconfig.json` and `package.json` covers everything.

**Architecture:** `client/` holds the Preact SPA source. `vite.config.ts` sits at the repo root with `root: 'client'`. Vite builds to `client/dist/`, which Express serves as static files. `tsx` replaces `ts-node` — no compilation step, backend runs directly. One `tsconfig.json` with `moduleResolution: "bundler"` serves both.

**Tech Stack:** Preact 10, @preact/signals, Vite 6, TypeScript 5, Express 5 (backend unchanged logic), tsx, Husky, commitlint, semantic-release. Node.js 24 (confirmed).

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `client/index.html` | SPA HTML shell |
| `client/src/main.tsx` | Renders `<App />` into `#root` |
| `client/src/signals.ts` | All Preact Signals (global state) |
| `client/src/config.ts` | Static `fieldsConfig` for users/contest |
| `client/src/App.tsx` | Auth gate + wizard step router + version footer |
| `client/src/vite-env.d.ts` | `ImportMetaEnv` type declaration |
| `client/src/components/Login.tsx` | Login form |
| `client/src/components/steps/UploadStep.tsx` | Mode select + file upload |
| `client/src/components/steps/MappingStep.tsx` | Column mapping selects |
| `client/src/components/steps/ProcessingStep.tsx` | SSE progress + blob download |
| `client/src/components/steps/DoneStep.tsx` | Success + reset |
| `vite.config.ts` | Vite config at repo root |
| `.husky/commit-msg` | commitlint hook |
| `.husky/pre-push` | semantic-release hook |
| `.commitlintrc.json` | Conventional Commits config |
| `.releaserc.json` | semantic-release config |

### Modified
| File | Change |
|---|---|
| `tsconfig.json` | `module` → ESNext, `moduleResolution` → bundler, add jsx/DOM/noEmit, expand include |
| `package.json` | Add `"type":"module"`, tsx/Preact/Vite deps, new scripts, remove ts-node/copyfiles/ejs |
| `src/index.ts` | `__dirname` → `import.meta.dirname`; replace legacy static with `client/dist`; add SPA catch-all; remove EJS view engine |
| `src/router.ts` | Add `GET /api/me`; remove `requireAuth` from `GET /api/csrf-token`; remove ViewsController |
| `src/controllers/auth.ts` | Remove `GET /`; change `POST /` to JSON; `GET /logout` redirects to `/` |
| `src/middleware/requireAuth.ts` | Return 401 JSON for `Accept: application/json` requests |
| `README.md` | Stack, setup, dev, build, versioning sections |

### Deleted
| File | Reason |
|---|---|
| `src/controllers/views.ts` | EJS routes replaced by Preact SPA |
| `src/views/*.ejs` | All three EJS templates replaced |
| `src/public/html/*.html` | Replaced by SPA |
| `src/public/js/*.js` | Replaced by Preact components |

---

## Task 1: tsconfig + package.json Migration (tsx + Preact + Vite)

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json`

This task migrates the toolchain. After it, the backend runs with `tsx` instead of `ts-node`.

- [ ] **Step 1: Update `tsconfig.json`**

Replace the entire `compilerOptions` block and `include`/`exclude` with:

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

Key changes from current: `module` nodenext→ESNext, `moduleResolution` nodenext→bundler, added `lib`/`jsx`/`jsxImportSource`/`allowImportingTsExtensions`/`isolatedModules`/`moduleDetection`/`noEmit`, removed `outDir`/`sourceMap`.

- [ ] **Step 2: Install new deps, remove old ones**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader
pnpm add preact @preact/signals
pnpm add -D tsx vite @preact/preset-vite
pnpm remove ts-node copyfiles ejs
```

(`ejs` removal may warn if not found — that's fine.)

- [ ] **Step 3: Update `package.json` scripts and add `"type": "module"`**

The `package.json` must have `"type": "module"` at the top level and updated scripts:

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
    "test:watch": "vitest"
  }
}
```

Remove `"clean"`, `"copy-files"`, and old `"dev"` / `"build"` / `"start"` scripts.

- [ ] **Step 4: Verify tsx runs the backend**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader
tsx src/index.ts &
sleep 2
curl http://localhost:9995/api/csrf-token
kill %1
```

Expected: JSON response with a token (or an error about missing .env — both mean tsx loaded the file correctly).

If `.env` is not present, create a minimal one:
```
SESSION_SECRET=dev-secret-1234
ADMIN_USER=admin
ADMIN_PASSWORD=admin
```

- [ ] **Step 5: Run existing tests**

```bash
vitest run
```

Expected: all tests pass. If tests fail due to ESM import issues, check that `vitest` is happy with `"type": "module"` — vitest 4.x supports ESM natively.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json package.json pnpm-lock.yaml
git commit -m "chore: migrate from ts-node to tsx, add Preact + Vite deps, shared tsconfig"
```

---

## Task 2: `src/index.ts` Backend Updates

**Files:**
- Modify: `src/index.ts`

Replace `__dirname` (not available in ESM) with `import.meta.dirname`. Update static file serving to point at `client/dist/`. Remove EJS view engine setup.

- [ ] **Step 1: Replace `__dirname` and update static serving**

Read the current `src/index.ts` (lines 95–108), then apply these changes:

1. Replace `join(__dirname, "logs")` → `join(import.meta.dirname, "logs")`

2. Remove these two lines:
```ts
app.use("/public", express.static(join(__dirname, "public")))
app.use("/", express.static(join(__dirname, "public", "html")))
```

3. Remove these two lines:
```ts
app.set('view engine', 'ejs');
app.set("views", join(__dirname, "views"))
```

4. Before `app.listen`, add frontend static serving and SPA catch-all:
```ts
// Serve Vite-built frontend
app.use(express.static(join(import.meta.dirname, '../client/dist')))
app.use(Rutas)

// SPA catch-all: non-API GETs return index.html
app.get('*', (_req, res) => {
  res.sendFile(join(import.meta.dirname, '../client/dist', 'index.html'))
})
```

The full final block at the bottom of `src/index.ts` (after all middleware):

```ts
// Serve Vite-built frontend
app.use(express.static(join(import.meta.dirname, '../client/dist')))
app.use(Rutas)

// SPA catch-all: non-API GETs return index.html
app.get('*', (_req, res) => {
  res.sendFile(join(import.meta.dirname, '../client/dist', 'index.html'))
})

// Arranque con manejo de errores
app.listen(port, () => {
  console.log(`Servidor iniciado en ${port}`)
}).on('error', (err) => {
  console.error('Error al iniciar servidor:', err)
})
```

Also remove the `ViewsController` import from `src/router.ts` if it hasn't been done yet (it's handled in Task 3).

- [ ] **Step 2: Verify TypeScript type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors. (`import.meta.dirname` is typed in Node.js types.)

- [ ] **Step 3: Verify backend starts**

```bash
tsx src/index.ts &
sleep 2
curl http://localhost:9995/api/csrf-token
kill %1
```

Expected: JSON response.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: replace __dirname with import.meta.dirname, update static serving for SPA"
```

---

## Task 3: Backend API Changes

**Files:**
- Modify: `src/router.ts`
- Modify: `src/controllers/auth.ts`
- Modify: `src/middleware/requireAuth.ts`
- Delete: `src/controllers/views.ts`

- [ ] **Step 1: Update `src/router.ts`**

```ts
import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation.js";
import AnalyzeCSVController from "./controllers/analyzeCSV.js";
import AuthController from "./controllers/auth.js";
import JobsController from "./controllers/jobs.js";
import RegisterUsersController from "./controllers/registerUsers.js";
import { generateToken } from "./csrf.js";
import { requireAuth } from "./middleware/requireAuth.js";

const router = Router()

router.use("/login", AuthController)

// Public: needed by login form before authentication
router.get("/api/csrf-token", (req, res) => {
  const token = generateToken(req, res)
  res.json({ token })
})

// Public: SPA checks this on mount
router.get("/api/me", (req, res) => {
  res.json({ authenticated: req.session.authenticated === true })
})

router.use(requireAuth)

router.use("/analyzeCSV", AnalyzeCSVController)
router.use("/registerUsers", RegisterUsersController)
router.use("/addParticipation", AddParticipationController)
router.use("/jobs", JobsController)

export default router
```

Note: imports must use `.js` extensions in ESM (tsx resolves `.js` to `.ts` at runtime).

- [ ] **Step 2: Update `src/controllers/auth.ts`**

```ts
import { createHash, timingSafeEqual } from 'crypto'
import { Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiados intentos, espera 15 minutos" }
})

function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

router.post('/', loginLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }
  const validUser = safeCompare(username ?? '', process.env.ADMIN_USER!)
  const validPass = safeCompare(password ?? '', process.env.ADMIN_PASSWORD!)

  if (validUser && validPass) {
    req.session.authenticated = true
    req.session.save(() => res.json({ success: true }))
    return
  }

  res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' })
})

router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/'))
})

export default router
```

- [ ] **Step 3: Update `src/middleware/requireAuth.ts`**

```ts
import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated === true) {
    next()
    return
  }
  if (req.accepts('json')) {
    res.status(401).json({ success: false, message: 'No autenticado' })
    return
  }
  res.redirect('/login')
}
```

- [ ] **Step 4: Delete `src/controllers/views.ts`**

```bash
git rm src/controllers/views.ts
```

- [ ] **Step 5: Check other backend files for `.js` extension imports**

With `"type": "module"` and `moduleResolution: "bundler"`, relative imports in the backend source may need `.js` extensions. tsx resolves `.js` → `.ts` automatically, but verify all other controllers compile cleanly:

```bash
npx tsc --noEmit
```

Fix any import extension errors found.

- [ ] **Step 6: Verify endpoints**

```bash
tsx src/index.ts &
sleep 2
curl http://localhost:9995/api/me
curl http://localhost:9995/api/csrf-token
kill %1
```

Expected: `{"authenticated":false}` and `{"token":"..."}`.

- [ ] **Step 7: Commit**

```bash
git add src/router.ts src/controllers/auth.ts src/middleware/requireAuth.ts
git rm src/controllers/views.ts
git commit -m "feat: add GET /api/me, make csrf-token public, convert login to JSON API"
```

---

## Task 4: Vite Config + Client Shell

**Files:**
- Create: `vite.config.ts` (at repo root)
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/vite-env.d.ts`

- [ ] **Step 1: Create `vite.config.ts` at repo root**

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

- [ ] **Step 2: Create `client/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CMS Loader</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `client/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 4: Create `client/src/main.tsx`** (placeholder — App not created yet)

```tsx
import { render } from 'preact'

render(<p>Cargando...</p>, document.getElementById('root')!)
```

- [ ] **Step 5: Verify Vite starts**

```bash
vite
```

Expected: Vite dev server starts on http://localhost:5173. Browser shows "Cargando...". No errors in terminal.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts client/
git commit -m "chore: add Vite config and client shell"
```

---

## Task 5: Signals, Config, and App Shell

**Files:**
- Create: `client/src/signals.ts`
- Create: `client/src/config.ts`
- Create: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Create `client/src/signals.ts`**

```ts
import { signal } from '@preact/signals'

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'
export type WizardStep = 'upload' | 'mapping' | 'processing' | 'done'
export type Mode = 'users' | 'contest'

export const authStatus = signal<AuthStatus>('checking')
export const csrfToken = signal<string>('')
export const wizardStep = signal<WizardStep>('upload')
export const mode = signal<Mode>('users')
export const columns = signal<string[]>([])
export const mapping = signal<Record<string, string>>({})
export const jobId = signal<string | null>(null)
```

- [ ] **Step 2: Create `client/src/config.ts`**

```ts
export interface FieldConfig {
  name: string
  label: string
  required?: boolean
}

export const fieldsConfig: Record<'users' | 'contest', FieldConfig[]> = {
  users: [
    { name: 'usuario', label: 'Usuario', required: true },
    { name: 'nombre', label: 'Nombre' },
    { name: 'apellidos', label: 'Apellidos' },
    { name: 'email', label: 'Email' },
    { name: 'timezone', label: 'Zona horaria' },
    { name: 'languages', label: 'Idiomas' },
    { name: 'password', label: 'Contraseña' },
  ],
  contest: [
    { name: 'usuario', label: 'Usuario', required: true },
    { name: 'contest', label: 'Concurso', required: true },
    { name: 'ip', label: 'IP' },
    { name: 'tiempo_retraso', label: 'Tiempo retraso' },
    { name: 'tiempo_extra', label: 'Tiempo extra' },
    { name: 'team', label: 'Equipo' },
    { name: 'oculto', label: 'Oculto' },
    { name: 'sin_restricciones', label: 'Sin restricciones' },
    { name: 'password', label: 'Contraseña' },
  ],
}
```

- [ ] **Step 3: Create `client/src/App.tsx`**

```tsx
import { useEffect } from 'preact/hooks'
import { authStatus, csrfToken, wizardStep } from './signals'
import Login from './components/Login'
import UploadStep from './components/steps/UploadStep'
import MappingStep from './components/steps/MappingStep'
import ProcessingStep from './components/steps/ProcessingStep'
import DoneStep from './components/steps/DoneStep'

async function loadCsrfToken() {
  const res = await fetch('/api/csrf-token')
  if (!res.ok) return
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
}

export default function App() {
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(async (body: { authenticated: boolean }) => {
        await loadCsrfToken()
        authStatus.value = body.authenticated ? 'authenticated' : 'unauthenticated'
      })
      .catch(() => {
        authStatus.value = 'unauthenticated'
      })
  }, [])

  return (
    <div>
      {authStatus.value === 'checking' && <p>Cargando...</p>}
      {authStatus.value === 'unauthenticated' && <Login />}
      {authStatus.value === 'authenticated' && (
        <>
          {wizardStep.value === 'upload' && <UploadStep />}
          {wizardStep.value === 'mapping' && <MappingStep />}
          {wizardStep.value === 'processing' && <ProcessingStep />}
          {wizardStep.value === 'done' && <DoneStep />}
        </>
      )}
      {authStatus.value !== 'checking' && (
        <footer style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#888' }}>
          v{import.meta.env.VITE_APP_VERSION}
        </footer>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `client/src/main.tsx`**

```tsx
import { render } from 'preact'
import App from './App'

render(<App />, document.getElementById('root')!)
```

- [ ] **Step 5: Verify Vite still starts without errors**

```bash
vite
```

Browser shows "Cargando..." (Login not created yet). No TypeScript errors in terminal.

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: add Preact signals, config, and App shell"
```

---

## Task 6: Login Component

**Files:**
- Create: `client/src/components/Login.tsx`

- [ ] **Step 1: Create `client/src/components/Login.tsx`**

```tsx
import { useState } from 'preact/hooks'
import { authStatus, csrfToken } from '../signals'

async function refreshCsrfToken() {
  const res = await fetch('/api/csrf-token')
  if (!res.ok) return
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken.value,
        },
        body: JSON.stringify({ username, password }),
      })

      if (res.status === 401) {
        const body = await res.json() as { message?: string }
        throw new Error(body.message ?? 'Credenciales inválidas')
      }

      if (!res.ok) throw new Error(`Error ${res.status}`)

      await refreshCsrfToken()
      authStatus.value = 'authenticated'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '320px', margin: '4rem auto' }}>
      <h1>CMS Loader</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label for="username">Usuario</label>
          <input
            id="username"
            value={username}
            onInput={e => setUsername((e.target as HTMLInputElement).value)}
            required
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginTop: '12px' }}>
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onInput={e => setPassword((e.target as HTMLInputElement).value)}
            required
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          />
        </div>
        {error && <p role="alert" style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: '16px', padding: '8px 16px' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify login in browser**

With Express running (`tsx src/index.ts`) and Vite running (`vite`), open http://localhost:5173:
- Shows login form
- Wrong credentials → red error
- Correct credentials → "Cargando..." then blank (UploadStep not yet created — normal)

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Login.tsx
git commit -m "feat: add Login component with CSRF handling"
```

---

## Task 7: UploadStep

**Files:**
- Create: `client/src/components/steps/UploadStep.tsx`

- [ ] **Step 1: Create `client/src/components/steps/UploadStep.tsx`**

```tsx
import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, wizardStep } from '../../signals'
import type { Mode } from '../../signals'

async function retryCsrf(): Promise<string> {
  const res = await fetch('/api/csrf-token')
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
  return body.token
}

export default function UploadStep() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) { setError('Selecciona un archivo CSV'); return }
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('El archivo debe tener extensión .csv'); return }

    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('archivo', file)
    let token = csrfToken.value

    try {
      let res = await fetch('/analyzeCSV', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
        body: formData,
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch('/analyzeCSV', {
          method: 'POST',
          headers: { 'x-csrf-token': token },
          body: formData,
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message ?? `Error ${res.status}`)
      }

      const body = await res.json() as { success: boolean; data: { columnas: string[] } }
      if (!body.success || !body.data.columnas.length) throw new Error('No se encontraron columnas en el CSV')

      columns.value = body.data.columnas
      wizardStep.value = 'mapping'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h1>CMS Loader</h1>
      <h2>1 — Subir CSV</h2>
      <div>
        <label for="mode-select">Tipo de operación</label>
        <select
          id="mode-select"
          value={mode.value}
          onChange={e => { mode.value = (e.target as HTMLSelectElement).value as Mode }}
          disabled={loading}
          style={{ display: 'block', marginTop: '4px' }}
        >
          <option value="users">Usuarios</option>
          <option value="contest">Concurso</option>
        </select>
      </div>
      <div style={{ marginTop: '12px' }}>
        <label for="csv-file">Archivo CSV</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv"
          onChange={e => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
          disabled={loading}
          style={{ display: 'block', marginTop: '4px' }}
        />
      </div>
      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        style={{ marginTop: '16px', padding: '8px 16px' }}
      >
        {loading ? 'Analizando...' : 'Subir CSV'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

After login, upload form appears. Upload a valid CSV → advances to mapping (blank — normal). Non-CSV file → error.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/UploadStep.tsx
git commit -m "feat: add UploadStep with CSV analysis and CSRF retry"
```

---

## Task 8: MappingStep

**Files:**
- Create: `client/src/components/steps/MappingStep.tsx`

- [ ] **Step 1: Create `client/src/components/steps/MappingStep.tsx`**

```tsx
import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, mapping, jobId, wizardStep } from '../../signals'
import { fieldsConfig } from '../../config'

async function retryCsrf(): Promise<string> {
  const res = await fetch('/api/csrf-token')
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
  return body.token
}

export default function MappingStep() {
  const fields = fieldsConfig[mode.value]
  const [localMapping, setLocalMapping] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, '']))
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    const missing = fields.filter(f => f.required && !localMapping[f.name])
    if (missing.length) {
      setError(`Campo requerido sin asignar: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    setLoading(true)
    setError('')
    const endpoint = mode.value === 'users' ? '/registerUsers' : '/addParticipation'
    let token = csrfToken.value

    try {
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(localMapping),
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          body: JSON.stringify(localMapping),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message ?? `Error ${res.status}`)
      }

      const body = await res.json() as { jobId: string }
      mapping.value = localMapping
      jobId.value = body.jobId
      wizardStep.value = 'processing'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>2 — Mapeo de columnas</h2>
      <p>Los marcados con * son requeridos.</p>
      {fields.map(field => (
        <div key={field.name} style={{ marginTop: '10px' }}>
          <label for={`field-${field.name}`}>{field.label}{field.required ? ' *' : ''}</label>
          <select
            id={`field-${field.name}`}
            value={localMapping[field.name]}
            onChange={e => {
              const val = (e.target as HTMLSelectElement).value
              setLocalMapping(prev => ({ ...prev, [field.name]: val }))
            }}
            disabled={loading}
            style={{ display: 'block', width: '100%', marginTop: '4px' }}
          >
            <option value="">(No asignado)</option>
            {columns.value.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </div>
      ))}
      {error && <p role="alert" style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => { wizardStep.value = 'upload' }} disabled={loading}>Volver</button>
        <button onClick={handleSend} disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

After CSV upload, mapping step shows one select per field. Required fields have `*`. Missing required → error. Valid submission → advances to processing (blank — normal).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/MappingStep.tsx
git commit -m "feat: add MappingStep with field assignment and validation"
```

---

## Task 9: ProcessingStep

**Files:**
- Create: `client/src/components/steps/ProcessingStep.tsx`

- [ ] **Step 1: Create `client/src/components/steps/ProcessingStep.tsx`**

```tsx
import { useEffect, useState } from 'preact/hooks'
import { jobId, mode, wizardStep } from '../../signals'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ProcessingStep() {
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const currentJobId = jobId.value
    if (!currentJobId) return

    const source = new EventSource(`/jobs/${currentJobId}/events`)

    source.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { processed: number; total: number; percent: number }
      setProcessed(data.processed)
      setTotal(data.total)
      setPercent(data.percent)
    })

    source.addEventListener('done', async () => {
      source.close()
      const filename = mode.value === 'users' ? 'Resultados usuarios.csv' : 'Errores concurso.csv'
      try {
        const res = await fetch(`/jobs/${currentJobId}/result`)
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size > 0) downloadBlob(blob, filename)
        }
      } catch {
        // download failure is non-fatal
      }
      wizardStep.value = 'done'
    })

    source.addEventListener('job-error', (e: MessageEvent) => {
      source.close()
      const data = JSON.parse(e.data) as { message?: string }
      setError(data.message ?? 'Error interno en el procesamiento')
    })

    source.onerror = () => {
      source.close()
      setError('Error de conexión con el servidor.')
    }

    return () => source.close()
  }, [])

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
        <h2>Error en el procesamiento</h2>
        <p role="alert" style={{ color: 'red' }}>{error}</p>
        <button onClick={() => { wizardStep.value = 'mapping' }}>Volver al mapeo</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>3 — Procesando</h2>
      <p>{total > 0 ? `Procesando ${processed} de ${total} registros` : 'Iniciando...'}</p>
      <progress value={percent} max={100} style={{ width: '100%', marginTop: '8px' }} />
    </div>
  )
}
```

- [ ] **Step 2: Verify full flow**

Login → upload CSV → map columns → submit → confirm progress bar advances → CSV downloads → "done" step appears. Check DevTools → Network → filter `events` for SSE connection.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/ProcessingStep.tsx
git commit -m "feat: add ProcessingStep with SSE progress and blob download"
```

---

## Task 10: DoneStep

**Files:**
- Create: `client/src/components/steps/DoneStep.tsx`

- [ ] **Step 1: Create `client/src/components/steps/DoneStep.tsx`**

```tsx
import { columns, jobId, mapping, mode, wizardStep } from '../../signals'

function resetWizard() {
  wizardStep.value = 'upload'
  columns.value = []
  mapping.value = {}
  jobId.value = null
  mode.value = 'users'
}

export default function DoneStep() {
  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>Operación completada</h2>
      <p>El archivo de resultados fue descargado automáticamente.</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={resetWizard} style={{ padding: '8px 16px' }}>Nueva carga</button>
        <button onClick={() => { window.location.href = '/logout' }} style={{ padding: '8px 16px' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify full happy path**

1. http://localhost:5173 → login form
2. Login → upload CSV → map → submit
3. Progress bar → CSV download → "Operación completada"
4. "Nueva carga" → back to upload
5. "Cerrar sesión" → back to login

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/DoneStep.tsx
git commit -m "feat: add DoneStep with wizard reset and logout"
```

---

## Task 11: Remove Legacy Files

**Files:**
- Delete: all legacy HTML, JS, EJS listed below

- [ ] **Step 1: Delete legacy files**

```bash
git rm src/public/html/index.html \
       src/public/html/cargaUsuarios.html \
       src/public/html/cargaConcurso.html \
       src/public/html/reactApp.html \
       src/public/js/csvUploader.js \
       src/public/js/cargaUsuarios.js \
       src/public/js/cargaConcurso.js \
       src/public/js/seleccionaColumnasUser.js \
       src/public/js/seleccionaColumnasConcurso.js \
       src/public/js/reactApp.js \
       src/views/seleccionaColumnasUser.ejs \
       src/views/seleccionaColumnasConcurso.ejs \
       src/views/login.ejs
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify production build**

```bash
pnpm run build
```

Expected: `client/dist/` contains `index.html` and `assets/` with hashed files.

- [ ] **Step 4: Verify production server**

```bash
tsx src/index.ts &
sleep 2
curl -s http://localhost:9995 | grep -i "cms loader"
kill %1
```

Expected: HTML containing "CMS Loader" title (served from `client/dist/index.html`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove all legacy frontend files (HTML, JS, EJS)"
```

---

## Task 12: Automated Versioning (Husky + semantic-release)

**Files:**
- Create: `.husky/commit-msg`
- Create: `.husky/pre-push`
- Create: `.commitlintrc.json`
- Create: `.releaserc.json`
- Modify: `package.json` (add `prepare` script)

- [ ] **Step 1: Install versioning devDependencies**

```bash
pnpm add -D husky @commitlint/cli @commitlint/config-conventional semantic-release @semantic-release/changelog @semantic-release/git
```

- [ ] **Step 2: Initialize Husky**

```bash
pnpm exec husky init
```

Expected: `.husky/` directory created.

- [ ] **Step 3: Create `.husky/commit-msg`**

```bash
printf 'npx --no -- commitlint --edit "$1"\n' > .husky/commit-msg
chmod +x .husky/commit-msg
rm -f .husky/pre-commit
```

- [ ] **Step 4: Create `.husky/pre-push`**

```bash
printf 'npx semantic-release --no-ci\n' > .husky/pre-push
chmod +x .husky/pre-push
```

- [ ] **Step 5: Create `.commitlintrc.json`**

```json
{
  "extends": ["@commitlint/config-conventional"]
}
```

- [ ] **Step 6: Create `.releaserc.json`**

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }]
  ]
}
```

- [ ] **Step 7: Add `prepare` script**

In `package.json` scripts, add:
```json
"prepare": "husky"
```

- [ ] **Step 8: Verify commitlint**

```bash
echo "invalid message" | npx commitlint
echo "feat: valid message" | npx commitlint
```

Expected: first fails, second exits 0.

- [ ] **Step 9: Commit**

```bash
git add .husky/ .commitlintrc.json .releaserc.json package.json pnpm-lock.yaml
git commit -m "chore: add Husky, commitlint, and semantic-release"
```

---

## Task 13: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the following sections to `README.md`** (integrate with existing content)

```markdown
## Stack

**Backend:** Express 5, TypeScript, tsx, express-session, csrf-csrf, multer, csv, p-limit
**Frontend:** Preact 10, @preact/signals, Vite 6, TypeScript

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD`.

## Development

Run backend and frontend in separate terminals:

```bash
# Terminal 1 — Express API on :9995
pnpm run dev:backend

# Terminal 2 — Vite dev server on :5173 (proxies API to :9995)
pnpm run dev:frontend
```

Open http://localhost:5173.

## Build

```bash
pnpm run build
```

Builds Preact SPA to `client/dist/`. The Express server serves this directory as static files.

## Production

```bash
pnpm start
```

Builds the frontend and starts Express via `tsx src/index.ts` on `PORT` (default 9995).

## Versioning

Uses [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/).

| Commit prefix | Effect |
|---|---|
| `feat:` | Minor bump (0.x.0) |
| `fix:` | Patch bump (0.0.x) |
| `feat!:` / `BREAKING CHANGE:` | Major bump (x.0.0) |
| `chore:`, `docs:`, `test:` | No release |

On `git push origin main`, Husky runs semantic-release: bumps `package.json`, updates `CHANGELOG.md`, creates a git tag. The current version is shown in the app footer.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with Preact stack, dev workflow, and versioning guide"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Single `package.json` + single `tsconfig.json` | Task 1 |
| `tsx` replaces `ts-node` | Task 1 |
| `import.meta.dirname` replaces `__dirname` | Task 2 |
| `vite.config.ts` at root, `root: 'client'` | Task 4 |
| Preact Signals global state | Task 5 |
| Login component with CSRF | Task 6 |
| UploadStep | Task 7 |
| MappingStep | Task 8 |
| ProcessingStep with SSE | Task 9 |
| DoneStep | Task 10 |
| Version in footer | Task 5 (App.tsx) |
| GET /api/me + csrf-token public | Task 3 |
| auth.ts returns JSON | Task 3 |
| requireAuth returns 401 JSON | Task 3 |
| Legacy files deleted | Task 11 |
| Versioning tooling | Task 12 |
| README | Task 13 |

### ESM Import Extension Note

With `"type": "module"` in `package.json`, Node.js requires `.js` extensions on relative imports in runtime files. tsx resolves `.js` → `.ts` transparently, but if TypeScript type-check errors appear about missing modules, add `.js` extensions to relative imports in `src/` files (e.g., `import ... from './csrf.js'`). The plan's router.ts step already includes this.
