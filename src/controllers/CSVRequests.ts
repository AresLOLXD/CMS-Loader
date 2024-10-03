import { parse } from "csv/sync";
import { json, Request, Response, Router } from "express";
import { readFile } from "fs/promises";
import multer from "multer";
import { CSVRecord } from "../utils";

const router = Router()

const upload = multer({
    dest: "uploads/",
    fileFilter(req, file, callback) {
        if (["text/csv", "application/vnd.ms-excel"].includes(file.mimetype))
            callback(null, true)
        else
            callback(null, false)
    },
})

router.post("/analizeCSV", upload.single("archivo"), async (req: Request, res: Response) => {
    if (req.file) {
        const ruta = req.file.path;
        const contenido = await readFile(ruta)
        const registros = parse(contenido, {
            trim: true,
            columns: true,
            skip_empty_lines: true,
        }) as CSVRecord[]
        const columnasTodos = registros.map((columnas) => {
            return Object.keys(columnas)
        })

        const columnasFinales = columnasTodos.reduce((columnasEncontradas: string[], columnas: string[]) => {
            const nuevasColumnasEncontradas = [...columnasEncontradas]
            for (const columna of columnas) {
                if (!nuevasColumnasEncontradas.includes(columna)) {
                    nuevasColumnasEncontradas.push(columna)
                }
            }
            return nuevasColumnasEncontradas
        }, [] as string[])

        res.json({
            registros,
            columnas: columnasFinales
        })

    } else {
        res.status(400).end("Archivo no cargado")
    }
})


router.post("/saveUserCSV", json(), async (req: Request, res: Response) => {
    const { registros, columnas } = req.body

    req.session.registros = registros as CSVRecord[]
    req.session.columnas = columnas as string[]
    res.json({
        Estado: "ok"
    })

})

export default router