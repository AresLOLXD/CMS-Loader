# CLI Exec Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate CLI flag/argument injection and shell-layer risk in the `cmsAddUser`/`cmsAddParticipation` invocation path, and close a session-fixation and unauthenticated-logout-CSRF gap.

**Architecture:** Replace the `shell-escape` + `child_process.exec` string-command pipeline with `child_process.execFile` driven by an argv array, inserting a `--` end-of-options marker and rejecting any CSV-derived positional value that starts with `-`. `CMS_ENV_SCRIPT` sourcing moves into a `bash -c` wrapper that reads the script path from the inherited environment (never interpolated into the script text). Separately, harden `POST /login` to regenerate the session on success, and move `GET /logout` to `POST /logout` so it is covered by the existing global CSRF middleware.

**Tech Stack:** Express 5, TypeScript (ESM, `tsx`), Node.js `child_process.execFile`, Vitest + Supertest, Preact (client).

**Spec:** `docs/superpowers/specs/2026-09-04-cli-exec-security-hardening-design.md`

## Global Constraints

- Use `pnpm` for all package management and script commands in this repo — never `npm`/`npx`.
- `shell-escape` and `@types/shell-escape` are removed entirely; no code in this package may import them.
- No changes outside this package's scope: JobStore/session persistence, `SIGTERM` handling, CSV row limits, `auth.ts`/`jobs.ts` broader test coverage, `processRecords.ts` removal, and handler-duplication cleanup are explicitly deferred to other sub-projects (see spec's "Out of Scope").
- Follow existing code style: Spanish identifiers/error messages in controllers (matches current `registerUsers.ts`/`addParticipation.ts`), English elsewhere per project convention already in place — do not do a mechanical rename pass as part of this package.
- Every task must leave `pnpm test` and `pnpm exec tsc --noEmit` passing before its commit.

---

### Task 1: `buildCmsCommand` returns an argv array instead of a shell string

**Files:**
- Modify: `src/utils/buildCmsCommand.ts`
- Test: `src/__tests__/unit/buildCmsCommand.test.ts` (new)

**Interfaces:**
- Produces: `interface CmsCommand { file: string; args: string[] }` and `buildCmsCommand(tool: 'cmsAddUser' | 'cmsAddParticipation', args: string[]): CmsCommand` — replaces the old `(tool, args) => string` signature. Task 2 and Task 3/4 consume this.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/buildCmsCommand.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { buildCmsCommand } from '../../utils/buildCmsCommand'

