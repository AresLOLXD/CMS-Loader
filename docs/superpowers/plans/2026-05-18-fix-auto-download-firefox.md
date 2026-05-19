# Fix Auto-Download Firefox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `downloadBlob` so the CSV file actually downloads on Firefox-based browsers (Zen) when a job completes.

**Architecture:** Two-line patch to `downloadBlob` in `ProcessingStep.tsx` — append `<a>` to DOM before click (Firefox requirement), remove it after, and delay `revokeObjectURL` by 100 ms so the browser can initiate the download before the URL is freed.

**Tech Stack:** Preact, TypeScript, Vite (`npm run build`)

---

### Task 1: Patch `downloadBlob` in ProcessingStep.tsx

**Files:**
- Modify: `client/src/components/steps/ProcessingStep.tsx:4-11`

- [ ] **Step 1: Open the file and locate `downloadBlob`**

The function currently looks like this (lines 4–11):

```ts
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Replace the function body**

Replace the entire `downloadBlob` function with:

```ts
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: build completes with no errors. The compiled output goes to `client/dist/`.

- [ ] **Step 4: Verify the fix manually in Zen/Firefox**

1. Start the dev server: `npm run dev`
2. Log in, upload a CSV, map columns, and submit.
3. Confirm the CSV file downloads automatically when the job finishes.
4. Confirm the `DoneStep` screen shows "Operación completada".

- [ ] **Step 5: Commit**

```bash
git add client/src/components/steps/ProcessingStep.tsx
git commit -m "fix: append <a> to DOM and defer revokeObjectURL so Firefox downloads CSV"
```
