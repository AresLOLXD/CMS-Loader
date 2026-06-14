# Sub-project C: Async Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocking HTTP-wait pattern with an async job model: controllers return `{ jobId }` immediately, processing runs in background via p-limit, and the browser streams progress via SSE.

**Architecture:** `JobStore` (in-memory singleton) holds records + results. `analyzeCSV` creates the job and stores `activeJobId` in session. `registerUsers`/`addParticipation` retrieve the job, start p-limit processing in the background, and return `{ jobId }` immediately. `GET /jobs/:id/events` SSE polls JobStore every 200ms. `GET /jobs/:id/result` serves the finished CSV. `buildCmsCommand` abstracts the CMS CLI path for container vs bare-metal.

**Tech Stack:** TypeScript, Express 5, p-limit 6.x (new), existing deps only otherwise.

---

## File Map

| File | Action |
|------|--------|
| `src/utils/buildCmsCommand.ts` | Create — CMS command builder (container vs bare-metal) |
| `src/utils/index.ts` | Modify — re-export buildCmsCommand |
| `src/jobs/JobStore.ts` | Create — in-memory job store with TTL cleanup |
| `src/controllers/analyzeCSV.ts` | Modify — store records in JobStore, return `{ jobId, columnas }` |
| `src/controllers/views.ts` | Modify — read columnas from JobStore instead of session |
| `src/index.ts` | Modify — update SessionData, start JobStore TTL, import jobStore |
| `src/controllers/jobs.ts` | Create — SSE progress stream + result CSV download |
| `src/router.ts` | Modify — mount `/jobs` routes |
| `src/controllers/registerUsers.ts` | Modify — get job, run async p-limit, return `{ jobId }` |
| `src/controllers/addParticipation.ts` | Modify — same |
| `src/public/js/csvUploader.js` | Modify — replace submitSelectionForm blob-wait with SSE + download |
| `src/public/js/seleccionaColumnasUser.js` | Modify — pass progressId to initSelectionForm |
| `src/public/js/seleccionaColumnasConcurso.js` | Modify — same |
| `src/views/seleccionaColumnasUser.ejs` | Modify — add progress bar section |
| `src/views/seleccionaColumnasConcurso.ejs` | Modify — same |
| `.env.example` | Modify — document CMS_ENV_SCRIPT and CMS_CONCURRENCY |
| `package.json` | Modify — add p-limit dependency |

---

## Task 1: Create `buildCmsCommand` utility

**Files:**
- Create: `src/utils/buildCmsCommand.ts`
- Modify: `src/utils/index.ts`
- Modify: `src/controllers/registerUsers.ts`
- Modify: `src/controllers/addParticipation.ts`

### Context

Both controllers hardcode `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ...`. In a Docker container the tool is already on PATH — no sourcing needed. `buildCmsCommand` checks `CMS_ENV_SCRIPT` env var: if set, prepends the source command; if unset, just runs the tool directly. The `shellescape` + `.replace(/'""'/g, '""')` logic moves here (the replace is the intentional empty-string-arg workaround documented in CLAUDE.md).

- [ ] **Create `src/utils/buildCmsCommand.ts`:**

```ts
import shellescape from "shell-escape"

export function buildCmsCommand(tool: 'cmsAddUser' | 'cmsAddParticipation', args: string[]): string {
    const escaped = shellescape(args).replace(/'""'/g, '""')
    const envScript = process.env.CMS_ENV_SCRIPT
    if (envScript) {
        return `. ${shellescape([envScript])} && ${tool} ${escaped}`
    }
    return `${tool} ${escaped}`
}
```

- [ ] **Add re-export to `src/utils/index.ts`:**

Read the file, then add:
```ts
export * from "./buildCmsCommand"
```

- [ ] **Update `src/controllers/registerUsers.ts`**

Read the file. Make two changes:

1. Remove `shellescape` from imports (no longer needed directly).
2. Add `buildCmsCommand` to the utils import.
3. Replace the command construction line:
```ts
// OLD:
const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ${shellescape(argumentos)}`.replace(/'""'/g, `""`)
// NEW:
const commando = buildCmsCommand('cmsAddUser', argumentos)
```

- [ ] **Update `src/controllers/addParticipation.ts`**

Read the file. Same two changes:

1. Remove `shellescape` from imports.
2. Add `buildCmsCommand` to the utils import.
3. Replace the command construction line:
```ts
// OLD:
const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddParticipation ${shellescape(argumentos)}`.replace(/'""'/g, `""`)
// NEW:
const commando = buildCmsCommand('cmsAddParticipation', argumentos)
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Run tests to verify no regressions**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm test 2>&1 | tail -5
```

