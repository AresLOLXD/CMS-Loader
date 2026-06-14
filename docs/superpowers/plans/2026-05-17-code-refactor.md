# Code Refactor (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplication between registerUsers and addParticipation controllers, fix two bugs, and clean up TypeScript and dead code.

**Architecture:** Extract `processRecords` (shared loop/CSV/response helper) and `parseBoolFlag` (boolean parsing utility) into `src/utils/`. Reduce each controller to a pure `processor` function + one route call. Fix `executeProcess` stderr false-rejection. Fix regex capture group bug.

**Tech Stack:** TypeScript, Express 5, existing deps only — no new packages.

---

## File Map

| File | Action |
|------|--------|
| `src/utils/executeProcess.ts` | Modify — reject only on `err`, not on stderr |
| `src/utils/parseBoolFlag.ts` | Create — boolean parsing utility |
| `src/utils/processRecords.ts` | Create — shared loop/CSV/response helper |
| `src/utils/index.ts` | Modify — re-export new utilities |
| `src/controllers/registerUsers.ts` | Modify — reduce to processor + route, fix bugs, clean up |
| `src/controllers/addParticipation.ts` | Modify — reduce to processor + route, use parseBoolFlag, fix error message |

---

## Task 1: Fix `executeProcess` — reject only on error exit code

**Files:**
- Modify: `src/utils/executeProcess.ts`

**Problem:** Current code rejects the Promise when `stderr` has any content, but many CLIs (including CMS tools) write informational messages to stderr without failing. This causes false negatives.

- [ ] **Replace `src/utils/executeProcess.ts` with:**

```ts
import { exec } from "child_process"

export async function executeProcess(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`${err.message}${stderr ? `\nstderr: ${stderr}` : ""}`))
                return
            }
            resolve(stdout)
        })
    })
}
```

- [ ] **Run TypeScript check**

```bash
cd /var/home/areslolxd/Documentos/CMS-Loader && npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/utils/executeProcess.ts
git commit -m "fix: reject executeProcess only on non-zero exit, attach stderr to error"
```

---

## Task 2: Create `parseBoolFlag` utility

**Files:**
- Create: `src/utils/parseBoolFlag.ts`
- Modify: `src/utils/index.ts`

**Problem:** Boolean parsing logic for `oculto` and `sin_restricciones` is duplicated verbatim in `addParticipation.ts`.

- [ ] **Create `src/utils/parseBoolFlag.ts`:**

```ts
export function parseBoolFlag(value: string, fieldName: string): boolean {
    const lower = value.toLowerCase()
    if (lower === "true" || value === "1") return true
    if (lower === "false" || value === "0") return false
    throw new Error(`El valor ${value} para ${fieldName} no es un valor valido`)
}
```

- [ ] **Add re-export to `src/utils/index.ts`:**

```ts
export * from "./executeProcess"
export * from "./csv"
export * from "./parseBoolFlag"
```

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/utils/parseBoolFlag.ts src/utils/index.ts
git commit -m "feat: add parseBoolFlag utility"
```

---

## Task 3: Create `processRecords` helper

**Files:**
- Create: `src/utils/processRecords.ts`
- Modify: `src/utils/index.ts`

**Problem:** `registerUsers.ts` and `addParticipation.ts` share ~80 lines of identical scaffolding: session check, loop, per-row try/catch, error collection, CSV stringify, headers, response.

- [ ] **Create `src/utils/processRecords.ts`:**

```ts
import { stringify } from "csv/sync"
import { Request, Response } from "express"
import { CSVRecord } from "./csv"

interface ProcessRecordsOptions {
    redirectTo: string
    filename: string
    processor: (registro: CSVRecord, body: unknown) => Promise<string | void>
}

