import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import { buildCmsCommand, CSVRecord, executeProcess, parseBoolFlag, processRecords } from "../utils"

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

    const commando = buildCmsCommand('cmsAddParticipation', argumentos)
    await executeProcess(commando)
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body

    await processRecords(req, res, {
        redirectTo: "cargaConcurso.html",
        filename: "Errores.csv",
        processor: async (registro) => {
            await procesaRegistro({ registro, contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario })
        }
    })
})


export default router
