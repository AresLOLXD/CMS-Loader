# Fix: Auto-download fails silently on Firefox

**Date:** 2026-05-18  
**Status:** Approved

## Problem

When a job completes, `ProcessingStep` shows "El archivo de resultados fue descargado automáticamente" but the file is never downloaded on Firefox-based browsers (Zen). Two root causes:

1. `URL.revokeObjectURL(url)` is called synchronously right after `a.click()`. Firefox initiates the download asynchronously, so the URL is revoked before the browser can use it.
2. The `<a>` element is never appended to the document. Firefox requires the element to be in the DOM for programmatic downloads to work; Chromium does not.

## Scope

Single function `downloadBlob` in `client/src/components/steps/ProcessingStep.tsx` (lines 4–11). No server changes, no routing changes, no other components affected.

## Solution

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

Changes from current implementation:
- `document.body.appendChild(a)` before click — satisfies Firefox DOM requirement.
- `document.body.removeChild(a)` after click — immediate cleanup.
- `setTimeout(() => URL.revokeObjectURL(url), 100)` instead of synchronous revocation — gives the browser time to initiate the download.

## Verification

1. `npm run build` — must complete without errors.
2. Full flow in Zen/Firefox: upload CSV → map columns → process → CSV file downloads automatically.
3. Smoke-check in Chromium to confirm no regression.
