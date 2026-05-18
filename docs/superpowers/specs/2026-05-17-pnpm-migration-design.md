# pnpm Migration + Supply Chain Security

**Date:** 2026-05-17
**Scope:** Local configuration only — no CI/CD changes.

## Goal

Migrate CMS-Loader from npm to pnpm v11 and enable all applicable supply chain security features from https://pnpm.io/supply-chain-security.

## Files Changed

### `pnpm-workspace.yaml` (new)

Single source of truth for workspace definition and all non-auth pnpm settings.

```yaml
packages:
  - '.'

onlyBuiltDependencies: []

blockExoticSubdeps: true
trustPolicy: no-downgrade
minimumReleaseAge: 1440
```

`onlyBuiltDependencies` is an empty list because no dependency in this project compiles native code. If a future dependency requires a postinstall build, it must be explicitly added here.

### `package.json` — scripts only

Replace internal `npm run` and `npx` references with their pnpm equivalents:

```json
"build": "pnpm run clean && pnpm exec tsc && pnpm run copy-files",
"start": "pnpm run build && node dist/index.js"
```

All other scripts remain unchanged.

### Lockfile

Delete `package-lock.json`. Run `pnpm install` to generate `pnpm-lock.yaml`. Commit the new lockfile.

`.gitignore` requires no changes (only ignores `/node_modules` and `/dist`).

## Security Features Applied

| Feature | Configuration | What it prevents |
|---|---|---|
| Block postinstall scripts | `onlyBuiltDependencies: []` | Malicious code executing at install time |
| Block exotic subdeps | `blockExoticSubdeps: true` | Transitive deps sourced from git URLs or tarballs |
| Trust policy | `trustPolicy: no-downgrade` | Installing packages with reduced trust vs prior releases |
| Minimum release age | `minimumReleaseAge: 1440` | Newly published packages (typosquatting, hijacking) |
| Lockfile | `pnpm-lock.yaml` committed | Unexpected version resolution across environments |

## Out of Scope

- `trustPolicyExclude` / `trustPolicyIgnoreAfter` — override settings, not needed here.
- `.npmrc` — only auth/registry settings go there; none are needed in this project.
- CI/CD pipeline changes.

## Implementation Notes

- pnpm v11 must be installed globally before running `pnpm install`.
- If `pnpm install` reports packages blocked by `onlyBuiltDependencies`, add only the necessary ones to the list in `pnpm-workspace.yaml`.
- `minimumReleaseAge=1440` means newly published package versions are not resolved until they are at least 24 hours old. This is the pnpm v11 default, set explicitly for clarity.
