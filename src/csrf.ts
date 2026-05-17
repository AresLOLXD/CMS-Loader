import { doubleCsrf } from 'csrf-csrf'
import type { Request } from 'express'

const isProd = process.env.NODE_ENV === 'production'

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET!,
  getSessionIdentifier: (req: Request) => req.sessionID,
  cookieName: isProd ? '__Host-csrf' : 'csrf',
  cookieOptions: {
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    httpOnly: true,
    path: '/'
  },
  getCsrfTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string | undefined) ??
    (req.body?._csrf as string | undefined)
})

// Re-export with the name consumers (auth.ts, views.ts) expect
export const generateToken = generateCsrfToken
export { doubleCsrfProtection }
