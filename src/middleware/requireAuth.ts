import { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.authenticated === true) {
    next()
    return
  }
  res.redirect('/login')
}
