import express, { Router } from "express"
import Rutas from "./router"
import morgan from "morgan"
import path from "path"
import fs from "fs"


const app = express()
const port = 9995

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

app.use(morgan("common", { stream: accessLogStream }))
app.use(Rutas)

app.listen(port, () => {

})