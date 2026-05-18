import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import pLimit from "p-limit"
import { CSVRecord, buildCmsCommand, executeProcess } from "../utils"
import { jobStore } from "../jobs/JobStore"

const router = Router()

const limiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })

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

    if (nombre && registro[nombre]) {
        argumentos.push(registro[nombre])
    } else {
        argumentos.push('""')
    }
    if (apellidos && registro[apellidos]) {
        argumentos.push(registro[apellidos])
    } else {
        argumentos.push('""')
    }
    if (usuario && registro[usuario]) {
        argumentos.push(registro[usuario])
    } else {
        throw new Error("Usuario no definido")
    }

    return executeProcess(buildCmsCommand('cmsAddUser', argumentos))
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.status(400).json({ success: false, message: "No hay registros cargados" })
        return
    }
    if (job.status !== 'pending') {
        res.status(409).json({ success: false, message: "Trabajo ya iniciado" })
        return
    }

    const { email, timezone, languages, password, nombre, apellidos, usuario } = req.body
    jobStore.update(job.id, { status: 'running', filename: 'Resultados.csv' })
    res.json({ jobId: job.id })

    const limit = pLimit(Number(process.env.CMS_CONCURRENCY) || 5)
    const tasks = job.records.map((registro, i) =>
        limit(async () => {
            try {
                const salida = await procesaRegistro({ registro, email, timezone, languages, password, nombre, apellidos, usuario })
                if (!password || !registro[password]) {
                    const matched = /password\s+(\w+)/.exec(salida)
                    if (!matched) throw new Error(`Revisar usuario ${registro[usuario]}, contraseña no se pudo obtener`)
                    job.results.push({ Indice: i + 2, Extra: matched[1] })
                }
            } catch (err) {
                job.results.push({ Indice: i + 2, Extra: err instanceof Error ? err.message : 'Error procesando la fila' })
            } finally {
                job.processed++
            }
        })
    )

    void Promise.all(tasks)
        .then(() => {
            job.results.sort((a, b) => a.Indice - b.Indice)
            jobStore.update(job.id, { status: 'done' })
        })
        .catch((err: unknown) => {
            console.error("Error inesperado en el procesamiento del trabajo:", err)
            jobStore.update(job.id, { status: 'error' })
        })
})


export default router