Expected: 47 passed.

- [ ] **Commit**

```bash
git add src/utils/buildCmsCommand.ts src/utils/index.ts src/controllers/registerUsers.ts src/controllers/addParticipation.ts
git commit -m "feat: add buildCmsCommand utility, remove hardcoded CMS CLI path from controllers"
```

---

## Task 2: Create `JobStore` singleton

**Files:**
- Create: `src/jobs/JobStore.ts`

### Context

`JobStore` is a module-level singleton. `create()` generates a UUID, stores the job object in a Map, and returns it. `get()` returns the reference (callers can mutate `processed` and `results` directly — Node.js single-threaded, safe). `update()` uses `Object.assign` for status changes. `startTtlCleanup()` starts a `setInterval` that removes jobs older than 1 hour; called once at server startup.

The `filename` field is set by the processing controller when it claims the job (registerUsers → "Resultados.csv", addParticipation → "Errores.csv").

- [ ] **Create `src/jobs/` directory and `src/jobs/JobStore.ts`:**

```ts
import { randomUUID } from "crypto"
import { CSVRecord } from "../utils"

interface Job {
    id: string
    status: 'pending' | 'running' | 'done' | 'error'
    total: number
    processed: number
    records: CSVRecord[]
    results: { Indice: number; Extra: string }[]
    columnas: string[]
    filename: string
    createdAt: Date
}

class JobStore {
    private jobs = new Map<string, Job>()

    create(records: CSVRecord[], columnas: string[]): Job {
        const id = randomUUID()
        const job: Job = {
            id,
            status: 'pending',
            total: records.length,
            processed: 0,
            records,
            results: [],
            columnas,
            filename: '',
            createdAt: new Date(),
        }
        this.jobs.set(id, job)
        return job
    }

    get(id: string): Job | undefined {
        return this.jobs.get(id)
    }

    update(id: string, patch: Partial<Job>): void {
        const job = this.jobs.get(id)
        if (job) Object.assign(job, patch)
    }

    delete(id: string): void {
        this.jobs.delete(id)
    }

    startTtlCleanup(): void {
        setInterval(() => {
            const cutoff = new Date(Date.now() - 60 * 60 * 1000)
            for (const [id, job] of this.jobs) {
                if (job.createdAt < cutoff) {
                    this.jobs.delete(id)
                }
            }
        }, 10 * 60 * 1000)
    }
}

export const jobStore = new JobStore()
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/jobs/JobStore.ts
git commit -m "feat: add in-memory JobStore singleton with TTL cleanup"
```

---

## Task 3: Update `analyzeCSV`, `views.ts`, `SessionData`, and start TTL

**Files:**
- Modify: `src/controllers/analyzeCSV.ts`
- Modify: `src/controllers/views.ts`
- Modify: `src/index.ts`

### Context

**analyzeCSV** currently stores records/columnas in `req.session`. In the new flow it creates a job in `JobStore` and sets `req.session.activeJobId`. The response adds `jobId` to `data` (keeps `columnas` for backward compat with the integration test which checks `res.body.data.columnas`).

**views.ts** currently reads `req.session.registros` and `req.session.columnas`. In the new flow it reads from `JobStore` via `req.session.activeJobId`.

**index.ts** `SessionData` loses `registros` and `columnas`, gains `activeJobId?: string`. Also calls `jobStore.startTtlCleanup()` once.

- [ ] **Modify `src/controllers/analyzeCSV.ts`**

Read the file. Make these changes:

1. Add import for jobStore:
```ts
import { jobStore } from "../jobs/JobStore"
```

2. Replace the session-storage block and response:
```ts
// OLD:
req.session.registros = registros;
req.session.columnas = columnasFinales;
if (req.session.saveAsync) {
    await req.session.saveAsync();
}
res.json({ success: true, message: "CSV procesado", data: { columnas: columnasFinales } });

// NEW:
const job = jobStore.create(registros, columnasFinales)
req.session.activeJobId = job.id
if (req.session.saveAsync) {
    await req.session.saveAsync()
}
res.json({ success: true, message: "CSV procesado", data: { jobId: job.id, columnas: columnasFinales } })
```

