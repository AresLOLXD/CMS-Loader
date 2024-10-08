import { parse } from "csv/sync";
import { Request, Response, Router } from "express";
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
    try {
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
            req.session.registros = registros;
            req.session.columnas = columnasFinales


            res.json({
                Estado: "ok"
            })

        } else {
            res.status(400).end("Archivo no cargado")
        }
    } catch (err) {
        console.error("Error: ", err)
        res.status(500).json({
            Estado: "Error",
            Mensaje: err
        })
    }
})

export default router