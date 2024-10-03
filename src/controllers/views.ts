import { Router, Request, Response } from "express";
const router = Router()

router.get("/selectCollumnsUser", (req: Request, res: Response) => {
    const { registros, columnas } = req.session
    if (!registros || !columnas) {
        res.redirect("/cargaUsuarios.html")
        return
    }
    res.render("seleccionaColumnasUser.ejs", {
        columnas
    })
})


export default router