3. Remove the `CSVRecord` import from `../utils` if it is no longer used directly in this file after the change (check — it's still used in the `parse()` cast on line 41, so keep it).

- [ ] **Modify `src/controllers/views.ts`**

Read the file. Replace both route handlers:

```ts
import { Request, Response, Router } from "express"
import { generateToken } from "../csrf"
import { jobStore } from "../jobs/JobStore"

const router = Router()

router.get("/seleccionaColumnasUser", (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.redirect("cargaUsuarios.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasUser.ejs", { columnas: job.columnas, csrfToken })
})

router.get("/seleccionaColumnasConcurso", (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.redirect("cargaConcurso.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasConcurso.ejs", { columnas: job.columnas, csrfToken })
})

export default router
```

- [ ] **Modify `src/index.ts`**

Read the file. Make three changes:

1. Update `SessionData` declaration — remove `registros` and `columnas`, add `activeJobId`:
```ts
// OLD:
declare module "express-session" {
    interface SessionData {
        registros: CSVRecord[],
        columnas: string[],
        authenticated?: boolean,
        saveAsync: () => Promise<void>
    }
}

// NEW:
declare module "express-session" {
    interface SessionData {
        authenticated?: boolean,
        activeJobId?: string,
        saveAsync: () => Promise<void>
    }
}
```

2. Remove the `CSVRecord` import from `"./utils"` (no longer needed in index.ts).

3. Add jobStore import and TTL startup call right after `validateEnv()`:
```ts
import { jobStore } from "./jobs/JobStore"
// ...after validateEnv():
jobStore.startTtlCleanup()
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Run tests**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm test 2>&1 | tail -5
```

Expected: 47 passed (integration test still passes because `res.body.data.columnas` is still present).

- [ ] **Commit**

```bash
git add src/controllers/analyzeCSV.ts src/controllers/views.ts src/index.ts
git commit -m "feat: store CSV records in JobStore, update SessionData, start TTL cleanup"
```

---

## Task 4: Create `jobs.ts` controller + mount in router

**Files:**
- Create: `src/controllers/jobs.ts`
- Modify: `src/router.ts`

### Context

Two routes:

**`GET /jobs/:id/events`** — SSE stream. Sets SSE headers, polls `JobStore` every 200ms. Emits `progress` events on each `processed` change, emits `done` or `error` when job reaches a terminal state, then closes. On client disconnect (`req.on('close')`), clears the interval. The `requireAuth` middleware is inherited from `router.use(requireAuth)` in `router.ts`.

**`GET /jobs/:id/result`** — returns the CSV. 404 if job not found, 409 if not done yet, otherwise streams the result CSV with `Content-Disposition: attachment`.

The EventSource connection from the browser sends cookies, so session auth works automatically.

- [ ] **Create `src/controllers/jobs.ts`:**

```ts
import { stringify } from "csv/sync"
import { Request, Response, Router } from "express"
import { jobStore } from "../jobs/JobStore"

const router = Router()

router.get("/:id/events", (req: Request, res: Response) => {
    const job = jobStore.get(req.params.id)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
        return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()

    let lastProcessed = -1

    const interval = setInterval(() => {
        const current = jobStore.get(req.params.id)
        if (!current) {
            clearInterval(interval)
            res.end()
            return
        }

        if (current.processed !== lastProcessed) {
            lastProcessed = current.processed
            const percent = current.total > 0
                ? Math.round((current.processed / current.total) * 100)
                : 0
            res.write(`event: progress\ndata: ${JSON.stringify({ processed: current.processed, total: current.total, percent })}\n\n`)
        }

        if (current.status === 'done') {
            res.write(`event: done\ndata: ${JSON.stringify({ jobId: current.id, resultCount: current.results.length })}\n\n`)
            clearInterval(interval)
            res.end()
            return
        }

        if (current.status === 'error') {
            res.write(`event: job-error\ndata: ${JSON.stringify({ message: "Error interno" })}\n\n`)
            clearInterval(interval)
            res.end()
        }
    }, 200)

    req.on('close', () => {
        clearInterval(interval)
    })
})

router.get("/:id/result", (req: Request, res: Response) => {
    const job = jobStore.get(req.params.id)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
        return
    }
    if (job.status !== 'done') {
        res.status(409).json({ success: false, message: "Trabajo no completado" })
        return
    }

    const csv = stringify(job.results, { header: true, quoted: true })
    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`)
    res.setHeader("Content-Length", Buffer.byteLength(csv))
    res.end(csv)
})

