# CLI Exec Security Hardening — Design Spec
**Date:** 2026-09-04
**Scope:** Eliminate command/flag injection risk in the `cmsAddUser`/`cmsAddParticipation` invocation path, fix session fixation on login, and close the unauthenticated-logout CSRF gap. First sub-project of a larger improvement backlog (resilience/infra, test coverage, and code cleanup are separate, later sub-projects).

**Not in this package:** persisting `JobStore`/sessions across restarts, `SIGTERM` handling for in-flight CLI processes, CSV row limits, test coverage additions, and the `registerUsers`/`addParticipation` duplication cleanup — each is its own sub-project.

---

## Background

A multi-agent security/quality/architecture review of the current codebase (2026-09-04) found that `src/utils/buildCmsCommand.ts` and `src/utils/executeProcess.ts` build a shell command string (escaped with `shell-escape`) and run it via `child_process.exec`. Verified against the real CMS CLI sources (`~/Documentos/cms/cmscontrib/AddUser.py`, `AddParticipation.py`, both using Python's `argparse`), this has three concrete problems:

1. **Flag injection (CWE-88):** `shell-escape` prevents shell metacharacter injection, but not argument injection. A CSV value like `--unrestricted` or `-p x` becomes real `argparse` options, not data, because there is no `--` separator between optional and positional arguments.
2. **Post-escape corruption:** the `.replace(/'""'/g, '""')` hack applied after `shell-escape` (to unquote CMS's expected bare `""` for empty name/last-name) can strip real quote characters from user-supplied values that happen to contain `'""'` adjacent to escaped output, silently corrupting the row's data.
3. **A shell layer (`/bin/sh -c`) is invoked at all**, which is unnecessary: neither CLI needs shell features, and removing the shell removes the need for `shell-escape` and its corruption-prone post-processing entirely.

Separately: `POST /login` (`src/controllers/auth.ts`) does not regenerate the session on successful authentication (session fixation), and `GET /logout` (`src/router.ts`) is unauthenticated-request-forgeable because `csrf-csrf`'s `doubleCsrfProtection` does not protect `GET` requests.

**Investigated and explicitly out of scope:** passwords passed via `-p`/`-H` are visible in `ps aux`/`/proc/*/cmdline` on the host (CWE-214). Both CLIs only accept the password as a CLI argument — there is no stdin/env-var input mode in `AddUser.py`/`AddParticipation.py`. Fixing this would require patching CMS itself, which is out of scope for CMS-Loader. This is a documented, accepted risk (the host is assumed to be an internal, single-tenant admin machine).

**Also investigated:** `registerUsers.ts` always appending `--bcrypt` regardless of whether a password was supplied is **not a bug** — per `AddUser.py`, `--bcrypt` controls the storage format of whatever password ends up being used (given or auto-generated), independent of whether the input was already hashed (that's controlled separately by `-p` vs `-H`). No change needed here.

---

## 1. Replace shell `exec` with `execFile`/`spawn`

### What changes
- `src/utils/buildCmsCommand.ts` stops returning a shell command string. It returns `{ file: string, args: string[] }`:
  - No `CMS_ENV_SCRIPT`: `{ file: tool, args }` — the tool name and its argument array, unmodified.
  - `CMS_ENV_SCRIPT` set: `{ file: 'bash', args: ['-c', '. "$1" && exec "$0" "$@"', tool, ...args] }`. The env script path and tool name are passed as `$0`/positional bash parameters, not interpolated into the `-c` string, so they cannot reintroduce shell injection. User-supplied CSV values are the `args` array elements consumed by `"$@"` inside the CLI's own argv, never seen by bash's parser.
- `shell-escape` is removed as a dependency; the `.replace(/'""'/g, '""')` hack is deleted. Empty name/last-name becomes a literal empty string `""` in the `args` array (no escaping needed — arrays don't go through a shell).
- `src/utils/executeProcess.ts` changes from `exec(command, callback)` to `execFile(file, args, { maxBuffer: ... }, callback)`, keeping the same `Promise<string>` return contract (resolve with stdout, reject with an `Error` including stderr) so callers (`registerUsers.ts`, `addParticipation.ts`) don't need to change their error handling.

### Files affected
- `src/utils/buildCmsCommand.ts` — return type and construction logic change
- `src/utils/executeProcess.ts` — `exec` → `execFile`
- `package.json` — remove `shell-escape` and `@types/shell-escape`
- `src/controllers/registerUsers.ts`, `src/controllers/addParticipation.ts` — no logic change expected beyond passing the new return shape through; verify call sites

---

## 2. Guard against flag injection in CSV-derived arguments

### What changes
- In `registerUsers.ts`'s `procesaRegistro` and `addParticipation.ts`'s `procesaRegistro`, before assembling the positional arguments (name/last-name/username for AddUser; username for AddParticipation), validate that none of the *positional* values start with `-`. If one does, throw an `Error` with a clear message (e.g. `"El valor de la columna X no puede empezar con '-'"`) — this surfaces as a per-row error in the results CSV, matching existing error handling.
- Insert a literal `"--"` element into the `args` array immediately before the positional arguments are pushed, as defense in depth (confirmed both CLIs use Python `argparse`, which honors `--` as the end-of-options marker).
- Optional-flag values (e.g. `-e`, `-t`, `-l`, `-p`, `-c`, `-g`, `-i`, `-d`, `-t`) are not subject to the leading-`-` check, since they are already paired with an explicit flag and `argparse` consumes the very next token as that flag's value regardless of its content.

### Files affected
- `src/controllers/registerUsers.ts` — `procesaRegistro`
- `src/controllers/addParticipation.ts` — `procesaRegistro`

---

## 3. Session fixation and logout CSRF fix

### What changes
- `src/controllers/auth.ts`: on successful credential validation, call `req.session.regenerate(err => { ...set authenticated, save, respond... })` instead of mutating and saving the pre-existing session. This also rotates `req.sessionID`, which the CSRF token is derived from (`src/csrf.ts`), so a pre-auth CSRF token cannot be reused post-login.
- `src/router.ts`: change `GET /logout` to `POST /logout`. Since `doubleCsrfProtection` is already mounted globally in `src/index.ts` ahead of `Rutas`, `POST /logout` is automatically CSRF-protected without further wiring. Frontend must update its logout call to `POST` with the CSRF token header, matching the pattern already used for other mutating requests.

### Files affected
- `src/controllers/auth.ts`
- `src/router.ts`
- Frontend logout call site (in `/client`, outside this repo's `src/` — confirm during implementation)

---

## Error Handling

- All new failure modes (leading-`-` rejection, `execFile` errors) surface exactly like existing `executeProcess` failures: caught per-row in `registerUsers.ts`/`addParticipation.ts`'s task loop, pushed to `job.results` with the row index, never crash the batch.
- `execFile`'s `maxBuffer` is set generously (e.g. 10 MB, matching the existing `exec` default risk profile but explicit) to avoid truncating verbose CLI output; exceeding it still rejects with an `Error`, handled the same way as any other `executeProcess` rejection.

## Testing

- Unit tests for `buildCmsCommand.ts`: verify the returned `{ file, args }` shape for both the with-and-without `CMS_ENV_SCRIPT` cases, and that no shell metacharacters need escaping (i.e., a value like `foo; rm -rf /` appears verbatim as one `args` element).
- Unit tests for the leading-`-` guard in both `procesaRegistro` functions: a positional value starting with `-` throws before `executeProcess` is called (mock `executeProcess` and assert it's never invoked).
- Existing `registerUsers.processor.test.ts` / `addParticipation.processor.test.ts` mocks of `executeProcess` need updating to match the new `execFile`-based signature/call shape.
- Manual verification: run against the local CMS install (`~/Documentos/cms`) with a CSV containing a `--unrestricted`-prefixed value and confirm it is rejected as a row error, not executed as a flag.

(Broader test-coverage gaps — auth, jobs.ts access control, full router flows — are explicitly deferred to the "Cobertura de tests" sub-project.)

---

## Out of Scope (deferred to other sub-projects)
- Password-in-argv exposure (CWE-214) — accepted risk, CMS CLI limitation.
- JobStore/session persistence across restarts, `SIGTERM` handling for orphaned CLI child processes, CSV row-count limits — "Resiliencia/infra" sub-project.
- Auth/jobs.ts/router test coverage — "Cobertura de tests" sub-project.
- `processRecords.ts` dead code removal, `registerUsers`/`addParticipation` handler duplication, CLAUDE.md drift — "Limpieza de código" sub-project.
