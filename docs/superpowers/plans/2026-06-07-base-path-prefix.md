# Base Path Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `VITE_BASE_PATH` env var so the app can be deployed at a sub-path (e.g. `/cms/`) behind a path-stripping reverse proxy without code changes.

**Architecture:** Vite's `base` option is set from `VITE_BASE_PATH` at build time, which prefixes all asset URLs in `index.html` and exposes the value as `import.meta.env.BASE_URL` in the bundle. A single `apiUrl()` helper in `client/src/api.ts` prefixes all fetch/EventSource URLs with that base. Express is unchanged — the reverse proxy strips the prefix before forwarding.

**Tech Stack:** Vite 5, Preact, TypeScript, Express 5

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `vite.config.ts` | Add `base` from `VITE_BASE_PATH` |
| Create | `client/src/api.ts` | New `apiUrl()` helper |
| Modify | `client/src/App.tsx` | Use `apiUrl()` for 2 fetch calls |
| Modify | `client/src/components/Login.tsx` | Use `apiUrl()` for 2 fetch calls |
| Modify | `client/src/components/steps/UploadStep.tsx` | Use `apiUrl()` for 3 fetch calls |
| Modify | `client/src/components/steps/MappingStep.tsx` | Use `apiUrl()` for 3 fetch calls |
| Modify | `client/src/components/steps/ProcessingStep.tsx` | Use `apiUrl()` for 1 EventSource + 1 fetch |
| Modify | `.env.example` | Document `VITE_BASE_PATH` |

---

## Task 1: Add `base` to Vite config

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add the `base` option**

In `vite.config.ts`, add `base` to the `defineConfig` object:

```ts
export default defineConfig({
  root: 'client',
  plugins: [preact()],
  base: process.env.VITE_BASE_PATH ?? '/',   // ← add this line
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  // ... rest unchanged
})
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: read VITE_BASE_PATH as Vite base option"
```

---

## Task 2: Create `apiUrl` helper

**Files:**
- Create: `client/src/api.ts`

- [ ] **Step 1: Create the file**

```ts
export function apiUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
```

`import.meta.env.BASE_URL` is always trailing-slash-terminated by Vite (e.g. `/` or `/cms/`). Stripping the leading slash from `path` before concatenating avoids double slashes:
- default: `/` + `api/csrf-token` → `/api/csrf-token` ✓
- prefixed: `/cms/` + `api/csrf-token` → `/cms/api/csrf-token` ✓

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/api.ts
git commit -m "feat: add apiUrl helper for base-path-aware fetch URLs"
```

---

## Task 3: Update `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`

Current fetch calls (lines 10 and 18):
```ts
const res = await fetch('/api/csrf-token')
// ...
fetch('/api/me')
```

- [ ] **Step 1: Import `apiUrl` and update fetch calls**

Replace the top of `App.tsx`:

```ts
import { useEffect } from 'preact/hooks'
import { authStatus, csrfToken, wizardStep } from './signals'
import { apiUrl } from './api'
import Login from './components/Login'
import UploadStep from './components/steps/UploadStep'
import MappingStep from './components/steps/MappingStep'
import ProcessingStep from './components/steps/ProcessingStep'
import DoneStep from './components/steps/DoneStep'

async function loadCsrfToken() {
  const res = await fetch(apiUrl('/api/csrf-token'))
  if (!res.ok) return
  const body = await res.json() as { token: string }
  csrfToken.value = body.token
}