export default router
```

Note: the server-side error event is named `job-error` (not `event: error`) to avoid collision with EventSource's built-in `onerror` connection event. The frontend listens for `job-error` accordingly.

- [ ] **Mount in `src/router.ts`**

Read the file, then add:
```ts
import JobsController from "./controllers/jobs"
```
And add before `router.use("/", ViewsController)`:
```ts
router.use("/jobs", JobsController)
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/controllers/jobs.ts src/router.ts
git commit -m "feat: add jobs controller (SSE progress + result download), mount /jobs routes"
```

---

## Task 5: Install p-limit, refactor `registerUsers.ts` and `addParticipation.ts` for async job processing

**Files:**
- Modify: `package.json` (install p-limit)
- Modify: `src/controllers/registerUsers.ts`
- Modify: `src/controllers/addParticipation.ts`

### Context

The route handlers now:
1. Get the job from `JobStore` via `req.session.activeJobId` — return 400 if missing
2. Update job status to `'running'` and set the result filename
3. **Immediately return `{ jobId }`** — the HTTP connection is done
4. Start a background `Promise.all` with p-limit concurrency
5. Each task calls `procesaRegistro`, pushes to `job.results`, increments `job.processed`
6. After all tasks: sort results, set status to `'done'`
7. On unexpected failure: set status to `'error'`

`processRecords` from `src/utils` is no longer used by these controllers (it's retained for its unit tests).

**Thread safety note:** `job.processed++` and `job.results.push()` are safe — Node.js is single-threaded; concurrent promises interleave only at `await` points, not mid-increment.

- [ ] **Install p-limit**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm install p-limit@^6
```

Expected: exits 0.

- [ ] **Replace `src/controllers/registerUsers.ts`:**

Read the current file first. Then write:

```ts
import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import pLimit from "p-limit"
import { CSVRecord, buildCmsCommand, executeProcess } from "../utils"
import { jobStore } from "../jobs/JobStore"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })

export async function procesaRegistro(
    {
        registro,
        email,
        timezone,
        languages,
        password,
        nombre,
        apellidos,
        usuario
    }: {
        registro: CSVRecord,
        email?: string,
        timezone?: string,
        languages?: string,
        password?: string,
        nombre: string,
        apellidos: string,
        usuario: string
    }
): Promise<string> {
    const argumentos: string[] = []

    if (email && registro[email]) {
        argumentos.push("-e")
        argumentos.push(registro[email])
    }
    if (timezone && registro[timezone]) {
        argumentos.push("-t")
        argumentos.push(registro[timezone])
    }
    if (languages && registro[languages]) {
        argumentos.push("-l")
        argumentos.push(registro[languages])
    }
    if (password && registro[password]) {
        argumentos.push("-p")
        argumentos.push(registro[password])
    }
    argumentos.push("--bcrypt")

    if (nombre && registro[nombre]) {
        argumentos.push(registro[nombre])
    } else {
        argumentos.push('""')
    }
    if (apellidos && registro[apellidos]) {
        argumentos.push(registro[apellidos])
    } else {
        argumentos.push('""')
    }
    if (usuario && registro[usuario]) {
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    return executeProcess(buildCmsCommand('cmsAddUser', argumentos))
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.status(400).json({ success: false, message: "No hay registros cargados" })
        return
    }

    const { email, timezone, languages, password, nombre, apellidos, usuario } = req.body
    jobStore.update(job.id, { status: 'running', filename: 'Resultados.csv' })
    res.json({ jobId: job.id })

    const limit = pLimit(Number(process.env.CMS_CONCURRENCY) || 5)
    const tasks = job.records.map((registro, i) =>
        limit(async () => {
            try {
                const salida = await procesaRegistro({ registro, email, timezone, languages, password, nombre, apellidos, usuario })
                if (!password || !registro[password]) {
                    const matched = /password\s+(\w+)/.exec(salida)
                    if (!matched) throw new Error(`Revisar usuario ${usuario}, contraseña no se pudo obtener`)
                    job.results.push({ Indice: i + 2, Extra: matched[1] })
                }
            } catch (err) {
                job.results.push({ Indice: i + 2, Extra: err instanceof Error ? err.message : 'Error procesando la fila' })
            } finally {
                job.processed++
            }
        })
    )

    Promise.all(tasks)
        .then(() => {
            job.results.sort((a, b) => a.Indice - b.Indice)
            jobStore.update(job.id, { status: 'done' })
        })
        .catch(() => {
            jobStore.update(job.id, { status: 'error' })
        })
})


export default router
```