export async function processRecords(
    req: Request,
    res: Response,
    options: ProcessRecordsOptions
): Promise<void> {
    const { registros } = req.session
    if (!registros) {
        res.redirect(options.redirectTo)
        return
    }

    const salida: { Indice: number; Extra: string }[] = []

    for (let i = 0; i < registros.length; i++) {
        const registro = registros[i]
        try {
            const result = await options.processor(registro, req.body)
            if (result) {
                salida.push({ Indice: i + 2, Extra: result })
            }
        } catch (error) {
            console.error(error)
            const mensaje = error instanceof Error ? error.message : "Hubo un error procesando la fila"
            salida.push({ Indice: i + 2, Extra: mensaje })
        }
    }

    salida.sort((a, b) => a.Indice - b.Indice)

    const csvGenerated = stringify(salida, { header: true, quoted: true })

    req.session.registros = undefined
    req.session.columnas = undefined

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="${options.filename}"`)
    res.setHeader("Content-Length", Buffer.byteLength(csvGenerated))
    res.end(csvGenerated)
}
```

- [ ] **Add re-export to `src/utils/index.ts`:**

```ts
export * from "./executeProcess"
export * from "./csv"
export * from "./parseBoolFlag"
export * from "./processRecords"
```

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/utils/processRecords.ts src/utils/index.ts
git commit -m "feat: add processRecords shared helper"
```

---

## Task 4: Refactor `registerUsers.ts`

**Files:**
- Modify: `src/controllers/registerUsers.ts`

**Changes:**
1. Remove `json` import from express (globally mounted in index.ts)
2. Declare `argumentos` as `const argumentos: string[] = []` (was `let argumentos = []` inferred as `any[]`)
3. Remove the trailing `.map(value => String(value))` (no-op)
4. Fix regex: `matched[0]` → `matched[1]` (bug — was returning `"password abc123"` instead of `"abc123"`)
5. Fix regex: use literal `/password\s+(\w+)/` directly (no need for `RegExp(...)` wrapper)
6. Remove dead code: `//const salida = ""`
7. Use `processRecords` helper — reduce route handler to processor + one call

- [ ] **Replace `src/controllers/registerUsers.ts` with:**

```ts
import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import shellescape from "shell-escape"
import { CSVRecord, executeProcess, processRecords } from "../utils"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })

async function procesaRegistro(
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

    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ${shellescape(argumentos)}`.replace(/'""'/g, `""`)
    return executeProcess(commando)
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const { email, timezone, languages, password, nombre, apellidos, usuario } = req.body

    await processRecords(req, res, {
        redirectTo: "cargaUsuarios.html",
        filename: "Resultados.csv",
        processor: async (registro) => {
            const salida = await procesaRegistro({ registro, email, timezone, languages, password, nombre, apellidos, usuario })

            if (!password || !registro[password]) {
                const matched = /password\s+(\w+)/.exec(salida)
                if (!matched) {
                    throw new Error(`Revisar usuario ${usuario}, contraseña no se pudo obtener`)
                }
                return matched[1]
            }
        }
    })
})


export default router
```

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Verify the route still responds correctly**

```bash
npm run dev &
sleep 3
curl -si -X POST http://localhost:9995/registerUsers \
  -H "Content-Type: application/json" \
  -b "CMS_Loader=irrelevant" \
  | head -5
kill %1 2>/dev/null
```

Expected: 302 redirect to `cargaUsuarios.html` (no session = redirect, which means the route is reached and processRecords works).

- [ ] **Commit**

```bash
git add src/controllers/registerUsers.ts
git commit -m "refactor: use processRecords helper, fix regex capture group, clean up types"
```

---

## Task 5: Refactor `addParticipation.ts`

**Files:**
- Modify: `src/controllers/addParticipation.ts`

**Changes:**
1. Remove `json` import from express
2. Use `parseBoolFlag` for `oculto` and `sin_restricciones`
3. Fix error message for `tiempo_extra` (was incorrectly saying "tiempo retraso")
4. Use `processRecords` helper — reduce route handler

- [ ] **Replace `src/controllers/addParticipation.ts` with:**

```ts
import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import shellescape from "shell-escape"
import { CSVRecord, executeProcess, parseBoolFlag, processRecords } from "../utils"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })


async function procesaRegistro(
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

    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddParticipation ${shellescape(argumentos)}`.replace(/'""'/g, `""`)
    await executeProcess(commando)
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body

    await processRecords(req, res, {
        redirectTo: "cargaConcurso.html",
        filename: "Errores.csv",
        processor: async (registro) => {
            await procesaRegistro({ registro, contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario })
        }
    })
})


export default router
```

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Commit**

```bash
git add src/controllers/addParticipation.ts
git commit -m "refactor: use processRecords and parseBoolFlag, fix tiempo_extra error message"
```

---

## Task 6: Remove body parser from route handlers + verify build

**Files:**
- Modify: `src/controllers/registerUsers.ts` (already done in Task 4 — json() removed)
- Modify: `src/controllers/addParticipation.ts` (already done in Task 5 — json() removed)

> Note: Tasks 4 and 5 already removed the per-route `json()` middleware. This task verifies the full build works end-to-end and runs a final type check.

- [ ] **Verify full build**

```bash
npm run build
```

Expected: no errors, `dist/` populated.

- [ ] **Verify the server starts from dist**

```bash
node dist/index.js &
sleep 3
curl -si http://localhost:9995/login | grep "^HTTP"
kill %1 2>/dev/null
```

Expected: `HTTP/1.1 200 OK`

- [ ] **Commit (if any changes needed from build verification)**

If the build revealed issues, fix them and commit. If clean, no commit needed.

```bash
git status
# Only commit if there are changes
```
