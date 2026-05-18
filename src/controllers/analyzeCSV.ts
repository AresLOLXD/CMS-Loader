import { parse } from "csv/sync";
import { NextFunction, Request, Response, Router } from "express";
import { readFile, unlink } from "fs/promises";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { CSVRecord } from "../utils";
import { jobStore } from "../jobs/JobStore"

const router = Router();
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })

const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter(req, file, callback) {
        const allowedTypes = ["text/csv", "application/vnd.ms-excel", "text/plain"];
        if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".csv")) {
            callback(null, true);
        } else {
            callback(new Error("Tipo de archivo no permitido"));
        }
    },
});

router.post("/", limiter, (req: Request, res: Response, next: NextFunction) => {
    upload.single("archivo")(req, res, (err) => {
        if (err) {
            res.status(400).json({ success: false, message: err.message })
            return
        }
        next()
    })
}, async (req: Request, res: Response) => {
    let filePath: string | undefined;
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Archivo no cargado" });
        }

        filePath = req.file.path;
        const contenido = await readFile(filePath);
        const registros = parse(contenido, {
            trim: true,
            columns: true,
            skip_empty_lines: true,
        }) as CSVRecord[];

        if (!Array.isArray(registros) || registros.length === 0) {
            return res.status(422).json({ success: false, message: "CSV vacío o no válido" });
        }

        const columnasTodos = registros.map((columnas) => Object.keys(columnas));
        const columnasFinales = columnasTodos.reduce((columnasEncontradas: string[], columnas: string[]) => {
            const nuevasColumnasEncontradas = [...columnasEncontradas];
            for (const columna of columnas) {
                if (!nuevasColumnasEncontradas.includes(columna)) {
                    nuevasColumnasEncontradas.push(columna);
                }
            }
            return nuevasColumnasEncontradas;
        }, [] as string[]);

        const job = jobStore.create(registros, columnasFinales)
        req.session.activeJobId = job.id
        if (req.session.saveAsync) {
            await req.session.saveAsync()
        }
        res.json({ success: true, message: "CSV procesado", data: { jobId: job.id, columnas: columnasFinales } })
    } catch (err) {
        console.error("Error analizeCSV:", err);
        const message = err instanceof Error ? err.message : "Error interno";
        res.status(500).json({ success: false, message });
    } finally {
        if (filePath) {
            try {
                await unlink(filePath);
            } catch (ignore) {
                console.warn("No se pudo eliminar archivo temporal:", filePath, ignore);
            }
        }
    }
});

export default router;