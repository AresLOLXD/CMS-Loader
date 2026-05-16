# Sub-project B: Code Refactor — Design Spec
**Date:** 2026-05-16
**Scope:** Eliminate controller duplication, fix bugs, clean up TypeScript, remove dead code.

---

## 1. Shared `processRecords` Helper

### Problem
`registerUsers.ts` and `addParticipation.ts` share ~80 lines of identical scaffolding: session check, loop over `registros`, per-row try/catch, error collection with `indice: i + 2`, CSV stringify, response headers, `res.end`.

### Solution
Extract `src/utils/processRecords.ts`:

```ts
interface ProcessRecordsOptions {
  redirectTo: string               // redirect target if session missing
  filename: string                 // output CSV filename
  processor: (registro: CSVRecord, body: unknown) => Promise<string | void>
  // returns a string to include in Extra column on success, void if nothing to report
}

export async function processRecords(
  req: Request,
  res: Response,
  options: ProcessRecordsOptions
): Promise<void>
```

**Responsibilities of the helper:**
- Check `req.session.registros`; redirect to `options.redirectTo` if missing
- Loop over records with index, call `options.processor` per row
- Collect `{ Indice, Extra }` entries for both successes (with string output) and errors
- Sort by `Indice`, stringify to CSV, set headers, call `res.end`
- Clear `req.session.registros` and `req.session.columnas` after response

**Each controller becomes:**
- A `processor` function containing only business logic (build CLI args, call `executeProcess`, parse output)
- A route handler that calls `processRecords` with that processor

### Files affected
- `src/utils/processRecords.ts` — new
- `src/utils/index.ts` — re-export `processRecords`
- `src/controllers/registerUsers.ts` — reduce to processor + route
- `src/controllers/addParticipation.ts` — reduce to processor + route

---

## 2. Bug Fixes

### 2a. Password regex capture group (`registerUsers.ts:106`)
**Current (wrong):** `matched[0]` returns the full match `"password abc123"`
**Fix:** `matched[1]` returns only the captured token `"abc123"`

```ts
// Before
passwordEncontrado = matched[0]
// After
passwordEncontrado = matched[1]
```

### 2b. `executeProcess` rejects on any stderr (`executeProcess.ts:7`)
**Current:** `if (err || salidaErr)` rejects the Promise when stderr has any content, even informational messages.
**Fix:** Reject only when `err` is set (non-zero exit code). Attach stderr to the error message for diagnostics.

```ts
exec(command, (err, stdout, stderr) => {
  if (err) {
    reject(new Error(`${err.message}${stderr ? `\nstderr: ${stderr}` : ''}`))
    return
  }
  resolve(stdout)
})
```

### 2c. Wrong error message for `tiempo_extra` (`addParticipation.ts:66`)
Copy-paste error: `tiempo_extra` validation says `"para tiempo retraso no es un valor valido"`.
**Fix:** Change to `"para tiempo extra no es un valor valido"`.

### 2d. Session not cleared in `addParticipation`
`registerUsers` clears `req.session.registros` and `req.session.columnas` after processing; `addParticipation` does not. Both cases are now handled by the shared `processRecords` helper, which always clears session on completion.

---

## 3. TypeScript & Dead Code Cleanup

### 3a. Weak array typing (`registerUsers.ts`)
```ts
// Before — infers any[]
let argumentos = []
// After
const argumentos: string[] = []
```
Remove the trailing `.map(value => String(value))` — it is a no-op since values are already strings.

### 3b. Redundant per-route `json()` middleware
`express.json()` is already mounted globally at `index.ts:26`. The per-route `json()` import and usage in `registerUsers.ts:2` and `addParticipation.ts:2` are redundant. Remove both.

### 3c. Dead code
Remove the commented debug line `//const salida = ""` at `registerUsers.ts:69`.

### 3d. Extract `parseBoolFlag` utility
The boolean parsing logic is duplicated for `oculto` and `sin_restricciones` in `addParticipation.ts`. Extract to `src/utils/`:

```ts
// Returns true/false, or throws if value is unrecognizable
export function parseBoolFlag(value: string, fieldName: string): boolean
```

Accepts: `"true"`, `"false"`, `"1"`, `"0"` (case-insensitive). Throws a descriptive error for anything else.

### 3e. Evaluate `saveAsync` middleware
`saveAsync` is only used once (`analyzeCSV.ts:58`). With `resave: false`, Express-session persists automatically on response end. Verify during implementation whether the explicit `await req.session.saveAsync()` is actually needed by testing the upload flow. If not needed, remove:
- The middleware patch in `index.ts:53-58`
- The `saveAsync` declaration in `SessionData`
- The call in `analyzeCSV.ts:58`

If needed (e.g., race between session write and JSON response), keep with a comment explaining why.

---

## Files Summary

| File | Change |
|------|--------|
| `src/utils/processRecords.ts` | New — shared loop/CSV/response helper |
| `src/utils/executeProcess.ts` | Fix stderr false-rejection |
| `src/utils/index.ts` | Re-export `processRecords` and `parseBoolFlag` |
| `src/controllers/registerUsers.ts` | Reduce to processor + route, fix regex, remove dead code |
| `src/controllers/addParticipation.ts` | Reduce to processor + route, fix mensaje, use `parseBoolFlag` |
| `src/index.ts` | Conditionally remove `saveAsync` middleware |

---

## Out of Scope
- Changing CLI invocation pattern (covered in Sub-project A security hardening via `CMS_ENV_SCRIPT`)
- Adding concurrency to CLI execution (covered in Sub-project C)
- Adding tests for the refactored code (covered in Sub-project D)
