import { stringify } from "csv/sync";
import { json, Request, Response, Router } from "express";
import shellescape from "shell-escape";
import { CSVRecord, executeProcess } from "../utils";

const router = Router()

async function procesaRegistro(
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
    }) {
    let argumentos = []
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
        argumentos.push("--bcrypt")
    }
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
        throw Error("Usuario no definido")
    }


    argumentos = argumentos.map(value => String(value))

    const commando = `. /var/local/lib/cms/cmsEnv.sh && cmsAddUser ${shellescape(argumentos)}`
    console.log("Comando: ", commando)
    const salida = await executeProcess(commando)
    //const salida = ""
    return salida

}


router.post("/", json(), async (req: Request, res: Response) => {
    try {
        const { registros } = req.session

        if (!registros) {
            res.redirect("/cargaUsuarios.html")
            return
        }

        const { email, timezone, languages, password, nombre, apellidos, usuario } = req.body;

        const lineasCorrectas: { indice: number, password: string }[] = []
        const lineasErrones: { indice: number, mensaje: string }[] = []


        for (let i = 0; i < registros.length; i++) {
            const registro = registros[i];
            try {

                const salida = await procesaRegistro({
                    apellidos,
                    email,
                    languages,
                    nombre,
                    password,
                    registro,
                    timezone,
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
                        indice: i + 2,
                        password: `Password: "${passwordEncontrado}"`
                    })
                }

            } catch (error) {
                console.error(error)
                let mensaje = "Hubo un error procesando la fila"
                if (error instanceof Error)
                    mensaje = error.message
                lineasErrones.push({
                    indice: i + 2,
                    mensaje: mensaje
                })

            }
        }


        const salida = [
            ...lineasCorrectas.map(valor => ({
                Indice: valor.indice,
                Extra: valor.password
            })),
            ...lineasErrones.map(valor => ({
                Indice: valor.indice,
                Extra: valor.mensaje
            }))
        ].sort((a, b) => {
            return a.Indice - b.Indice
        })

        const csvGenerated = stringify(salida, {
            header: true,
            quoted: true
        })

        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Disposition", "attachment; filename=\"Resultados.csv\"")
        res.setHeader("Content-Length", Buffer.byteLength(csvGenerated))

        res.end(csvGenerated)
        req.session.columnas = undefined;
        req.session.registros = undefined;
    } catch (err) {
        console.error("Error: ", err)
        res.status(500).json({
            Estado: "Error",
            Mensaje: err
        })
    }

})


export default router