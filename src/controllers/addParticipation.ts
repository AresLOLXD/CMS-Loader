import { stringify } from "csv/sync";
import { Request, Response, Router } from "express";
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
        tiempo_retraso?: number,
        tiempo_extra?: number,
        team?: string,
        oculto?: boolean,
        sin_restricciones?: boolean,
        password?: string

    }) {
    let argumentos = []



    if (contest) {
        argumentos.push("-c")
        argumentos.push(registro[contest])
    } else {
        throw Error("Concurso no definido")
    }
    if (ip) {
        argumentos.push("-i")
        argumentos.push(registro[ip])
    }
    if (tiempo_retraso) {
        argumentos.push("-d")
        argumentos.push(registro[tiempo_retraso])
    }
    if (tiempo_extra) {
        argumentos.push("-e")
        argumentos.push(registro[tiempo_extra])
    }
    if (team) {
        argumentos.push("-t")
        argumentos.push(registro[team])
    }
    if (oculto) {
        argumentos.push("--hidden")
    }
    if (sin_restricciones) {
        argumentos.push("--unrestricted")
    }

    if (password) {
        argumentos.push("-p")
        argumentos.push(registro[password])
        argumentos.push("--bcrypt")
    }

    if (usuario) {
        argumentos.push(registro[usuario])
    } else {
        throw Error("Usuario no definido")
    }

    argumentos = argumentos.map(value => String(value))


    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddParticipation ${shellescape(argumentos)}`
    console.log("Comando: ", commando)
    const salida = await executeProcess(commando)
    console.log("Salida: ", salida)
    return salida
}



router.post("/", async (req: Request, res: Response) => {
    try {
        const registros = req.body.registros;
        const { contest, ip, tiempo_retraso, tiempo_extra, team, oculto, sin_restricciones, password, usuario } = req.body;

        const lineasCorrectas: { indice: number, password?: string }[] = []
        const lineasErrones: { indice: number, mensaje: string }[] = []


        for (let i = 0; i < registros.lenght; i++) {
            const registro = registros[i];
            try {

                const salida = await procesaRegistro({
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

                if (!password) {
                    const matched = RegExp(/password\s+(\w+)/).exec(salida)
                    let passwordEncontrado = "";
                    if (matched) {
                        passwordEncontrado = matched[0]
                    } else {
                        throw Error(`Revisar usuario ${usuario}, contraseña no se pudo obtener`)
                    }

                    lineasCorrectas.push({
                        indice: i,
                        password: passwordEncontrado
                    })
                } else {
                    lineasCorrectas.push({
                        indice: i,
                    })
                }

            } catch (error) {
                console.error(error)
                let mensaje = "Hubo un error procesando la fila"
                if (error instanceof Error)
                    mensaje = error.message
                lineasErrones.push({
                    indice: i,
                    mensaje: mensaje
                })

            }
        }


        const salida = [
            ...lineasCorrectas.map(valor => ({
                Indice: valor.indice,
                Extra: valor.password ?? ""
            })),
            ...lineasErrones.map(valor => ({
                Indice: valor.indice,
                Extra: valor.mensaje
            }))
        ].sort((a, b) => {
            return a.Indice - b.Indice
        })

        const csvGenerated = stringify(salida)

        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Length", Buffer.byteLength(csvGenerated))
        res.setHeader("Content-Disposition", "attachment; filename=\"Resultados.csv\"")

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