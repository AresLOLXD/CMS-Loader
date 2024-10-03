import { stringify } from "csv/sync";
import { json, Request, Response, Router } from "express";
import shellescape from "shell-escape";
import { CSVRecord, executeProcess } from "../utils";

const router = Router()


async function procesaRegistro(
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
        contest: string
        ip?: string,
        tiempo_retraso?: string,
        tiempo_extra?: string,
        team?: string,
        oculto?: string,
        sin_restricciones?: string,
        password?: string

    }) {
    const argumentos: string[] = []

    if (contest && registro[contest]) {
        const contest_numero = Number.parseInt(registro[contest])
        if (Number.isNaN(contest_numero)) {
            throw Error(`El valor ${registro[contest]} para el concurso no es un valor valido`)
        } else {
            argumentos.push("-c")
            argumentos.push(contest_numero.toString())
        }
    } else {
        throw Error("Concurso no definido")
    }

    if (ip && registro[ip]) {
        argumentos.push("-i")
        argumentos.push(registro[ip])
    }

    if (tiempo_retraso && registro[tiempo_retraso]) {
        const tiempo_retraso_numero = Number.parseInt(registro[tiempo_retraso])
        if (Number.isNaN(tiempo_retraso_numero)) {
            throw Error(`El valor ${registro[tiempo_retraso]} para tiempo retraso no es un valor valido`)
        } else {
            argumentos.push("-d")
            argumentos.push(tiempo_retraso_numero.toString())
        }
    }

    if (tiempo_extra && registro[tiempo_extra]) {
        const tiempo_extra_numero = Number.parseInt(registro[tiempo_extra])
        if (Number.isNaN(tiempo_extra_numero)) {
            throw Error(`El valor ${registro[tiempo_extra]} para tiempo retraso no es un valor valido`)
        } else {
            argumentos.push("-e")
            argumentos.push(tiempo_extra_numero.toString())
        }
    }

    if (team && registro[team]) {
        argumentos.push("-t")
        argumentos.push(registro[team])
    }

    if (oculto && registro[oculto]) {
        if (registro[oculto].toLowerCase() === "true" || Number.parseInt(registro[oculto]) == 1)
            argumentos.push("--hidden")
        else if (registro[oculto].toLowerCase() !== "false" && Number.isNaN(Number.parseInt(registro[oculto])))
            throw Error(`El valor ${registro[oculto]} para oculto no es un valor valido`)
    }

    if (sin_restricciones && registro[sin_restricciones]) {
        if (registro[sin_restricciones].toLowerCase() === "true" || Number.parseInt(registro[sin_restricciones]) == 1)
            argumentos.push("--unrestricted")
        else if (registro[sin_restricciones].toLowerCase() !== "false" && Number.isNaN(Number.parseInt(registro[sin_restricciones])))
            throw Error(`El valor ${registro[sin_restricciones]} para sin restricciones no es un valor valido`)
    }

    if (password && registro[password]) {
        argumentos.push("-p")
        argumentos.push(registro[password])
        argumentos.push("--bcrypt")
    }

    if (usuario && registro[usuario]) {
        argumentos.push(registro[usuario])
    } else {
        throw Error("Usuario no definido")
    }



    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddParticipation ${shellescape(argumentos)}`
    console.log("Comando: ", commando)
    await executeProcess(commando)

}



router.post("/", json(), async (req: Request, res: Response) => {
    try {
        const { registros } = req.session
        if (!registros) {
            res.redirect("/cargaConcurso.html")
            return
        }
        const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body;
        const salida: { Indice: number, Extra: string }[] = []


        for (let i = 0; i < registros.length; i++) {
            const registro = registros[i];
            try {

                await procesaRegistro({
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
                })

            } catch (error) {
                console.error(error)
                let mensaje = "Hubo un error procesando la fila"
                if (error instanceof Error)
                    mensaje = error.message
                salida.push({
                    Indice: i + 2,
                    Extra: mensaje
                })

            }
        }


        const csvGenerated = stringify(salida, {
            header: true,
            quoted: true
        })

        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Length", Buffer.byteLength(csvGenerated))
        res.setHeader("Content-Disposition", "attachment; filename=\"Errores.csv\"")

        res.end(csvGenerated)
    } catch (err) {
        console.error("Error: ", err)
        res.status(500).json({
            Estado: "Error",
            Mensaje: err
        })
    }

})


export default router