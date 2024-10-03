import express from "express"
import fs from "fs"
import morgan from "morgan"
import path from "path"
import Rutas from "./router"


const app = express()
const port = 9995

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

app.use(morgan("common", { stream: accessLogStream }))
app.use(Rutas)

app.listen(port, () => {
    console.log(`Servidor iniciado en ${port}`)
})