describe('buildCmsCommand', () => {
    const originalEnvScript = process.env.CMS_ENV_SCRIPT

    afterEach(() => {
        if (originalEnvScript === undefined) delete process.env.CMS_ENV_SCRIPT
        else process.env.CMS_ENV_SCRIPT = originalEnvScript
    })

    it('returns the tool as file with args unmodified when CMS_ENV_SCRIPT is not set', () => {
        delete process.env.CMS_ENV_SCRIPT
        const result = buildCmsCommand('cmsAddUser', ['--', 'Juan', 'Perez', 'jperez'])
        expect(result).toEqual({ file: 'cmsAddUser', args: ['--', 'Juan', 'Perez', 'jperez'] })
    })

    it('wraps the call in bash -c when CMS_ENV_SCRIPT is set, without inlining the script path into the script text', () => {
        process.env.CMS_ENV_SCRIPT = '/opt/cms/env.sh'
        const result = buildCmsCommand('cmsAddUser', ['--', 'Juan', 'Perez', 'jperez'])
        expect(result.file).toBe('bash')
        expect(result.args[0]).toBe('-c')
        expect(result.args[1]).toBe('. "$CMS_ENV_SCRIPT" && exec "$0" "$@"')
        expect(result.args[1]).not.toContain('/opt/cms/env.sh')
        expect(result.args.slice(2)).toEqual(['cmsAddUser', '--', 'Juan', 'Perez', 'jperez'])
    })

    it('does not shell-escape values containing shell metacharacters — they pass through as a single argv element', () => {
        delete process.env.CMS_ENV_SCRIPT
        const dangerous = 'foo; rm -rf / #'
        const result = buildCmsCommand('cmsAddUser', ['--', dangerous])
        expect(result.args).toContain(dangerous)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/unit/buildCmsCommand.test.ts`
Expected: FAIL — `buildCmsCommand` still returns a string, or the module doesn't export the shape the tests expect (type/shape mismatch, or `shell-escape` output present).

- [ ] **Step 3: Replace the implementation**

Replace the full contents of `src/utils/buildCmsCommand.ts`:

```ts
export interface CmsCommand {
    file: string
    args: string[]
}

export function buildCmsCommand(tool: 'cmsAddUser' | 'cmsAddParticipation', args: string[]): CmsCommand {
    const envScript = process.env.CMS_ENV_SCRIPT
    if (envScript) {
        return {
            file: 'bash',
            args: ['-c', '. "$CMS_ENV_SCRIPT" && exec "$0" "$@"', tool, ...args],
        }
    }
    return { file: tool, args }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/unit/buildCmsCommand.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/buildCmsCommand.ts src/__tests__/unit/buildCmsCommand.test.ts
git commit -m "feat(security): buildCmsCommand returns argv array instead of shell string"
```

---

### Task 2: `executeProcess` uses `execFile` instead of `exec`

**Files:**
- Modify: `src/utils/executeProcess.ts`
- Test: `src/__tests__/unit/executeProcess.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Task 1 directly (independent of `CmsCommand` shape).
- Produces: `executeProcess(file: string, args: string[]): Promise<string>` — replaces the old `executeProcess(command: string): Promise<string>`. Task 3/4 consume this new two-argument signature.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/executeProcess.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
    execFile: vi.fn(),
}))

import { execFile } from 'child_process'
import { executeProcess } from '../../utils/executeProcess'

const mockExecFile = vi.mocked(execFile)

beforeEach(() => {
    mockExecFile.mockReset()
})

describe('executeProcess', () => {
    it('resolves with stdout on success', async () => {
        mockExecFile.mockImplementation(((
            _file: string,
            _args: readonly string[],
            _options: unknown,
            callback: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
            callback(null, 'ok output', '')
        }) as unknown as typeof execFile)

        const result = await executeProcess('cmsAddUser', ['a', 'b'])
        expect(result).toBe('ok output')
        expect(mockExecFile).toHaveBeenCalledWith('cmsAddUser', ['a', 'b'], expect.any(Object), expect.any(Function))
    })

    it('rejects with an Error including stderr on failure', async () => {
        mockExecFile.mockImplementation(((
            _file: string,
            _args: readonly string[],
            _options: unknown,
            callback: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
            callback(new Error('boom'), '', 'stderr detail')
        }) as unknown as typeof execFile)

        await expect(executeProcess('cmsAddUser', ['a'])).rejects.toThrow('boom')
    })

    it('includes stderr text in the rejection message when present', async () => {
        mockExecFile.mockImplementation(((
            _file: string,
            _args: readonly string[],
            _options: unknown,
            callback: (err: Error | null, stdout: string, stderr: string) => void
        ) => {
            callback(new Error('boom'), '', 'stderr detail')
        }) as unknown as typeof execFile)

        await expect(executeProcess('cmsAddUser', ['a'])).rejects.toThrow(/stderr detail/)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/unit/executeProcess.test.ts`
Expected: FAIL — `executeProcess` still calls `exec(command, callback)` with one argument, not `execFile(file, args, options, callback)`.

- [ ] **Step 3: Replace the implementation**

Replace the full contents of `src/utils/executeProcess.ts`:

```ts
import { execFile } from "child_process"

const MAX_BUFFER_BYTES = 10 * 1024 * 1024

export async function executeProcess(file: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(file, args, { maxBuffer: MAX_BUFFER_BYTES }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(`${err.message}${stderr ? `\nstderr: ${stderr}` : ""}`))
                return
            }
            resolve(stdout)
        })
    })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/unit/executeProcess.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/executeProcess.ts src/__tests__/unit/executeProcess.test.ts
git commit -m "feat(security): executeProcess uses execFile instead of shell exec"
```

---

### Task 3: `registerUsers.ts` — flag-injection guard and new call signature

**Files:**
- Modify: `src/controllers/registerUsers.ts`
- Test: `src/__tests__/unit/registerUsers.processor.test.ts` (rewrite in place)

**Interfaces:**
- Consumes: `buildCmsCommand(tool, args): CmsCommand` (Task 1), `executeProcess(file, args): Promise<string>` (Task 2).
- Produces: `procesaRegistro(...)` keeps its existing exported name/parameter shape and `Promise<string>` return type — the router handler and its call site are unaffected.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/__tests__/unit/registerUsers.processor.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../utils/executeProcess', () => ({
    executeProcess: vi.fn(),
}))

import { procesaRegistro } from '../../controllers/registerUsers'
import { executeProcess } from '../../utils/executeProcess'

const mockExecute = vi.mocked(executeProcess)

beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue('')
})

describe('procesaRegistro (registerUsers)', () => {
    it('passes all optional fields as CLI args when present in record', async () => {
        const registro = {
            email_col: 'user@example.com',
            tz_col: 'America/Mexico_City',
            lang_col: 'es',
            pass_col: 'secret',
            name_col: 'Juan',
            last_col: 'Perez',
            user_col: 'jperez',
        }
        await procesaRegistro({
            registro,
            email: 'email_col',
            timezone: 'tz_col',
            languages: 'lang_col',
            password: 'pass_col',
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        const [file, args] = mockExecute.mock.calls[0]
        expect(file).toBe('cmsAddUser')
        expect(args).toEqual([
            '-e', 'user@example.com',
            '-t', 'America/Mexico_City',
            '-l', 'es',
            '-p', 'secret',
            '--bcrypt',
            '--',
            'Juan',
            'Perez',
            'jperez',
        ])
    })

    it('omits optional args when those columns are absent from record', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        const [, args] = mockExecute.mock.calls[0]
        expect(args).toEqual(['--bcrypt', '--', 'Juan', 'Perez', 'jperez'])
    })

    it('uses empty strings for missing nombre/apellidos', async () => {
        const registro = { user_col: 'jperez' }
        await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        const [, args] = mockExecute.mock.calls[0]
        expect(args).toEqual(['--bcrypt', '--', '', '', 'jperez'])
    })

    it('throws "Usuario no definido" when usuario column is absent from record', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez' }
        await expect(procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })).rejects.toThrow('Usuario no definido')
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('always includes --bcrypt flag', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        expect(mockExecute.mock.calls[0][1]).toContain('--bcrypt')
    })

    it('rejects a usuario value that starts with "-" before executing', async () => {
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: '--unrestricted' }
        await expect(procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })).rejects.toThrow(/no puede empezar con/)
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('rejects a nombre value that starts with "-" before executing', async () => {
        const registro = { name_col: '--bcrypt', last_col: 'Perez', user_col: 'jperez' }
        await expect(procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })).rejects.toThrow(/no puede empezar con/)
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('returns raw stdout from executeProcess', async () => {
        mockExecute.mockResolvedValue('Created user. password abc123\n')
        const registro = { name_col: 'Juan', last_col: 'Perez', user_col: 'jperez' }
        const result = await procesaRegistro({
            registro,
            nombre: 'name_col',
            apellidos: 'last_col',
            usuario: 'user_col',
        })
        expect(result).toBe('Created user. password abc123\n')
    })
})

describe('password regex (route handler logic)', () => {
    it('capture group 1 extracts token only — not the full match (regression guard for matched[1] fix)', () => {
        const stdout = 'Created user. password abc123\n'
        const matched = /password\s+(\w+)/.exec(stdout)
        expect(matched).not.toBeNull()
        expect(matched![1]).toBe('abc123')
        expect(matched![0]).toBe('password abc123')
    })

    it('returns null when stdout has no password token', () => {
        const matched = /password\s+(\w+)/.exec('User created successfully')
        expect(matched).toBeNull()
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/unit/registerUsers.processor.test.ts`
Expected: FAIL — `procesaRegistro` still calls `executeProcess` with a single string argument and no `--`/flag-injection guard.

- [ ] **Step 3: Update `procesaRegistro` in `src/controllers/registerUsers.ts`**

Replace the existing `procesaRegistro` function (keep the `router` and its `POST /` handler below it unchanged) with:

```ts
function assertNotFlagLike(value: string, columna: string): void {
    if (value.startsWith('-')) {
        throw new Error(`El valor de la columna ${columna} no puede empezar con '-'`)
    }
}

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
    argumentos.push("--")

    const nombreValor = (nombre && registro[nombre]) ? registro[nombre] : ""
    assertNotFlagLike(nombreValor, "nombre")
    argumentos.push(nombreValor)

    const apellidosValor = (apellidos && registro[apellidos]) ? registro[apellidos] : ""
    assertNotFlagLike(apellidosValor, "apellidos")
    argumentos.push(apellidosValor)

    if (usuario && registro[usuario]) {
        assertNotFlagLike(registro[usuario], "usuario")
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    const { file, args } = buildCmsCommand('cmsAddUser', argumentos)
    return executeProcess(file, args)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/unit/registerUsers.processor.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/controllers/registerUsers.ts src/__tests__/unit/registerUsers.processor.test.ts
git commit -m "feat(security): guard registerUsers CLI args against flag injection"
```

---

### Task 4: `addParticipation.ts` — flag-injection guard and new call signature

**Files:**
- Modify: `src/controllers/addParticipation.ts`
- Test: `src/__tests__/unit/addParticipation.processor.test.ts` (rewrite in place)

**Interfaces:**
- Consumes: `buildCmsCommand(tool, args): CmsCommand` (Task 1), `executeProcess(file, args): Promise<string>` (Task 2).
- Produces: `procesaRegistro(...)` keeps its existing exported name/parameter shape and `Promise<void>` return type.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/__tests__/unit/addParticipation.processor.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../utils/executeProcess', () => ({
    executeProcess: vi.fn(),
}))