- [ ] **Replace `src/controllers/addParticipation.ts`:**

Read the current file first. Then write:

```ts
import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import pLimit from "p-limit"
import { CSVRecord, buildCmsCommand, executeProcess, parseBoolFlag } from "../utils"
import { jobStore } from "../jobs/JobStore"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })


export async function procesaRegistro(
    {
        registro,
        contest,
        ip,
        tiempo_retraso,
        tiempo_extra,
        team,
        oculto,
        sin_restricciones,
        password,
        usuario
    }: {
        registro: CSVRecord,
        usuario: string,
        contest: string,
        ip?: string,
        tiempo_retraso?: string,
        tiempo_extra?: string,
        team?: string,
        oculto?: string,
        sin_restricciones?: string,
        password?: string
    }
): Promise<void> {
    const argumentos: string[] = []

    if (contest && registro[contest]) {
        const contest_numero = Number.parseInt(registro[contest])
        if (Number.isNaN(contest_numero)) {
            throw new Error(`El valor ${registro[contest]} para el concurso no es un valor valido`)
        }
        argumentos.push("-c")
        argumentos.push(contest_numero.toString())
    } else {
        throw new Error("Concurso no definido")
    }

    if (ip && registro[ip]) {
        argumentos.push("-i")
        argumentos.push(registro[ip])
    }

    if (tiempo_retraso && registro[tiempo_retraso]) {
        const n = Number.parseInt(registro[tiempo_retraso])
        if (Number.isNaN(n)) {
            throw new Error(`El valor ${registro[tiempo_retraso]} para tiempo retraso no es un valor valido`)
        }
        argumentos.push("-d")
        argumentos.push(n.toString())
    }

    if (tiempo_extra && registro[tiempo_extra]) {
        const n = Number.parseInt(registro[tiempo_extra])
        if (Number.isNaN(n)) {
            throw new Error(`El valor ${registro[tiempo_extra]} para tiempo extra no es un valor valido`)
        }
        argumentos.push("-e")
        argumentos.push(n.toString())
    }

    if (team && registro[team]) {
        argumentos.push("-t")
        argumentos.push(registro[team])
    }

    if (oculto && registro[oculto]) {
        if (parseBoolFlag(registro[oculto], "oculto")) {
            argumentos.push("--hidden")
        }
    }

    if (sin_restricciones && registro[sin_restricciones]) {
        if (parseBoolFlag(registro[sin_restricciones], "sin restricciones")) {
            argumentos.push("--unrestricted")
        }
    }

    if (password && registro[password]) {
        argumentos.push("-p")
        argumentos.push(registro[password])
        argumentos.push("--bcrypt")
    }

    if (usuario && registro[usuario]) {
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    await executeProcess(buildCmsCommand('cmsAddParticipation', argumentos))
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.status(400).json({ success: false, message: "No hay registros cargados" })
        return
    }

    const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body
    jobStore.update(job.id, { status: 'running', filename: 'Errores.csv' })
    res.json({ jobId: job.id })

    const limit = pLimit(Number(process.env.CMS_CONCURRENCY) || 5)
    const tasks = job.records.map((registro, i) =>
        limit(async () => {
            try {
                await procesaRegistro({ registro, contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario })
            } catch (err) {
                job.results.push({ Indice: i + 2, Extra: err instanceof Error ? err.message : 'Error procesando la fila' })
            } finally {
                job.processed++
            }
        })
    )

    Promise.all(tasks)
        .then(() => {
            job.results.sort((a, b) => a.Indice - b.Indice)
            jobStore.update(job.id, { status: 'done' })
        })
        .catch(() => {
            jobStore.update(job.id, { status: 'error' })
        })
})


export default router
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Run tests**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm test 2>&1 | tail -5
```

Expected: 47 passed. (Unit tests for procesaRegistro still pass — the function signature and logic are unchanged. processRecords unit tests still pass — the utility itself is unchanged.)

- [ ] **Commit**

```bash
git add package.json package-lock.json src/controllers/registerUsers.ts src/controllers/addParticipation.ts
git commit -m "feat: async job processing with p-limit; controllers return jobId immediately"
```

---

## Task 6: Update frontend JavaScript for SSE progress

