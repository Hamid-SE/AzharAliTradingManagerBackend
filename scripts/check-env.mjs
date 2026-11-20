import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(backendRoot, '.env')

if (!fs.existsSync(envPath)) {
  console.error('\n[backend] Missing backend/.env')
  console.error('Copy backend/.env.example → backend/.env and set MONGODB_URI + AUTH_SECRET.\n')
  process.exit(1)
}