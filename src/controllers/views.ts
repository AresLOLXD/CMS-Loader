import { Request, Response, Router } from "express"
import { generateToken } from "../csrf"

const router = Router()

router.get("/seleccionaColumnasUser", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect("cargaUsuarios.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasUser.ejs", { columnas, csrfToken })
})

router.get("/seleccionaColumnasConcurso", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect("cargaConcurso.html")
        return
    }
    const csrfToken = generateToken(req, res)
    res.render("seleccionaColumnasConcurso.ejs", { columnas, csrfToken })
})

export default router