import { procesaRegistro } from '../../controllers/addParticipation'
import { executeProcess } from '../../utils/executeProcess'

const mockExecute = vi.mocked(executeProcess)

const BASE = { contest_col: '1', user_col: 'jperez' }

beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue('')
})

describe('procesaRegistro (addParticipation)', () => {
    it('throws when contest column maps to a non-numeric value', async () => {
        await expect(procesaRegistro({
            registro: { contest_col: 'not-a-number', user_col: 'jperez' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('concurso')
    })

    it('throws "Concurso no definido" when contest column is absent from record', async () => {
        await expect(procesaRegistro({
            registro: { user_col: 'jperez' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('Concurso no definido')
    })

    it('throws "Usuario no definido" when usuario column is absent from record', async () => {
        await expect(procesaRegistro({
            registro: { contest_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow('Usuario no definido')
    })

    it('adds --hidden when oculto is "true"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: 'true' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][1]).toContain('--hidden')
    })

    it('adds --hidden when oculto is "1"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][1]).toContain('--hidden')
    })

    it('does not add --hidden when oculto is "false"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: 'false' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][1]).not.toContain('--hidden')
    })

    it('does not add --hidden when oculto is "0"', async () => {
        await procesaRegistro({
            registro: { ...BASE, oculto_col: '0' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })
        expect(mockExecute.mock.calls[0][1]).not.toContain('--hidden')
    })

    it('throws for invalid oculto value "yes"', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, oculto_col: 'yes' },
            contest: 'contest_col',
            usuario: 'user_col',
            oculto: 'oculto_col',
        })).rejects.toThrow('oculto')
    })

    it('adds --unrestricted when sin_restricciones is "true"', async () => {
        await procesaRegistro({
            registro: { ...BASE, sr_col: 'true' },
            contest: 'contest_col',
            usuario: 'user_col',
            sin_restricciones: 'sr_col',
        })
        expect(mockExecute.mock.calls[0][1]).toContain('--unrestricted')
    })

    it('adds --unrestricted when sin_restricciones is "1"', async () => {
        await procesaRegistro({
            registro: { ...BASE, sr_col: '1' },
            contest: 'contest_col',
            usuario: 'user_col',
            sin_restricciones: 'sr_col',
        })
        expect(mockExecute.mock.calls[0][1]).toContain('--unrestricted')
    })

    it('adds -g when grupo is mapped', async () => {
        await procesaRegistro({
            registro: { ...BASE, grupo_col: 'grupoA' },
            contest: 'contest_col',
            usuario: 'user_col',
            grupo: 'grupo_col',
        })
        expect(mockExecute.mock.calls[0][1]).toEqual(expect.arrayContaining(['-g', 'grupoA']))
    })

    it('does not add -g when grupo is not mapped', async () => {
        await procesaRegistro({ registro: BASE, contest: 'contest_col', usuario: 'user_col' })
        expect(mockExecute.mock.calls[0][1]).not.toContain('-g')
    })

    it('throws for non-numeric tiempo_retraso with "tiempo retraso" in message', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, tr_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_retraso: 'tr_col',
        })).rejects.toThrow('tiempo retraso')
    })

    it('throws for non-numeric tiempo_extra with "tiempo extra" in message (regression: not "tiempo retraso")', async () => {
        await expect(procesaRegistro({
            registro: { ...BASE, te_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_extra: 'te_col',
        })).rejects.toThrow('tiempo extra')
    })

    it('tiempo_extra error does not say "tiempo retraso" (copy-paste regression guard)', async () => {
        const error = await procesaRegistro({
            registro: { ...BASE, te_col: 'abc' },
            contest: 'contest_col',
            usuario: 'user_col',
            tiempo_extra: 'te_col',
        }).catch(e => e as Error) as Error
        expect(error.message).not.toMatch('tiempo retraso')
    })

    it('inserts "--" before the positional usuario argument', async () => {
        await procesaRegistro({ registro: BASE, contest: 'contest_col', usuario: 'user_col' })
        const args = mockExecute.mock.calls[0][1]
        expect(args[args.length - 2]).toBe('--')
        expect(args[args.length - 1]).toBe('jperez')
    })

    it('rejects a usuario value that starts with "-" before executing', async () => {
        await expect(procesaRegistro({
            registro: { contest_col: '1', user_col: '--unrestricted' },
            contest: 'contest_col',
            usuario: 'user_col',
        })).rejects.toThrow(/no puede empezar con/)
        expect(mockExecute).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/unit/addParticipation.processor.test.ts`
Expected: FAIL — same reasons as Task 3 (old single-string call signature, no `--`/guard).

- [ ] **Step 3: Update `procesaRegistro` in `src/controllers/addParticipation.ts`**

Replace the existing `procesaRegistro` function (keep the `router` and its `POST /` handler below it unchanged) with:

```ts
function assertNotFlagLike(value: string, columna: string): void {
    if (value.startsWith('-')) {
        throw new Error(`El valor de la columna ${columna} no puede empezar con '-'`)
    }
}

export async function procesaRegistro(
    {
        registro,
        contest,
        grupo,
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
        grupo?: string,
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

    if (grupo && registro[grupo]) {
        argumentos.push("-g")
        argumentos.push(registro[grupo])
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

    argumentos.push("--")

    if (usuario && registro[usuario]) {
        assertNotFlagLike(registro[usuario], "usuario")
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    const { file, args } = buildCmsCommand('cmsAddParticipation', argumentos)
    await executeProcess(file, args)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/unit/addParticipation.processor.test.ts`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add src/controllers/addParticipation.ts src/__tests__/unit/addParticipation.processor.test.ts
git commit -m "feat(security): guard addParticipation CLI args against flag injection"
```

---

### Task 5: Remove the `shell-escape` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (regenerated)

**Interfaces:**
- Consumes: Tasks 1-4 must be complete (no remaining imports of `shell-escape` anywhere in `src/`).

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "shell-escape" src/`
Expected: no output (Tasks 1-4 already removed the only import in `buildCmsCommand.ts`).

- [ ] **Step 2: Remove the dependency**

```bash
pnpm remove shell-escape @types/shell-escape
```

- [ ] **Step 3: Verify the project still type-checks and tests pass**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(security): remove shell-escape dependency"
```

---

### Task 6: Regenerate session on successful login

**Files:**
- Modify: `src/controllers/auth.ts`
- Test: `src/__tests__/integration/auth.test.ts` (new)

**Interfaces:**
- Consumes: nothing from prior tasks (independent).
- Produces: no exported interface change — `POST /login` request/response contract (`{ success: boolean, message?: string }`) is unchanged; only the underlying session ID now rotates on success.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/integration/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'
import authRouter from '../../controllers/auth'

function createTestApp() {
    const app = express()
    app.use(express.json())
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }))
    app.use('/login', authRouter)
    app.get('/whoami', (req, res) => { res.json({ sid: req.sessionID }) })
    return app
}

beforeAll(() => {
    process.env.ADMIN_USER = 'admin'
    process.env.ADMIN_PASSWORD = 'secret123'
})

describe('POST /login', () => {
    it('regenerates the session id on successful login (prevents fixation)', async () => {
        const agent = request.agent(createTestApp())
        const before = await agent.get('/whoami')
        const sidBefore = before.body.sid as string

        const res = await agent.post('/login').send({ username: 'admin', password: 'secret123' })
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)

        const after = await agent.get('/whoami')
        expect(after.body.sid).not.toBe(sidBefore)
    })

    it('returns 401 and does not regenerate the session on invalid credentials', async () => {
        const agent = request.agent(createTestApp())
        const before = await agent.get('/whoami')
        const sidBefore = before.body.sid as string

        const res = await agent.post('/login').send({ username: 'admin', password: 'wrong' })
        expect(res.status).toBe(401)

        const after = await agent.get('/whoami')
        expect(after.body.sid).toBe(sidBefore)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/integration/auth.test.ts`
Expected: FAIL on the first test — the session id does not change today because `auth.ts` reuses the existing session.

- [ ] **Step 3: Update `src/controllers/auth.ts`**

Replace the `router.post('/', ...)` handler body:

```ts
router.post('/', loginLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }
  const validUser = safeCompare(username ?? '', process.env.ADMIN_USER!)
  const validPass = safeCompare(password ?? '', process.env.ADMIN_PASSWORD!)

  if (validUser && validPass) {
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({ success: false, message: 'Error interno' })
        return
      }
      req.session.authenticated = true
      req.session.save(() => res.json({ success: true }))
    })
    return
  }

  res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/integration/auth.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/controllers/auth.ts src/__tests__/integration/auth.test.ts
git commit -m "fix(security): regenerate session on successful login to prevent fixation"
```

---

### Task 7: Move logout to `POST` so it is CSRF-protected

**Files:**
- Modify: `src/router.ts`
- Test: `src/__tests__/integration/logout.test.ts` (new)

**Interfaces:**
- Consumes: `doubleCsrfProtection`, `generateToken` from `src/csrf.ts` (existing, unchanged).
- Produces: `POST /logout` returning `{ success: true }` on success — replaces `GET /logout` (redirect-based). Task 8 (frontend) consumes this new contract.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/integration/logout.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import router from '../../router'
import { doubleCsrfProtection } from '../../csrf'

function createTestApp() {
    const app = express()
    app.use(express.json())
    app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }))
    app.use(cookieParser('test-secret'))
    app.use(doubleCsrfProtection)
    app.use(router)
    return app
}

beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret'
    process.env.ADMIN_USER = 'admin'
    process.env.ADMIN_PASSWORD = 'secret123'
})

describe('POST /logout', () => {
    it('rejects without a valid CSRF token', async () => {
        const agent = request.agent(createTestApp())
        const res = await agent.post('/logout')
        expect(res.status).toBe(403)
    })

    it('destroys the session with a valid CSRF token', async () => {
        const agent = request.agent(createTestApp())
        const tokenRes = await agent.get('/api/csrf-token')
        const { token } = tokenRes.body as { token: string }

        const res = await agent.post('/logout').set('x-csrf-token', token)
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ success: true })

        const me = await agent.get('/api/me')
        expect(me.body.authenticated).toBe(false)
    })

    it('GET /logout no longer exists', async () => {
        const agent = request.agent(createTestApp())
        const res = await agent.get('/logout')
        expect(res.status).toBe(404)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/integration/logout.test.ts`
Expected: FAIL — `GET /logout` currently exists (so the 404 test fails) and `POST /logout` doesn't exist yet (so it 404s instead of 403/200).

- [ ] **Step 3: Update `src/router.ts`**

Replace:

```ts
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect('/'))
})
```

with:

```ts
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }))
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/integration/logout.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/router.ts src/__tests__/integration/logout.test.ts
git commit -m "fix(security): require CSRF-protected POST for logout instead of GET"
```

---

### Task 8: Update the frontend logout call to `POST` with a CSRF token

**Files:**
- Modify: `client/src/components/steps/DoneStep.tsx`

**Interfaces:**
- Consumes: `POST /logout` (Task 7), `csrfToken` and `authStatus` signals from `client/src/signals.ts` (existing), `apiUrl` from `client/src/api.ts` (existing).

- [ ] **Step 1: Update `DoneStep.tsx`**

Replace the full contents of `client/src/components/steps/DoneStep.tsx`:

```tsx
import { authStatus, columns, csrfToken, jobId, mapping, mode, wizardStep } from '../../signals'
import { apiUrl } from '../../api'

function resetWizard() {
  wizardStep.value = 'upload'
  columns.value = []
  mapping.value = {}
  jobId.value = null
  mode.value = 'users'
}

async function handleLogout() {
  await fetch(apiUrl('/logout'), {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken.value },
  })
  authStatus.value = 'unauthenticated'
}

export default function DoneStep() {
  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <h2>Operación completada</h2>
      <p>El archivo de resultados fue descargado automáticamente.</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button onClick={resetWizard} style={{ padding: '8px 16px' }}>Nueva carga</button>
        <button onClick={handleLogout} style={{ padding: '8px 16px' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `pnpm run dev:backend` (one terminal) and `pnpm run dev:frontend` (another terminal). Log in, complete a batch (or navigate directly to the "done" step if the wizard allows), click "Cerrar sesión", and confirm:
- The app returns to the login screen (no full page reload/redirect).
- A subsequent `GET /api/me` (visible in the Network tab on next app load) reports `authenticated: false`.
- No CSRF error appears in the Network tab for the `POST /logout` call.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/steps/DoneStep.tsx
git commit -m "fix(security): call POST /logout with CSRF token from the frontend"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass, including the new/rewritten files from Tasks 1-7.

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `pnpm run build`
Expected: succeeds without errors.

- [ ] **Step 4: Manual smoke test against the local CMS install**

With `CMS_ENV_SCRIPT` unset and set (pointing at a real or stub env script under `~/Documentos/cms`), upload a small CSV via the running app and confirm:
- A normal row (valid name/username) still creates a user successfully.
- A row whose username column value is `--unrestricted` (or similar leading-`-` value) is rejected with a per-row error in the results CSV, and `cmsAddUser` is never invoked for that row.
- The `CMS_ENV_SCRIPT` case (if configured) still successfully sources the script and runs the CLI.

- [ ] **Step 5: Commit (only if Step 4 surfaced fixes)**

If Step 4 requires no code changes, no commit is needed for this task — it is a verification gate, not a deliverable.
