import { COOKIE, verifySession } from './auth.js'

function readSessionToken(req) {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE]
  const raw = req.headers.cookie || ''
  const match = raw.match(new RegExp(`${COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export async function requireApiUser(req, res, next) {
  const token = readSessionToken(req)
  const session = await verifySession(token)
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.user = session
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}