export default function App() {
  useEffect(() => {
    fetch(apiUrl('/api/me'))
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

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: use apiUrl in App.tsx"
```

---

## Task 4: Update `Login.tsx`

**Files:**
- Modify: `client/src/components/Login.tsx`

Current fetch calls (lines 5 and 23):
```ts
const res = await fetch('/api/csrf-token')
// ...
const res = await fetch('/login', { ... })
```

- [ ] **Step 1: Import `apiUrl` and update fetch calls**

Replace the full file content:

```ts
import { useState } from 'preact/hooks'
import { authStatus, csrfToken } from '../signals'
import { apiUrl } from '../api'

async function refreshCsrfToken() {
  const res = await fetch(apiUrl('/api/csrf-token'))
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
      const res = await fetch(apiUrl('/login'), {
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

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Login.tsx
git commit -m "feat: use apiUrl in Login.tsx"
```

---

## Task 5: Update `UploadStep.tsx`

**Files:**
- Modify: `client/src/components/steps/UploadStep.tsx`

Current fetch calls (lines 6, 29, 37):
```ts
const res = await fetch('/api/csrf-token')
let res = await fetch('/analyzeCSV', { ... })
res = await fetch('/analyzeCSV', { ... })   // retry
```

- [ ] **Step 1: Import `apiUrl` and update fetch calls**

Replace the full file content:

```ts
import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, wizardStep } from '../../signals'
import type { Mode } from '../../signals'
import { apiUrl } from '../../api'

async function retryCsrf(): Promise<string> {
  const res = await fetch(apiUrl('/api/csrf-token'))
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
      let res = await fetch(apiUrl('/analyzeCSV'), {
        method: 'POST',
        headers: { 'x-csrf-token': token },
        body: formData,
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch(apiUrl('/analyzeCSV'), {
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

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/UploadStep.tsx
git commit -m "feat: use apiUrl in UploadStep.tsx"
```

---

## Task 6: Update `MappingStep.tsx`

**Files:**
- Modify: `client/src/components/steps/MappingStep.tsx`

Current fetch calls (lines 6, 33, 41):
```ts
const res = await fetch('/api/csrf-token')
let res = await fetch(endpoint, { ... })   // endpoint is '/registerUsers' or '/addParticipation'
res = await fetch(endpoint, { ... })       // retry
```

- [ ] **Step 1: Import `apiUrl` and update fetch calls**

Replace the full file content:

```ts
import { useState } from 'preact/hooks'
import { csrfToken, columns, mode, mapping, jobId, wizardStep } from '../../signals'
import { fieldsConfig } from '../../config'
import { apiUrl } from '../../api'

async function retryCsrf(): Promise<string> {
  const res = await fetch(apiUrl('/api/csrf-token'))
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
      let res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify(localMapping),
      })

      if (res.status === 403) {
        token = await retryCsrf()
        res = await fetch(apiUrl(endpoint), {
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

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/MappingStep.tsx
git commit -m "feat: use apiUrl in MappingStep.tsx"
```

---

## Task 7: Update `ProcessingStep.tsx`

**Files:**
- Modify: `client/src/components/steps/ProcessingStep.tsx`

Current URL calls (lines 33 and 47):
```ts
const source = new EventSource(`/jobs/${currentJobId}/events`)
const res = await fetch(`/jobs/${currentJobId}/result`)
```

- [ ] **Step 1: Import `apiUrl` and update URL calls**

Replace the full file content:

```ts
import { useEffect, useState } from 'preact/hooks'
import { jobId, mode, wizardStep } from '../../signals'
import { apiUrl } from '../../api'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 100 ms gives Firefox time to initiate the async download before the blob URL is freed
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export default function ProcessingStep() {
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId.value) {
      wizardStep.value = 'mapping'
    }
  }, [])

  useEffect(() => {
    const currentJobId = jobId.value
    if (!currentJobId) return

    let closed = false
    const source = new EventSource(apiUrl(`/jobs/${currentJobId}/events`))

    source.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { processed: number; total: number; percent: number }
      setProcessed(data.processed)
      setTotal(data.total)
      setPercent(data.percent)
    })

    source.addEventListener('done', async () => {
      closed = true
      source.close()
      const filename = mode.value === 'users' ? 'Resultados usuarios.csv' : 'Errores concurso.csv'
      try {
        const res = await fetch(apiUrl(`/jobs/${currentJobId}/result`))
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
      closed = true
      source.close()
      const data = JSON.parse(e.data) as { message?: string }
      setError(data.message ?? 'Error interno en el procesamiento')
    })

    source.onerror = () => {
      if (closed) return
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

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/ProcessingStep.tsx
git commit -m "feat: use apiUrl in ProcessingStep.tsx"
```

---

## Task 8: Document `VITE_BASE_PATH` in `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the new variable under the `── Server ──` section**

After the `PORT` line, add:

```
VITE_BASE_PATH=/      # sub-path prefix when not served at domain root (build-time), e.g. /cms
```

The full Server section should look like:

```
# ── Server ────────────────────────────────────────────────────────────────────
PORT=9995               # optional, defaults to 9995
NODE_ENV=production     # set in production
VITE_BASE_PATH=/        # sub-path prefix when not served at domain root (build-time), e.g. /cms
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document VITE_BASE_PATH in .env.example"
```

---

## Task 9: Manual smoke test

No automated test suite exists. Verify correctness by running the dev server (default `VITE_BASE_PATH=/`) and confirming unchanged behavior, then do a prefixed build.

- [ ] **Step 1: Run dev server and confirm normal behavior**

```bash
npm run dev
```

Open `http://localhost:5173`. Log in, upload a CSV, complete the full wizard. All requests should hit `/api/...`, `/analyzeCSV`, etc. at root — same as before.

- [ ] **Step 2: Build with a sub-path prefix and inspect output**

```bash
VITE_BASE_PATH=/cms npm run build
```

Open `client/dist/index.html` and confirm asset tags use `/cms/` prefix:

```bash
grep 'src=' client/dist/index.html
```

Expected output contains paths like `/cms/assets/index-xxx.js`.

- [ ] **Step 3: Confirm default build is unaffected**

```bash
npm run build
grep 'src=' client/dist/index.html
```

Expected: paths use `/assets/...` (no prefix). Behavior identical to pre-change.

- [ ] **Step 4: Final commit (if any cleanup needed)**

If step 1-3 pass with no issues, the implementation is complete. No further commit needed.
