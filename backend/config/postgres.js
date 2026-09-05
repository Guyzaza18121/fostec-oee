import pg from 'pg'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const useSsl = process.env.POSTGRES_SSL === 'true'

let pool = null
let status = connectionString ? 'disconnected' : 'unconfigured'

export const isPostgresConfigured = () => Boolean(connectionString)

export const getPostgresStatus = () => status

export const getPostgresPool = () => {
  if (!connectionString) return null
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    })
  }
  return pool
}

export const connectPostgres = async () => {
  const pgPool = getPostgresPool()
  if (!pgPool) {
    console.warn('[PostgreSQL] DATABASE_URL not set - telemetry history disabled.')
    return null
  }

  try {
    await pgPool.query('SELECT 1')
    status = 'connected'
    console.log('[PostgreSQL] Connected')
    return pgPool
  } catch (err) {
    status = 'disconnected'
    console.error(`[PostgreSQL] Connection Error: ${err.message}`)
    return null
  }
}

export const queryPostgres = async (text, params = []) => {
  const pgPool = getPostgresPool()
  if (!pgPool) {
    const err = new Error('PostgreSQL is not configured')
    err.status = 503
    throw err
  }

  return pgPool.query(text, params)
}

