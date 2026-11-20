import './loadEnv.js'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import apiRouter from './routes/api.js'

const app = express()
const PORT = Number(process.env.BACKEND_PORT) || 4000

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/api', apiRouter)

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})