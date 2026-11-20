import SystemUser from '../models/SystemUser.js'
import { connectDB } from './mongodb.js'
import { hashPassword } from './passwords.js'

export function publicUser(doc) {
  if (!doc) return null
  const u = { ...doc }
  delete u.passwordHash
  return u
}

export async function ensureBootstrapAdmin() {
  await connectDB()
  const count = await SystemUser.countDocuments()
  if (count > 0) return null

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return null

  const admin = await SystemUser.create({
    name: process.env.ADMIN_NAME || 'Administrator',
    email: email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    role: 'admin',
    active: true,
  })
  return admin.toObject()
}