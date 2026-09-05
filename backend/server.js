import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import connectDB from './config/db.js'
import { connectPostgres, getPostgresStatus } from './config/postgres.js'
import oeeRoutes from './routes/oee.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import { startMocking } from './services/mockDataService.js'
import { startNodeRedIngest } from './services/nodeRedIngestService.js'

const app = express()
const PORT = process.env.PORT || 3001
const ENABLE_MOCK_DATA = process.env.ENABLE_MOCK_DATA === 'true'

connectDB()
connectPostgres().then((pool) => {
  if (pool) startNodeRedIngest()
})
if (ENABLE_MOCK_DATA) {
  startMocking(3000)
} else {
  console.log('[MockData] Live generator disabled')
}

app.use(cors())
app.use(express.json())

app.use('/api/oee', oeeRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    postgres: getPostgresStatus(),
  })
})

// ── 404 handler for unknown API routes ───────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
})

// ── Global error handler (returns JSON instead of HTML) ──────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500)
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
