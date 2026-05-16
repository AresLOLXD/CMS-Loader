# Sub-project C: Async Architecture — Design Spec
**Date:** 2026-05-16
**Scope:** Job-based async execution with SSE progress, bounded concurrency, and CMS command abstraction for bare-metal and container deployments.
**Depends on:** Sub-project B (processRecords refactor must exist first)

---

## 1. Job Model

### Problem
The current flow blocks the HTTP connection until all CLI calls complete. For 500 rows at ~600ms each, that is 5+ minutes with no feedback. The browser hangs and sessions can expire mid-flow.

### New request flow
```
POST /analyzeCSV          → stores records in JobStore, returns { jobId }
POST /registerUsers       → creates job, returns { jobId } immediately
POST /addParticipation    → creates job, returns { jobId } immediately
GET  /jobs/:id/events     → SSE stream with real-time progress
GET  /jobs/:id/result     → download result CSV when job is done
```

### JobStore — `src/jobs/JobStore.ts`
Singleton in-memory store. No external dependencies.

```ts
interface Job {
  id: string                                    // crypto.randomUUID()
  status: 'pending' | 'running' | 'done' | 'error'
  total: number                                 // total rows
  processed: number                             // rows completed so far
  records: CSVRecord[]                          // CSV data (previously in session)
  results: { Indice: number, Extra: string }[]  // accumulated output
  createdAt: Date
}

class JobStore {
  private jobs = new Map<string, Job>()

  create(records: CSVRecord[]): Job
  get(id: string): Job | undefined
  update(id: string, patch: Partial<Job>): void
  delete(id: string): void
}
```

**TTL cleanup:** `setInterval` every 10 minutes removes jobs older than 1 hour. Prevents memory leaks in long-running deployments.

**Session changes:** Session no longer stores `registros` or `columnas`. Only stores `activeJobId?: string` to associate the current user with their job.

### Files affected
- `src/jobs/JobStore.ts` — new singleton
- `src/index.ts` — update `SessionData` declaration (remove `registros`/`columnas`, add `activeJobId`)
- `src/controllers/analyzeCSV.ts` — store records in JobStore, return `{ jobId }`
- `src/controllers/registerUsers.ts` — create job from session's `activeJobId`, return `{ jobId }`
- `src/controllers/addParticipation.ts` — same

---

## 2. SSE Progress Streaming

### New route: `GET /jobs/:id/events`
New controller `src/controllers/jobs.ts`.

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no   ← disables nginx/proxy buffering
```

**Event types:**
```
event: progress
data: {"processed": 5, "total": 100, "percent": 5}

event: done
data: {"jobId": "abc-123", "errorCount": 3}

event: error
data: {"message": "Error interno"}
```

**Implementation:**
- Poll `JobStore` every 200ms with `setInterval`
- Emit `progress` when `job.processed` changes
- Emit `done` or `error` when `job.status` changes to terminal state, then call `res.end()`
- On `req.on('close')`: clear interval, stop polling (client disconnected early)

### New route: `GET /jobs/:id/result`
Returns the result CSV. Only available when `job.status === 'done'`.
- 404 if job not found
- 409 if job still running
- Sets `Content-Type: text/csv` and `Content-Disposition: attachment; filename="Resultados.csv"` (or `"Errores.csv"` depending on job type)

### Frontend changes
Replace the current form submit + wait pattern:

```js
// After POST returns { jobId }:
const source = new EventSource(`/jobs/${jobId}/events`)
source.addEventListener('progress', e => updateProgressBar(JSON.parse(e.data)))
source.addEventListener('done', e => showDownloadButton(JSON.parse(e.data)))
source.addEventListener('error', e => showError(JSON.parse(e.data)))
```

`EventSource` is native in all modern browsers — no library needed.

### Files affected
- `src/controllers/jobs.ts` — new (SSE + result download routes)
- `src/router.ts` — mount `/jobs` routes
- `src/public/js/cargaUsuarios.js` — replace submit handler with job polling
- `src/public/js/cargaConcurso.js` — same
- `src/public/html/cargaUsuarios.html` — add progress bar UI
- `src/public/html/cargaConcurso.html` — same

---

## 3. Bounded Concurrency

**`p-limit`** replaces the sequential `for` loop:

```ts
import pLimit from 'p-limit'
const limit = pLimit(Number(process.env.CMS_CONCURRENCY) || 5)

