import { Request, Response, Router } from "express";
const router = Router()

router.get("/seleccionaColumnasUser", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        const URL = req.path
        const BASEURL = URL.split('/').slice(0, -1).join('/');
        res.redirect(`${BASEURL}/cargaUsuarios.html`)
        return
    }
    res.render("seleccionaColumnasUser.ejs", {
        columnas
    })
})


router.get("/seleccionaColumnasConcurso", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect(`${BASEURL}/cargaConcurso.html`)
        return
    }
    res.render("seleccionaColumnasConcurso.ejs", {
        columnas
    })
})


export default router