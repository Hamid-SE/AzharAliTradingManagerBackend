import { SignJWT, jwtVerify } from 'jose'
import SystemUser from '../models/SystemUser.js'
import { connectDB } from './mongodb.js'
import { hashPassword, verifyPassword } from './passwords.js'

const COOKIE = 'aat_session'

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

export async function createSession(user) {
  const payload = {
    email: user.email,
    role: user.role || 'user',
    name: user.name,
  }
  if (user.id) payload.sub = String(user.id)

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySession(token) {
  if (!token) return null
  const secret = getSecret()
  if (!secret) {
    console.error('[auth] Missing AUTH_SECRET in backend/.env')
    return null
  }
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}

export { COOKIE }

export async function validateAdminCredentials(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) return false
  if (email.toLowerCase() !== adminEmail.toLowerCase()) return false
  return password === adminPassword
}

/** Resolve login from MongoDB users, with env admin fallback when no DB user matches. */
export async function authenticateLogin(email, password) {
  const trimmed = (email || '').trim()
  const normalized = trimmed.toLowerCase()
  if (!normalized || !password) return null

  await connectDB()
  const dbUser = await SystemUser.findOne({ email: normalized }).select('+passwordHash').lean()
  if (dbUser) {
    if (!dbUser.active) return null
    if (verifyPassword(password, dbUser.passwordHash)) {
      return {
        id: dbUser._id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      }
    }
    // Env admin password still works if .env was updated after DB user was created
    if (validateAdminCredentials(trimmed, password)) {
      await SystemUser.findByIdAndUpdate(dbUser._id, { passwordHash: hashPassword(password) })
      return {
        id: dbUser._id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      }
    }
    return null
  }

  if (validateAdminCredentials(trimmed, password)) {
    return {
      name: process.env.ADMIN_NAME || 'Administrator',
      email: normalized,
      role: 'admin',
    }
  }

  return null
}
