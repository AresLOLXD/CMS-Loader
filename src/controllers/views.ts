import { Request, Response, Router } from "express"
import { generateToken } from "../csrf"
import { jobStore } from "../jobs/JobStore"

const router = Router()

router.get("/seleccionaColumnasUser", (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.redirect("cargaUsuarios.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasUser.ejs", { columnas: job.columnas, csrfToken })
})

router.get("/seleccionaColumnasConcurso", (req: Request, res: Response) => {
    const job = req.session.activeJobId ? jobStore.get(req.session.activeJobId) : undefined
    if (!job) {
        res.redirect("cargaConcurso.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasConcurso.ejs", { columnas: job.columnas, csrfToken })
})

export default router
