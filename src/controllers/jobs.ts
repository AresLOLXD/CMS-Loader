import { stringify } from "csv/sync"
import { Request, Response, Router } from "express"
import { jobStore } from "../jobs/JobStore"

const router = Router()

const POLL_INTERVAL_MS = 200
const HEARTBEAT_INTERVAL_MS = 15_000

router.get("/:id/events", (req: Request<{ id: string }>, res: Response) => {
    const jobId = req.params.id
    const job = jobStore.get(jobId)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
        return
    }
    if (job.ownerSessionId !== req.sessionID) {
        res.status(403).json({ success: false, message: "Acceso denegado" })
        return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    // Disable nginx buffering so events reach the client immediately
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()

    let lastProcessed = -1
    let ticksSinceWrite = 0
    const heartbeatEvery = Math.ceil(HEARTBEAT_INTERVAL_MS / POLL_INTERVAL_MS)

    const interval = setInterval(() => {
        const current = jobStore.get(jobId)
        if (!current) {
            // Job was TTL-evicted while client was connected
            res.write(`event: job-error\ndata: ${JSON.stringify({ message: "Trabajo expirado" })}\n\n`)
            clearInterval(interval)
            res.end()
            return
        }

        if (current.processed !== lastProcessed) {
            lastProcessed = current.processed
            ticksSinceWrite = 0
            const percent = current.total > 0
                ? Math.round((current.processed / current.total) * 100)
                : 0
            res.write(`event: progress\ndata: ${JSON.stringify({ processed: current.processed, total: current.total, percent })}\n\n`)
        } else {
            ticksSinceWrite++
            if (ticksSinceWrite >= heartbeatEvery) {
                ticksSinceWrite = 0
                res.write(": ping\n\n")
            }
        }

        if (current.status === 'done') {
            res.write(`event: done\ndata: ${JSON.stringify({ jobId: current.id, resultCount: current.results.length })}\n\n`)
            clearInterval(interval)
            res.end()
            return
        }

        if (current.status === 'error') {
            // event named job-error (not error) to avoid collision with EventSource's built-in onerror
            res.write(`event: job-error\ndata: ${JSON.stringify({ message: "Error interno" })}\n\n`)
            clearInterval(interval)
            res.end()
        }
    }, POLL_INTERVAL_MS)

    req.on('close', () => {
        clearInterval(interval)
    })
})

router.get("/:id/result", (req: Request<{ id: string }>, res: Response) => {
    const job = jobStore.get(req.params.id)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
        return
    }
    if (job.ownerSessionId !== req.sessionID) {
        res.status(403).json({ success: false, message: "Acceso denegado" })
        return
    }
    if (job.status !== 'done') {
        res.status(409).json({ success: false, message: "Trabajo no completado" })
        return
    }

    const csv = stringify(job.results, { header: true, quoted: true })
    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`)
    res.setHeader("Content-Length", Buffer.byteLength(csv))
    res.end(csv)
})

export default router
