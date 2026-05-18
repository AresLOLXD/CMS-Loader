import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated === true) {
    next()
    return
  }
  if (req.accepts('json')) {
    res.status(401).json({ success: false, message: 'No autenticado' })
    return
  }
  res.redirect('/login')
}
