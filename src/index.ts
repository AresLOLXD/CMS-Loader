import express, { Request, Response, static as static_ } from "express"
import session from "express-session"
import morgan from "morgan"
import { join } from "path"
import { createStream } from "rotating-file-stream"
import Rutas from "./router"
import { CSVRecord } from "./utils"
import { promisify } from "util"

declare module "express-session" {
    interface SessionData {
        registros: CSVRecord[],
        columnas: string[],
        saveAsync: () => Promise<void>
    }
}

const app = express()
const port = 9995

const accessLogStream = createStream(
    "access.log",
    {
        interval: "1d",
        compress: "gzip",
        maxFiles: 20,
    })
app.use(session({
    secret: '9e9f7a51e150c86ec647c801948f02e5',
    cookie: {
        secure: true,
        maxAge: 1000 * 60 * 5,
        sameSite: "none",
    },
    resave: true,
    saveUninitialized: true,
    name: "CMS_Loader",
    proxy: true,
}))
app.use((req, _res, next) => {
    req.session.saveAsync = promisify(req.session.save.bind(req.session));
    next();
});

app.use(morgan("common", { stream: accessLogStream }))
app.use("/public", static_(join(__dirname, "public")))
app.use("/", static_(join(__dirname, "public", "html")))
app.use(Rutas)

app.set('view engine', 'ejs');
app.set("views", join(__dirname, "views"))

app.set('trust proxy', "loopback")


app.all("*", (req: Request, res: Response) => {
    res.redirect("/index.html")
})


app.listen(port, () => {
    console.log(`Servidor iniciado en ${port}`)
})