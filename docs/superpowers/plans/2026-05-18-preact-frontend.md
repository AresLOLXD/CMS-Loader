# Preact Frontend Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all legacy frontend (static HTML, vanilla JS, EJS views) with a Preact SPA built with Vite, add Husky + semantic-release automated versioning, and surface the app version in the UI.

**Architecture:** A `frontend/` subdirectory holds a standalone Vite + Preact project that builds to `frontend/dist/`. Express serves that dist as static files in production and proxies API calls in development. Global state lives in Preact Signals; the wizard (upload → mapping → processing → done) never navigates between pages.

**Tech Stack:** Preact 10, @preact/signals, Vite 6, TypeScript 5, Express 5 (unchanged backend), Husky, commitlint, semantic-release.

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `frontend/package.json` | Frontend dependencies and dev/build scripts |
| `frontend/tsconfig.json` | TypeScript config for Preact JSX |
| `frontend/vite.config.ts` | Vite config: Preact plugin, dev proxy, version define |
| `frontend/index.html` | Single HTML shell with `<div id="root">` |
| `frontend/src/main.tsx` | Renders `<App />` into `#root` |
| `frontend/src/signals.ts` | All Preact Signals (global state) |
| `frontend/src/config.ts` | Static `fieldsConfig` for users and contest modes |
| `frontend/src/App.tsx` | Auth gate + wizard step router + footer with version |
| `frontend/src/components/Login.tsx` | Login form, POSTs to `/login`, updates authStatus |
| `frontend/src/components/steps/UploadStep.tsx` | Mode selector + file picker + POST /analyzeCSV |
| `frontend/src/components/steps/MappingStep.tsx` | Column mapping selects + POST /registerUsers or /addParticipation |
| `frontend/src/components/steps/ProcessingStep.tsx` | SSE progress + blob download |
| `frontend/src/components/steps/DoneStep.tsx` | Success message + reset to upload |
| `.husky/commit-msg` | commitlint hook |
| `.husky/pre-push` | semantic-release hook |
| `.commitlintrc.json` | Conventional Commits config |
| `.releaserc.json` | semantic-release config |

### Modified
| File | Change |
|---|---|
| `src/router.ts` | Add `GET /api/me`; remove `requireAuth` from `GET /api/csrf-token` |
| `src/controllers/auth.ts` | Remove `GET /` (EJS login page); change `POST /` to return JSON; update `GET /logout` redirect to `/` |
| `src/middleware/requireAuth.ts` | Return 401 JSON for requests that accept JSON (fetch from SPA) |
| `src/index.ts` | Replace legacy static serving with `frontend/dist/`; add SPA catch-all; remove EJS view engine setup |
| `package.json` | Add `dev:backend`, `dev:frontend`, `build:frontend` scripts; add versioning devDependencies |
| `README.md` | Add new stack, setup, dev, build, and versioning sections |

### Deleted
| File | Reason |
|---|---|
| `src/controllers/views.ts` | EJS column-selection routes replaced by MappingStep |
| `src/views/seleccionaColumnasUser.ejs` | Replaced by MappingStep |
| `src/views/seleccionaColumnasConcurso.ejs` | Replaced by MappingStep |
| `src/views/login.ejs` | Replaced by Login.tsx |
| `src/public/html/*.html` | Replaced by Preact SPA |
| `src/public/js/*.js` | Replaced by Preact components |

---

## Task 1: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "cms-loader-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "preact": "^10.25.4",
    "@preact/signals": "^1.3.2"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.5",
    "typescript": "^5.9.3",
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
) as { version: string }

