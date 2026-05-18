import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import pLimit from "p-limit"
import { CSVRecord, buildCmsCommand, executeProcess, parseBoolFlag } from "../utils"
import { jobStore } from "../jobs/JobStore"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })


export async function procesaRegistro(
    {
        registro,
        contest,
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

    if (usuario && registro[usuario]) {
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    await executeProcess(buildCmsCommand('cmsAddParticipation', argumentos))
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.status(400).json({ success: false, message: "No hay registros cargados" })
        return
    }

    const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body
    jobStore.update(job.id, { status: 'running', filename: 'Errores.csv' })
    res.json({ jobId: job.id })

    const limit = pLimit(Number(process.env.CMS_CONCURRENCY) || 5)
    const tasks = job.records.map((registro, i) =>
        limit(async () => {
            try {
                await procesaRegistro({ registro, contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario })
            } catch (err) {
                job.results.push({ Indice: i + 2, Extra: err instanceof Error ? err.message : 'Error procesando la fila' })
            } finally {
                job.processed++
            }
        })
    )

    Promise.all(tasks)
        .then(() => {
            job.results.sort((a, b) => a.Indice - b.Indice)
            jobStore.update(job.id, { status: 'done' })
        })
        .catch(() => {
            jobStore.update(job.id, { status: 'error' })
        })
})


export default router