const tasks = records.map((registro, i) =>
  limit(async () => {
    try {
      const output = await processor(registro, body)
      job.results.push({ Indice: i + 2, Extra: output ?? '' })
    } catch (err) {
      job.results.push({ Indice: i + 2, Extra: err instanceof Error ? err.message : 'Error' })
    } finally {
      job.processed++
    }
  })
)
await Promise.all(tasks)
```

**Why N=5 as default:**
- Each `exec` forks a Python process; CMS uses SQLAlchemy with a connection pool
- N=5 is conservative to avoid saturating the DB connection pool
- Configurable via `CMS_CONCURRENCY` in `.env` for operators who know their setup

**Thread safety note:** `job.processed++` is safe — Node.js is single-threaded; concurrent promises interleave at await points, not mid-increment.

### New dependency
```json
"p-limit": "^6.x"
```

---

## 4. CMS Command Abstraction

### Problem
The CMS CLI path is hardcoded in two controllers. In a Docker container, `cmsAddUser` is already on PATH. In bare-metal, it requires sourcing `cmsEnv.sh` first.

### Solution — `src/utils/buildCmsCommand.ts`

```ts
export function buildCmsCommand(
  tool: 'cmsAddUser' | 'cmsAddParticipation',
  args: string[]
): string
```

| `CMS_ENV_SCRIPT` set? | Generated command |
|-----------------------|-------------------|
| No (default) | `cmsAddUser <escaped-args>` — assumes tool is on PATH (container mode) |
| Yes | `. /path/to/cmsEnv.sh && cmsAddUser <escaped-args>` — bare-metal mode |

**Zero config in container:** `cmsAddUser` is already on PATH inside the CMS container (Node.js is also pre-installed for rekarel). CMS-Loader works out of the box with no env vars required.

**Bare-metal config:** add `CMS_ENV_SCRIPT=/var/local/lib/cms/cmsEnv.sh` to `.env`.

The `.env.example` documents both modes:
```bash
# Container mode (default): leave CMS_ENV_SCRIPT unset
# CMS_ENV_SCRIPT=

# Bare-metal mode: set path to cmsEnv.sh
# CMS_ENV_SCRIPT=/var/local/lib/cms/cmsEnv.sh
```

### Replaces
- Hardcoded string in `registerUsers.ts:67`
- Hardcoded string in `addParticipation.ts:106`
- The `CMS_ENV_SCRIPT` handling proposed in Sub-project A (consolidated here)

### Files affected
- `src/utils/buildCmsCommand.ts` — new
- `src/utils/index.ts` — re-export
- `src/controllers/registerUsers.ts` — use `buildCmsCommand`
- `src/controllers/addParticipation.ts` — use `buildCmsCommand`
- `.env.example` — document both deployment modes

---

## Updated `.env.example`

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

---

## Files Summary

| File | Change |
|------|--------|
| `src/jobs/JobStore.ts` | New — in-memory job store with TTL cleanup |
| `src/controllers/jobs.ts` | New — SSE progress + result download routes |
| `src/utils/buildCmsCommand.ts` | New — command builder for container and bare-metal |
| `src/utils/index.ts` | Re-export new utilities |
| `src/controllers/analyzeCSV.ts` | Store records in JobStore, return jobId |
| `src/controllers/registerUsers.ts` | Create job, return jobId, use buildCmsCommand |
| `src/controllers/addParticipation.ts` | Same |
| `src/router.ts` | Mount `/jobs` routes |
| `src/index.ts` | Update SessionData, start JobStore TTL cleanup |
| `src/public/js/cargaUsuarios.js` | Replace submit handler with SSE polling |
| `src/public/js/cargaConcurso.js` | Same |
| `src/public/html/cargaUsuarios.html` | Add progress bar UI |
| `src/public/html/cargaConcurso.html` | Same |
| `.env.example` | Document all env vars and both deployment modes |
| `package.json` | Add `p-limit` dependency |

---

## Out of Scope
- Persistent job storage across restarts (in-memory is sufficient for internal tool)
- WebSocket (SSE is simpler and sufficient for one-way progress)
- Docker integration into the CMS repo (left to the CMS project)
- Multiple concurrent users / job isolation beyond session-based jobId
