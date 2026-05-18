import { stringify } from "csv/sync"
import { Request, Response } from "express"
import { CSVRecord } from "./csv"

interface ProcessRecordsOptions {
    redirectTo: string
    filename: string
    processor: (registro: CSVRecord, body: unknown) => Promise<string | void>
}

export async function processRecords(
    req: Request,
    res: Response,
    options: ProcessRecordsOptions
): Promise<void> {
    const session = req.session as typeof req.session & { registros?: CSVRecord[] }
    const { registros } = session
    if (!registros) {
        res.redirect(options.redirectTo)
        return
    }

    const salida: { Indice: number; Extra: string }[] = []

    for (let i = 0; i < registros.length; i++) {
        const registro = registros[i]
        try {
            const result = await options.processor(registro, req.body)
            if (result) {
                salida.push({ Indice: i + 2, Extra: result })
            }
        } catch (error) {
            console.error(error)
            const mensaje = error instanceof Error ? error.message : "Hubo un error procesando la fila"
            salida.push({ Indice: i + 2, Extra: mensaje })
        }
    }

    salida.sort((a, b) => a.Indice - b.Indice)

    const csvGenerated = stringify(salida, { header: true, quoted: true })

    delete session.registros
    delete (req.session as typeof req.session & { columnas?: string[] }).columnas

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename="${options.filename}"`)
    res.setHeader("Content-Length", Buffer.byteLength(csvGenerated))
    res.end(csvGenerated)
}
