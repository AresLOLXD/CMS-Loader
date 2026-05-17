import { createHash, timingSafeEqual } from 'crypto'
import { Request, Response, Router } from 'express'
import { generateToken } from '../csrf'

const router = Router()

function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

router.get('/', (req: Request, res: Response) => {
  if (req.session.authenticated === true) {
    res.redirect('/')
    return
  }
  const csrfToken = generateToken(req, res)
  res.render('login.ejs', { csrfToken, error: null })
})

router.post('/', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }
  const validUser = safeCompare(username ?? '', process.env.ADMIN_USER!)
  const validPass = safeCompare(password ?? '', process.env.ADMIN_PASSWORD!)

  if (validUser && validPass) {
    req.session.authenticated = true
    req.session.save(() => res.redirect('/'))
    return
  }

  const csrfToken = generateToken(req, res)
  res.status(401).render('login.ejs', { csrfToken, error: 'Usuario o contraseña incorrectos' })
})

router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/login'))
})

export default router
