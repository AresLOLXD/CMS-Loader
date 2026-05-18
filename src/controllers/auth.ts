import { createHash, timingSafeEqual } from 'crypto'
import { Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiados intentos, espera 15 minutos" }
})

function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

router.post('/', loginLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }
  const validUser = safeCompare(username ?? '', process.env.ADMIN_USER!)
  const validPass = safeCompare(password ?? '', process.env.ADMIN_PASSWORD!)

  if (validUser && validPass) {
    req.session.authenticated = true
    req.session.save(() => res.json({ success: true }))
    return
  }

  res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' })
})

router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/'))
})

export default router
