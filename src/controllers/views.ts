import { Router, Request, Response } from "express";
const router = Router()

router.get("/seleccionaColumnasUser", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect("/cargaUsuarios.html")
        return
    }
    res.render("seleccionaColumnasUser.ejs", {
        columnas
    })
})


router.get("/seleccionaColumnasConcurso", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect("/cargaConcurso.html")
        return
    }
    res.render("seleccionaColumnasConcurso.ejs", {
        columnas
    })
})


export default router