export default defineConfig({
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
          // GET /login is handled by Vite (serves index.html for SPA)
          // POST /login is proxied to Express
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

Note: Express runs on port 9995 (see `src/index.ts` — `Number(process.env.PORT) || 9995`).

- [ ] **Step 4: Create `frontend/index.html`**

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

- [ ] **Step 5: Install frontend dependencies**

```bash
cd frontend && pnpm install
```

Expected: `node_modules/` created inside `frontend/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Vite + Preact frontend project"
```

---

## Task 2: Signals and Config

**Files:**
- Create: `frontend/src/signals.ts`
- Create: `frontend/src/config.ts`

- [ ] **Step 1: Create `frontend/src/signals.ts`**

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

- [ ] **Step 2: Create `frontend/src/config.ts`**

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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Preact signals and fields config"
```

---

## Task 3: Backend Changes

**Files:**
- Modify: `src/router.ts`
- Modify: `src/controllers/auth.ts`
- Modify: `src/middleware/requireAuth.ts`
- Modify: `src/index.ts`
- Delete: `src/controllers/views.ts`

This task touches the Express backend. After each sub-step, run `npm run dev` and verify the endpoint manually with `curl` or the browser.

- [ ] **Step 1: Update `src/router.ts`**

Remove `requireAuth` from the csrf-token route and add `GET /api/me` before the auth wall:

```ts
import { Router } from "express";
import AddParticipationController from "./controllers/addParticipation";
import AnalyzeCSVController from "./controllers/analyzeCSV";
import AuthController from "./controllers/auth";
import JobsController from "./controllers/jobs";
import RegisterUsersController from "./controllers/registerUsers";
import { generateToken } from "./csrf";
import { requireAuth } from "./middleware/requireAuth";

const router = Router()

router.use("/login", AuthController)

// Public: CSRF token needed by login form before authentication
router.get("/api/csrf-token", (req, res) => {
  const token = generateToken(req, res)
  res.json({ token })
})

// Public: SPA checks this on mount to decide whether to show login form
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

Note: `ViewsController` is removed — its EJS routes are replaced by the SPA.

- [ ] **Step 2: Update `src/controllers/auth.ts`**

Remove the `GET /` EJS handler and change `POST /` to return JSON:

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

Return 401 JSON for fetch/XHR requests so the SPA can detect session expiry:

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

- [ ] **Step 4: Update `src/index.ts`**

Replace legacy static serving with `frontend/dist/` and add SPA catch-all. Remove EJS view engine setup:

Replace lines 95–100 (the old static + view engine setup) with:

```ts
// Serve Vite-built frontend
app.use(express.static(join(__dirname, '../frontend/dist')))
app.use(Rutas)

// SPA catch-all: any non-API GET returns index.html
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../frontend/dist', 'index.html'))
})
```

Remove these two lines entirely (no longer needed after EJS views are deleted):
```ts
app.set('view engine', 'ejs');
app.set("views", join(__dirname, "views"))
```

The final `src/index.ts` after the edit (lines 95 onward):

```ts
// Serve Vite-built frontend
app.use(express.static(join(__dirname, '../frontend/dist')))
app.use(Rutas)

// SPA catch-all: any non-API GET returns index.html
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../frontend/dist', 'index.html'))
})

// Arranque con manejo de errores
app.listen(port, () => {
  console.log(`Servidor iniciado en ${port}`)
}).on('error', (err) => {
  console.error('Error al iniciar servidor:', err)
})
```

- [ ] **Step 5: Delete `src/controllers/views.ts`**

```bash
rm src/controllers/views.ts
```

- [ ] **Step 6: Verify backend compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Verify new endpoints manually**

Start backend: `npm run dev`

```bash
# Should return { authenticated: false } without a session cookie
curl http://localhost:9995/api/me

# Should return a CSRF token without needing auth
curl http://localhost:9995/api/csrf-token
```

- [ ] **Step 8: Commit**

```bash
git add src/router.ts src/controllers/auth.ts src/middleware/requireAuth.ts src/index.ts
git rm src/controllers/views.ts
git commit -m "feat: add GET /api/me, fix csrf-token auth, convert login to JSON API"
```

---

## Task 4: App Shell

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/main.tsx`**

```tsx
import { render } from 'preact'
import App from './App'

render(<App />, document.getElementById('root')!)
```

- [ ] **Step 2: Create `frontend/src/App.tsx`**

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

- [ ] **Step 3: Add TypeScript env declaration**

Create `frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 4: Verify Vite dev server starts**

In a second terminal (with Express already running on 9995):

```bash
cd frontend && pnpm run dev
```

Expected: Vite starts on http://localhost:5173. Browser shows "Cargando..." then nothing yet (Login and steps not created). No TypeScript errors in terminal.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add App shell with auth gate and version footer"
```

---

## Task 5: Login Component

**Files:**
- Create: `frontend/src/components/Login.tsx`

- [ ] **Step 1: Create `frontend/src/components/Login.tsx`**

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
        {error && (
          <p role="alert" style={{ color: 'red', marginTop: '8px' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: '16px', padding: '8px 16px' }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify login in browser**

With both servers running (Express on 9995, Vite on 5173), open http://localhost:5173.

- Browser shows the login form
- Submit with wrong credentials → red error message
- Submit with correct credentials (from `.env`) → no error, "Cargando..." then blank page (UploadStep not created yet — normal)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Login.tsx
git commit -m "feat: add Login component with CSRF token handling"
```

---

## Task 6: UploadStep

**Files:**
- Create: `frontend/src/components/steps/UploadStep.tsx`

- [ ] **Step 1: Create `frontend/src/components/steps/UploadStep.tsx`**

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

After login, the upload form appears. Upload a valid CSV → should advance to mapping step (which shows nothing yet — normal). Upload a non-CSV file → error message appears.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/steps/UploadStep.tsx
git commit -m "feat: add UploadStep with CSV analysis and CSRF retry"
```

---

## Task 7: MappingStep

**Files:**
- Create: `frontend/src/components/steps/MappingStep.tsx`

- [ ] **Step 1: Create `frontend/src/components/steps/MappingStep.tsx`**

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
  const initialMapping = Object.fromEntries(fields.map(f => [f.name, '']))
  const [localMapping, setLocalMapping] = useState<Record<string, string>>(initialMapping)
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
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify(localMapping),
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token,
          },
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
      <p>Asigna cada campo CMS a su columna en el CSV. Los marcados con * son requeridos.</p>

      {fields.map(field => (
        <div key={field.name} style={{ marginTop: '10px' }}>
          <label for={`field-${field.name}`}>
            {field.label}{field.required ? ' *' : ''}
          </label>
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
            {columns.value.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      ))}

      {error && <p role="alert" style={{ color: 'red', marginTop: '8px' }}>{error}</p>}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => { wizardStep.value = 'upload' }}
          disabled={loading}
        >
          Volver
        </button>
        <button
          onClick={handleSend}
          disabled={loading}
          style={{ padding: '8px 16px' }}
        >
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

After uploading a CSV, the mapping step shows one select per field, populated with CSV columns. Required fields (*) are labeled. Submitting without filling required fields shows an error. Submitting correctly advances to the processing step (nothing shown yet — normal).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/steps/MappingStep.tsx
git commit -m "feat: add MappingStep with field assignment and validation"
```

---

## Task 8: ProcessingStep

**Files:**
- Create: `frontend/src/components/steps/ProcessingStep.tsx`

- [ ] **Step 1: Create `frontend/src/components/steps/ProcessingStep.tsx`**

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
        // Download failure is non-fatal; job still completed
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
      setError('Error de conexión con el servidor. El job puede seguir ejecutándose.')
    }

    return () => source.close()
  }, []) // jobId won't change while on this step

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
        <h2>Error en el procesamiento</h2>
        <p role="alert" style={{ color: 'red' }}>{error}</p>
        <button onClick={() => { wizardStep.value = 'mapping' }}>
          Volver al mapeo
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>3 — Procesando</h2>
      <p>
        {total > 0
          ? `Procesando ${processed} de ${total} registros`
          : 'Iniciando...'}
      </p>
      <progress
        value={percent}
        max={100}
        style={{ width: '100%', marginTop: '8px' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Complete the full flow: login → upload CSV → map columns → submit. The processing step should show a progress bar that fills as records are processed, then auto-advance to done and trigger a CSV download.

Open DevTools → Network → filter by `events` to confirm the SSE connection opens and receives `progress` and `done` events.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/steps/ProcessingStep.tsx
git commit -m "feat: add ProcessingStep with SSE progress and blob download"
```

---

## Task 9: DoneStep

**Files:**
- Create: `frontend/src/components/steps/DoneStep.tsx`

- [ ] **Step 1: Create `frontend/src/components/steps/DoneStep.tsx`**

```tsx
import { authStatus, columns, jobId, mapping, mode, wizardStep } from '../../signals'

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
        <button onClick={resetWizard} style={{ padding: '8px 16px' }}>
          Nueva carga
        </button>
        <button
          onClick={() => { window.location.href = '/logout' }}
          style={{ padding: '8px 16px' }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify full flow in browser**

Complete the full happy path:
1. Open http://localhost:5173
2. Login with admin credentials
3. Upload a CSV with at least one data row
4. Map at least the required fields
5. Confirm progress bar appears and advances
6. Confirm CSV is downloaded automatically
7. Confirm "Operación completada" screen appears
8. Click "Nueva carga" → returns to upload form
9. Click "Cerrar sesión" → redirects to login form

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/steps/DoneStep.tsx
git commit -m "feat: add DoneStep with reset and logout"
```

---

## Task 10: Remove Legacy Files

**Files:**
- Delete: all files listed below

- [ ] **Step 1: Delete legacy HTML, JS, and EJS files**

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

- [ ] **Step 2: Remove EJS dependency from root `package.json`**

Remove `"ejs": "^5.0.1"` from `dependencies` and `"@types/ejs"` from `devDependencies` (if present).

Run:
```bash
pnpm remove ejs
```

- [ ] **Step 3: Remove copy-files script**

In the root `package.json`, the `copy-files` script copies `.ejs` and static assets to `dist/` — this is no longer needed. Remove it and update `build` to not call it:

Before:
```json
"copy-files": "copyfiles -u 1 src/**/*.html src/**/*.css src/**/*.ejs dist/",
"build": "pnpm run clean && pnpm exec tsc && pnpm run copy-files",
```

After (update `build`, remove `copy-files`):
```json
"build": "pnpm run clean && pnpm exec tsc",
```

`copyfiles` can also be removed if it's only used for this script:
```bash
pnpm remove copyfiles
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove legacy frontend files and EJS dependency"
```

---

## Task 11: Root Package Scripts and Frontend Build Integration

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Update root `package.json` scripts**

```json
{
  "scripts": {
    "clean": "rimraf dist/",
    "dev:backend": "ts-node src/index.ts",
    "dev:frontend": "cd frontend && pnpm run dev",
    "dev": "echo 'Run dev:backend and dev:frontend in separate terminals'",
    "build:backend": "pnpm run clean && pnpm exec tsc",
    "build:frontend": "cd frontend && pnpm run build",
    "build": "pnpm run build:backend && pnpm run build:frontend",
    "start": "pnpm run build && node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Verify production build**

```bash
pnpm run build
```

Expected:
- `dist/` contains compiled TypeScript backend
- `frontend/dist/` contains `index.html`, `assets/` with hashed JS/CSS files

- [ ] **Step 3: Verify production server serves the SPA**

```bash
node dist/index.js
```

Open http://localhost:9995 — should show the Preact login form (no Vite involved).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: update root scripts for dual build (backend + frontend)"
```

---

## Task 12: Automated Versioning (Husky + semantic-release)

**Files:**
- Create: `.husky/commit-msg`
- Create: `.husky/pre-push`
- Create: `.commitlintrc.json`
- Create: `.releaserc.json`
- Modify: `package.json` (root devDependencies)

- [ ] **Step 1: Install versioning devDependencies**

```bash
pnpm add -D husky @commitlint/cli @commitlint/config-conventional semantic-release @semantic-release/changelog @semantic-release/git
```

- [ ] **Step 2: Initialize Husky**

```bash
pnpm exec husky init
```

Expected: `.husky/` directory created with a default `pre-commit` file.

- [ ] **Step 3: Create `.husky/commit-msg`**

```bash
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
chmod +x .husky/commit-msg
```

- [ ] **Step 4: Create `.husky/pre-push`**

```bash
echo 'npx semantic-release --no-ci' > .husky/pre-push
chmod +x .husky/pre-push
```

Remove the default `.husky/pre-commit` if it was created empty:
```bash
rm -f .husky/pre-commit
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
    ["@semantic-release/changelog", {
      "changelogFile": "CHANGELOG.md"
    }],
    ["@semantic-release/npm", {
      "npmPublish": false
    }],
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }]
  ]
}
```

- [ ] **Step 7: Add `prepare` script to root `package.json` for Husky auto-install**

In the root `package.json` scripts, add:
```json
"prepare": "husky"
```

- [ ] **Step 8: Verify commitlint works**

```bash
echo "invalid commit message" | npx commitlint
```

Expected: error output — "subject may not be empty" or similar.

```bash
echo "feat: add login component" | npx commitlint
```

Expected: exits 0 with no error output.

- [ ] **Step 9: Commit**

```bash
git add .husky/ .commitlintrc.json .releaserc.json package.json pnpm-lock.yaml
git commit -m "chore: add Husky, commitlint, and semantic-release"
```

---

## Task 13: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add or update the following sections in `README.md`**

Add these sections (integrate with existing content, do not replace sections that describe the backend):

````markdown
## Stack

**Backend:** Express 5, TypeScript, express-session, csrf-csrf, multer, csv, p-limit
**Frontend:** Preact 10, @preact/signals, Vite 6, TypeScript

## Setup

```bash
# Install backend dependencies
pnpm install

# Install frontend dependencies
cd frontend && pnpm install && cd ..
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

Open http://localhost:5173 in your browser.

## Build

```bash
pnpm run build
```

Compiles TypeScript backend to `dist/` and builds Preact SPA to `frontend/dist/`. The Express server serves `frontend/dist/` as static files.

## Production

```bash
pnpm start
```

Builds everything and starts Express on `PORT` (default 9995).

## Versioning

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/) for automated versioning.

