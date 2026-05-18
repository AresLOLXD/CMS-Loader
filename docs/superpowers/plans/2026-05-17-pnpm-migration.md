# pnpm Migration + Supply Chain Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate CMS-Loader from npm to pnpm v11 and enable all supply chain security features from pnpm-workspace.yaml.

**Architecture:** Replace `package-lock.json` with `pnpm-lock.yaml`, create `pnpm-workspace.yaml` as the single config file for workspace definition and all security settings, and update `package.json` scripts to use pnpm equivalents.

**Tech Stack:** pnpm v11, Node.js, TypeScript

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `pnpm-workspace.yaml` | Workspace definition + all security settings |
| Modify | `package.json` | Update `build` and `start` scripts |
| Delete | `package-lock.json` | Replaced by pnpm-lock.yaml |
| Generated | `pnpm-lock.yaml` | New lockfile (committed) |

---

### Task 1: Create `pnpm-workspace.yaml`

**Files:**
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Create the file**

```yaml
packages:
  - '.'

onlyBuiltDependencies: []

blockExoticSubdeps: true
trustPolicy: no-downgrade
minimumReleaseAge: 1440
```

Save to `pnpm-workspace.yaml` at the project root.

- [ ] **Step 2: Verify the file is valid YAML**

Run:
```bash
node -e "const fs=require('fs'); require('fs'); console.log(require('js-yaml')?.load(fs.readFileSync('pnpm-workspace.yaml','utf8')) ?? 'no js-yaml, skip')" 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('pnpm-workspace.yaml')); print('valid')"
```

If neither is available, visually confirm indentation is correct (2-space, no tabs).

---

### Task 2: Update `package.json` scripts

**Files:**
- Modify: `package.json`

The `build` and `start` scripts reference `npm run` and `npx` internally. Replace them with pnpm equivalents so the package manager is consistent.

- [ ] **Step 1: Update the `build` script**

Current:
```json
"build": "npm run clean && npx tsc && npm run copy-files",
```

Replace with:
```json
"build": "pnpm run clean && pnpm exec tsc && pnpm run copy-files",
```

- [ ] **Step 2: Update the `start` script**

Current:
```json
"start": "npm run build && node dist/index.js",
```

Replace with:
```json
"start": "pnpm run build && node dist/index.js",
```

- [ ] **Step 3: Verify no remaining `npm` references in scripts**

Run:
```bash
node -e "const s=require('./package.json').scripts; const hits=Object.entries(s).filter(([,v])=>v.includes('npm ')); console.log(hits.length ? 'REMAINING npm refs: '+JSON.stringify(hits) : 'OK — no npm refs')"
```

Expected output: `OK — no npm refs`

---

### Task 3: Replace lockfile

**Files:**
- Delete: `package-lock.json`
- Generated: `pnpm-lock.yaml`

- [ ] **Step 1: Delete the npm lockfile**

```bash
rm package-lock.json
```

- [ ] **Step 2: Run `pnpm install`**

```bash
pnpm install
```

Expected: dependencies install cleanly and `pnpm-lock.yaml` is generated.

If pnpm reports packages blocked by `onlyBuiltDependencies`, it will output something like:

```
 ERR_PNPM_BUILD_NOT_ALLOWED  Cannot build <package-name>
```

In that case, add the blocked package name to `onlyBuiltDependencies` in `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - <package-name>
```

Then re-run `pnpm install`.

- [ ] **Step 3: Verify `pnpm-lock.yaml` was generated**

```bash
ls -lh pnpm-lock.yaml
```

Expected: file exists and is non-empty (several KB).

---

### Task 4: Verify the build works

- [ ] **Step 1: Run the build**

```bash
pnpm run build
```

Expected: completes without errors, `dist/` is populated with compiled JS and copied EJS/HTML/CSS files.

- [ ] **Step 2: Run the test suite**

```bash
pnpm run test
```

Expected: all tests pass.

---

### Task 5: Commit

- [ ] **Step 1: Stage all changes**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml package.json
git rm package-lock.json
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: migrate to pnpm v11 with supply chain security hardening"
```
