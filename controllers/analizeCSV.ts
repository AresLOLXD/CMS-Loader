import { Request, Response, Router } from "express";
import multer from "multer"
import { parse } from "csv/sync"
import { readFile } from "fs/promises";

const router = Router()

const upload = multer({
    dest: "uploads/",
    fileFilter(req, file, callback) {
        if (file.mimetype === "text/csv")
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
        })
        //TODO: Arreglar esta cosa
        const columnasTodos = registros.map((columnas: any) => {
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


export default router