### Commit format

```
feat: add something new         → minor version bump (0.x.0)
fix: correct a bug              → patch version bump (0.0.x)
feat!: breaking change          → major version bump (x.0.0)
chore: update deps              → no release
docs: update README             → no release
```

### Release flow

Husky enforces commit message format on every `git commit`. On `git push origin main`, semantic-release automatically:

1. Reads commits since the last tag
2. Bumps the version in `package.json`
3. Generates / updates `CHANGELOG.md`
4. Creates a git tag (e.g. `v1.2.0`)
5. Pushes the tag

If there are no releasable commits (only `chore:` or `docs:`), no release is created and the push proceeds normally.

The current version is shown in the footer of the web app.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with Preact stack, dev workflow, and versioning guide"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Preact SPA replacing all legacy frontend | Tasks 4–9 |
| Vite build to `frontend/dist/` | Task 1 |
| Express serves `frontend/dist/` as static | Task 3 Step 4 |
| Dev proxy from Vite to Express | Task 1 Step 3 |
| Preact Signals global state | Task 2 |
| Login component with CSRF | Task 5 |
| UploadStep with POST /analyzeCSV | Task 6 |
| MappingStep with POST /registerUsers or /addParticipation | Task 7 |
| ProcessingStep with SSE + blob download | Task 8 |
| DoneStep with reset and logout | Task 9 |
| Version visible in footer | Task 4 Step 2 |
| GET /api/me new endpoint | Task 3 Step 1 |
| csrf-token public (no requireAuth) | Task 3 Step 1 |
| auth.ts returns JSON | Task 3 Step 2 |
| requireAuth returns 401 for JSON | Task 3 Step 3 |
| Legacy files deleted | Task 10 |
| Husky + commitlint + semantic-release | Task 12 |
| README updated | Task 13 |

All spec requirements covered. ✓

### Placeholder scan

No TBDs, no "implement later", no incomplete steps. All code blocks are complete. ✓

### Type consistency

- `AuthStatus`, `WizardStep`, `Mode` defined in `signals.ts` (Task 2) and imported in components (Tasks 4–9) ✓
- `fieldsConfig` keyed by `'users' | 'contest'` matching `Mode` type ✓
- `retryCsrf()` helper duplicated in UploadStep and MappingStep intentionally (each component is self-contained) ✓
- `jobId.value` used as `string` in ProcessingStep after being set as `string` in MappingStep ✓