**Files:**
- Modify: `src/public/js/csvUploader.js`
- Modify: `src/public/js/seleccionaColumnasUser.js`
- Modify: `src/public/js/seleccionaColumnasConcurso.js`

### Context

`submitSelectionForm` in `csvUploader.js` currently awaits a CSV blob response. In the new flow, the server returns `{ jobId }` immediately. The function must:
1. POST form → receive `{ jobId }`
2. Open `EventSource` to `/jobs/${jobId}/events`
3. On `progress` → update progress bar and status text
4. On `done` → fetch `/jobs/${jobId}/result`, trigger blob download, redirect
5. On `job-error` → show error, re-enable button

Note: `EventSource` has its own `onerror` for connection issues (distinct from our `job-error` named event). The function accepts a new optional `progressId` parameter — the id of a container element that wraps the progress bar UI.

The old `submitSelectionForm` signature had `timeoutMs` — that is removed (SSE handles the progress, no abort needed).

`uploadCsv` is unchanged — it just redirects on success, never reads `columnas` from the response body.

- [ ] **Read `src/public/js/csvUploader.js`**, then **replace the `submitSelectionForm` function** (lines 135–209 in the current file) and the `window.initSelectionForm` assignment:

Keep everything before `async function submitSelectionForm` unchanged. Replace `submitSelectionForm` with:

```js
async function submitSelectionForm({
    formId,
    submitId,
    statusId,
    progressId,
    endpoint,
    downloadFilename,
    successRedirect,
}) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        setStatus(statusId, "Enviando...", "info");
        disableButton(submitId);

        const data = {};
        const elements = Array.from(form.elements).filter(
            (el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement
        );
        for (const element of elements) {
            if (element.name) data[element.name.toLowerCase()] = element.value;
        }

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrfToken,
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                let text = "Error en la petición.";
                try {
                    const body = await response.json();
                    if (body?.message) text = body.message;
                } catch (e) {
                    text = `${response.status} ${response.statusText}`;
                }
                throw new Error(text);
            }

            const { jobId } = await response.json();
            setStatus(statusId, "Procesando...", "info");

            const progressEl = progressId ? document.getElementById(progressId) : null;
            const progressCount = document.getElementById("progress-count");
            const progressTotal = document.getElementById("progress-total");
            const progressBar = document.getElementById("progress-bar");
            if (progressEl) progressEl.style.display = "";

            const source = new EventSource(`/jobs/${jobId}/events`);

            source.addEventListener("progress", (e) => {
                const { processed, total, percent } = JSON.parse(e.data);
                setStatus(statusId, `Procesando ${processed} de ${total} registros...`, "info");
                if (progressCount) progressCount.textContent = processed;
                if (progressTotal) progressTotal.textContent = total;
                if (progressBar) { progressBar.value = percent; progressBar.max = 100; }
            });

            source.addEventListener("done", async () => {
                source.close();
                setStatus(statusId, "Descargando resultados...", "info");
                try {
                    const csvRes = await fetch(`/jobs/${jobId}/result`);
                    if (csvRes.ok) {
                        const blob = await csvRes.blob();
                        if (blob.size > 0) downloadBlob(blob, downloadFilename);
                    }
                } catch (e) {
                    console.error("Error descargando resultado:", e);
                }
                setStatus(statusId, "Operación completada.", "success");
                if (progressEl) progressEl.style.display = "none";
                if (successRedirect) window.location.replace(successRedirect);
            });

            source.addEventListener("job-error", (e) => {
                source.close();
                let message = "Error interno";
                try { message = JSON.parse(e.data).message; } catch (ignored) { /* ignore */ }
                setStatus(statusId, `Error: ${message}`, "error");
                if (progressEl) progressEl.style.display = "none";
                enableButton(submitId);
            });

            source.onerror = () => {
                source.close();
                setStatus(statusId, "Error de conexión con el servidor.", "error");
                if (progressEl) progressEl.style.display = "none";
                enableButton(submitId);
            };

        } catch (error) {
            const message = (error instanceof Error ? error.message : "Error de red") || "Error al procesar";
            setStatus(statusId, `Error: ${message}`, "error");
            console.error("submitSelectionForm error:", error);
            enableButton(submitId);
        }
    });
}

window.initCsvUpload = uploadCsv;
window.initSelectionForm = submitSelectionForm;
```

- [ ] **Update `src/public/js/seleccionaColumnasUser.js`** — add `progressId`:

