# Sub-project D: Tests — Design Spec
**Date:** 2026-05-16
**Scope:** Add a minimum test suite that catches regressions in the highest-risk areas — CLI argument building, boolean parsing, shared record processor, and CSV upload parsing.
**Depends on:** Sub-project B (processRecords helper, parseBoolFlag utility must exist first)

---

## 1. Framework & Structure

### Framework
- **Vitest** — native TypeScript support, no extra config needed, fast
- **supertest** — HTTP integration tests without binding to a port

### New dependencies
```json
// devDependencies
"vitest": "^2.x",
"supertest": "^7.x",
"@types/supertest": "^6.x"
```

### File structure
```
src/
  __tests__/
    unit/
      parseBoolFlag.test.ts
      processRecords.test.ts
      registerUsers.processor.test.ts
      addParticipation.processor.test.ts
    integration/
      analyzeCSV.test.ts
```

### Configuration
`vitest.config.ts` at project root — minimal config, no changes to `tsconfig.json` required.

`executeProcess` is mocked in all unit tests via `vi.mock('../utils/executeProcess')`. Unit tests never touch the shell.

### npm script
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## 2. Unit Tests

### `parseBoolFlag.test.ts`
Tests the utility extracted in Sub-project B.

| Input | Expected |
|-------|----------|
| `"true"`, `"TRUE"`, `"True"` | `true` |
| `"1"` | `true` |
| `"false"`, `"FALSE"` | `false` |
| `"0"` | `false` |
| `"yes"`, `""`, `"2"`, `"null"` | throws descriptive error |

### `registerUsers.processor.test.ts`
Tests `procesaRegistro` from `registerUsers.ts` with `executeProcess` mocked.

| Scenario | Expected |
|----------|----------|
| All optional fields present in record | All corresponding CLI args passed to mock |
| Optional fields absent from record | Those args not included |
| `usuario` field absent from record | Throws `Error("Usuario no definido")` |
| No `password` column mapped, CLI output contains `"password abc123"` | Returns `"abc123"` (capture group 1, not group 0) |
| No `password` column, CLI output has no password token | Throws descriptive error |
| `password` column present | `--bcrypt` flag included, no password parsing attempted |

### `addParticipation.processor.test.ts`
Tests `procesaRegistro` from `addParticipation.ts` with `executeProcess` mocked.

| Scenario | Expected |
|----------|----------|
| `contest` column maps to non-numeric value | Throws with field name in message |
| `contest` column absent | Throws `Error("Concurso no definido")` |
| `usuario` absent | Throws `Error("Usuario no definido")` |
| `oculto` = `"true"` or `"1"` | `--hidden` flag present |
| `oculto` = `"false"` or `"0"` | `--hidden` flag absent, no error |
| `oculto` = `"yes"` | Throws descriptive error |
| `sin_restricciones` = `"true"` or `"1"` | `--unrestricted` flag present |
| `tiempo_retraso` non-numeric | Throws with correct field name `"tiempo retraso"` |
| `tiempo_extra` non-numeric | Throws with correct field name `"tiempo extra"` (regression for the copy-paste bug fixed in B) |

### `processRecords.test.ts`
Tests the shared helper from Sub-project B with a mocked processor.

| Scenario | Expected |
|----------|----------|
| `req.session.registros` is undefined | Redirects to `options.redirectTo` |
| All rows succeed, processor returns string | CSV response with `Indice, Extra` columns, all rows present |
| All rows succeed, processor returns void | CSV response with empty `Extra` column |
| Some rows throw | Failed rows appear in CSV with error message; successful rows also present |
| Mixed success/failure | CSV rows sorted ascending by `Indice` |
| After response | `req.session.registros` and `req.session.columnas` are undefined |
| Response headers | `Content-Type: text/csv`, `Content-Disposition` contains `options.filename` |

---

## 3. Integration Tests

### `analyzeCSV.test.ts`
Uses supertest against the real Express app. Does not assert on session internals — only HTTP responses and observable side effects.

| Scenario | Expected status | Expected body |
|----------|----------------|---------------|
| Valid CSV, uniform columns | 200 | `{ success: true, data: { columnas: [...] } }` |
| Sparse CSV (rows have different columns) | 200 | `columnas` is union of all columns across all rows |
| Empty CSV (headers only, no data rows) | 422 | `{ success: false, message: "CSV vacío o no válido" }` |
| Non-CSV file (e.g., `.txt` with wrong MIME) | 400 | `success: false` |
| Request with no file attached | 400 | `{ success: false, message: "Archivo no cargado" }` |
| Temp file cleanup on success | — | File no longer exists in `uploads/` after request |
| Temp file cleanup on parse failure | — | File no longer exists in `uploads/` even when 422 is returned |

---

## What Is Not Tested

- `/registerUsers` and `/addParticipation` routes end-to-end — they shell out to `cmsAddUser`/`cmsAddParticipation` which do not exist in test environments. Unit tests on the processor functions cover that logic sufficiently.
- Authentication flows (Sub-project A) — out of scope here; covered by manual verification after Sub-project A is implemented.
- Session persistence across requests — not worth the complexity; session behavior is a framework concern.

---

## Files Summary

| File | Change |
|------|--------|
| `vitest.config.ts` | New — minimal Vitest config |
| `src/__tests__/unit/parseBoolFlag.test.ts` | New |
| `src/__tests__/unit/processRecords.test.ts` | New |
| `src/__tests__/unit/registerUsers.processor.test.ts` | New |
| `src/__tests__/unit/addParticipation.processor.test.ts` | New |
| `src/__tests__/integration/analyzeCSV.test.ts` | New |
| `package.json` | Add `test` and `test:watch` scripts, add vitest + supertest deps |
