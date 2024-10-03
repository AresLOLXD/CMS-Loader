import express, { Request, Response, static as static_ } from "express"
import fs from "fs"
import morgan from "morgan"
import { join } from "path"
import Rutas from "./router"
import session from "express-session"
import { CSVRecord } from "./utils"


declare module "express-session" {
    interface SessionData {
        registros: CSVRecord[],
        columnas: string[]
    }
}

const app = express()
const port = 9995

const accessLogStream = fs.createWriteStream(
    join(__dirname, 'access.log'),
    {
        flags: 'as'
    })
app.use(session({
    secret: '9e9f7a51e150c86ec647c801948f02e5',
    cookie: {
        secure: true,
        maxAge: 1000 * 60 * 5,
        sameSite: "strict"
    },
    resave: false,
    saveUninitialized: true,

}))

app.use(morgan("common", { stream: accessLogStream }))
app.use("/public", static_(join(__dirname, "public")))
app.use("/", static_(join(__dirname, "public", "html")))
app.use(Rutas)

app.set('view engine', 'ejs');
app.set("views", join(__dirname, "views"))

app.set('trust proxy', "loopback")



app.all("/*", (req: Request, res: Response) => {
    res.redirect("/index.html")
})


app.listen(port, () => {
    console.log(`Servidor iniciado en ${port}`)
})