```js
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.initSelectionForm !== "function") {
        console.error("csvUploader module no está cargado");
        return;
    }
    window.initSelectionForm({
        formId: "form",
        submitId: "submit",
        statusId: "status",
        progressId: "progress",
        endpoint: "registerUsers",
        downloadFilename: "Resultados.csv",
        successRedirect: "index.html"
    });
});
```

- [ ] **Update `src/public/js/seleccionaColumnasConcurso.js`** — add `progressId`:

```js
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.initSelectionForm !== "function") {
        console.error("csvUploader module no está cargado");
        return;
    }
    window.initSelectionForm({
        formId: "form",
        submitId: "submit",
        statusId: "status",
        progressId: "progress",
        endpoint: "addParticipation",
        downloadFilename: "Errores.csv",
        successRedirect: "index.html"
    });
});
```

- [ ] **Commit**

```bash
git add src/public/js/csvUploader.js src/public/js/seleccionaColumnasUser.js src/public/js/seleccionaColumnasConcurso.js
git commit -m "feat: replace blob-wait pattern with SSE progress stream in submitSelectionForm"
```

---

## Task 7: Add progress bar UI to EJS templates

**Files:**
- Modify: `src/views/seleccionaColumnasUser.ejs`
- Modify: `src/views/seleccionaColumnasConcurso.ejs`

### Context

The progress bar section is hidden by default (`display:none`). The JS shows it once the job starts. The `progress-count`, `progress-total`, and `progress-bar` IDs match what `submitSelectionForm` looks for. The `id="progress"` matches the `progressId` passed from the JS files.

- [ ] **Add progress bar to `src/views/seleccionaColumnasUser.ejs`**

Read the file. Add after `<div id="status" ...>` and before the first `<script>` tag:

```html
    <div id="progress" style="display:none" aria-live="polite" style="margin-top:1rem;">
        <p>Procesando: <span id="progress-count">0</span> / <span id="progress-total">0</span> registros</p>
        <progress id="progress-bar" value="0" max="100" style="width:100%"></progress>
    </div>
```

- [ ] **Add progress bar to `src/views/seleccionaColumnasConcurso.ejs`**

Same change — add after `<div id="status" ...>` and before the first `<script>` tag:

```html
    <div id="progress" style="display:none" aria-live="polite" style="margin-top:1rem;">
        <p>Procesando: <span id="progress-count">0</span> / <span id="progress-total">0</span> registros</p>
        <progress id="progress-bar" value="0" max="100" style="width:100%"></progress>
    </div>
```

- [ ] **Commit**

```bash
git add src/views/seleccionaColumnasUser.ejs src/views/seleccionaColumnasConcurso.ejs
git commit -m "feat: add progress bar UI to column selection templates"
```

---

## Task 8: Update `.env.example`, run full build and test suite

**Files:**
- Modify: `.env.example`

- [ ] **Read `.env.example`** and add the missing vars. The final file should be:

```bash
# ── Required ──────────────────────────────────────────────────────────────────
SESSION_SECRET=         # 32+ random chars, required — no default

# ── Auth ──────────────────────────────────────────────────────────────────────
ADMIN_USER=admin
ADMIN_PASSWORD=         # required

# ── Server ────────────────────────────────────────────────────────────────────
PORT=9995               # optional, defaults to 9995
NODE_ENV=production     # set in production

# ── CMS integration ───────────────────────────────────────────────────────────
# Container mode (default): leave CMS_ENV_SCRIPT unset — cmsAddUser must be on PATH
# CMS_ENV_SCRIPT=
# Bare-metal mode:
# CMS_ENV_SCRIPT=/var/local/lib/cms/cmsEnv.sh

# ── Performance ───────────────────────────────────────────────────────────────
CMS_CONCURRENCY=5       # parallel CLI calls per job, default 5
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Run full test suite**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm test 2>&1 | tail -8
```

Expected: 47 passed. (The analyzeCSV integration test still passes because `res.body.data.columnas` is still in the response.)

- [ ] **Run full build**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npm run build 2>&1 | tail -5
```

Expected: no errors, `dist/` populated.

- [ ] **Verify server starts**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && node dist/index.js &
sleep 3
curl -si http://localhost:9995/login | grep "^HTTP"
kill %1 2>/dev/null
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with CMS_ENV_SCRIPT and CMS_CONCURRENCY"
```
