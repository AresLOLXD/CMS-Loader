import 'dotenv/config'
import express from "express"
import session from "express-session"
import morgan from "morgan"
import { join } from "path"
import { createStream } from "rotating-file-stream"
import Rutas from "./router"
import { promisify } from "util"
import { jobStore } from "./jobs/JobStore"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import { doubleCsrfProtection } from "./csrf"

declare module "express-session" {
    interface SessionData {
        authenticated?: boolean,
        activeJobId?: string,
        saveAsync?: () => Promise<void>
    }
}

function validateEnv(): void {
  const required = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASSWORD']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}
validateEnv()
jobStore.startTtlCleanup()

const app = express()
const port = Number(process.env.PORT) || 9995
const isProd = process.env.NODE_ENV === "production"

// Mover trust proxy antes de session y adaptarlo a entorno
app.set('trust proxy', isProd ? 1 : 'loopback')

app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'"],
			imgSrc: ["'self'", "data:"],
		}
	}
}))

// Middlewares de parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logger: enviar a carpeta de logs para mantener limpio el repo
const accessLogStream = createStream("access.log", {
	interval: "1d",
	compress: "gzip",
	maxFiles: 20,
	path: join(__dirname, "logs"),
})

// Logger en archivo y consola con formato detallado (combined + dev)
app.use(morgan("combined", { stream: accessLogStream }));
if (!isProd) {
    app.use(morgan("dev"));
}

// Session optimizada: secure/sameSite condicional según entorno
app.use(session({
	secret: process.env.SESSION_SECRET!,
	cookie: {
		secure: isProd,
		maxAge: 1000 * 60 * 5,
		sameSite: isProd ? "none" : "lax",
	},
	// Mejor rendimiento: evitar resave innecesario y no guardar sesiones vacías
	resave: false,
	saveUninitialized: false,
	name: "CMS_Loader",
	proxy: !!isProd,
}))

// Promisificar save de sesión solo si existe
app.use((req, _res, next) => {
	if (req.session) {
		req.session.saveAsync = promisify(req.session.save.bind(req.session))
	}
	next()
})

app.use(cookieParser(process.env.SESSION_SECRET!))
app.use(doubleCsrfProtection)

app.use("/public", express.static(join(__dirname, "public")))
app.use("/", express.static(join(__dirname, "public", "html")))
app.use(Rutas)

app.set('view engine', 'ejs');
app.set("views", join(__dirname, "views"))


// Arranque con manejo de errores
app.listen(port, () => {
	console.log(`Servidor iniciado en ${port}`)
}).on('error', (err) => {
	console.error('Error al iniciar servidor:', err)
})
