import { stringify } from "csv/sync"
import { Request, Response, Router } from "express"
import { jobStore } from "../jobs/JobStore"

const router = Router()

router.get("/:id/events", (req: Request, res: Response) => {
    const jobId = req.params.id as string
    const job = jobStore.get(jobId)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
        return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders()

    let lastProcessed = -1

    const interval = setInterval(() => {
        const current = jobStore.get(jobId)
        if (!current) {
            clearInterval(interval)
            res.end()
            return
        }

        if (current.processed !== lastProcessed) {
            lastProcessed = current.processed
            const percent = current.total > 0
                ? Math.round((current.processed / current.total) * 100)
                : 0
            res.write(`event: progress\ndata: ${JSON.stringify({ processed: current.processed, total: current.total, percent })}\n\n`)
        }

        if (current.status === 'done') {
            res.write(`event: done\ndata: ${JSON.stringify({ jobId: current.id, resultCount: current.results.length })}\n\n`)
            clearInterval(interval)
            res.end()
            return
        }

        if (current.status === 'error') {
            res.write(`event: job-error\ndata: ${JSON.stringify({ message: "Error interno" })}\n\n`)
            clearInterval(interval)
            res.end()
        }
    }, 200)

    req.on('close', () => {
        clearInterval(interval)
    })
})

router.get("/:id/result", (req: Request, res: Response) => {
    const job = jobStore.get(req.params.id as string)
    if (!job) {
        res.status(404).json({ success: false, message: "Trabajo no encontrado" })
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
