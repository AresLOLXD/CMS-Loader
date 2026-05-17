import { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import shellescape from "shell-escape"
import { CSVRecord, executeProcess, processRecords } from "../utils"

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

    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ${shellescape(argumentos)}`.replace(/'""'/g, `""`)
    return executeProcess(commando)
}


router.post("/", limiter, async (req: Request, res: Response) => {
    const { email, timezone, languages, password, nombre, apellidos, usuario } = req.body

    await processRecords(req, res, {
        redirectTo: "cargaUsuarios.html",
        filename: "Resultados.csv",
        processor: async (registro) => {
            const salida = await procesaRegistro({ registro, email, timezone, languages, password, nombre, apellidos, usuario })

            if (!password || !registro[password]) {
                const matched = /password\s+(\w+)/.exec(salida)
                if (!matched) {
                    throw new Error(`Revisar usuario ${usuario}, contraseña no se pudo obtener`)
                }
                return matched[1]
            }
        }
    })
})


export default router
