import { isPostgresConfigured } from '../config/postgres.js'
import { fetchNodeRedDashboard } from './nodeRedDashboardService.js'
import { saveLoadcellInReading } from './loadcellInHistoryService.js'

const DEFAULT_INTERVAL_MS = 5000
const MIN_INTERVAL_MS = 1000

let timer = null
let running = false

export const startNodeRedIngest = () => {
  const enabled = process.env.NODE_RED_INGEST_ENABLED === 'true'
  if (!enabled) {
    console.log('[Node-RED ingest] Disabled')
    return null
  }

  if (!isPostgresConfigured()) {
    console.warn('[Node-RED ingest] DATABASE_URL not set - ingest disabled.')
    return null
  }

  if (timer) return timer

  const intervalMs = Math.max(
    MIN_INTERVAL_MS,
    Number(process.env.NODE_RED_INGEST_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  )

  const ingestOnce = async () => {
    if (running) return
    running = true
    try {
      const dashboard = await fetchNodeRedDashboard()
      const result = await saveLoadcellInReading(dashboard.loadcell?.in, dashboard.updatedAt)
      if (result.saved) {
        console.log(`[Node-RED ingest] Loadcell IN saved id=${result.row.id}`)
      }
    } catch (err) {
      console.warn(`[Node-RED ingest] ${err.message}`)
    } finally {
      running = false
    }
  }

  ingestOnce()
  timer = setInterval(ingestOnce, intervalMs)
  console.log(`[Node-RED ingest] Enabled every ${intervalMs} ms`)
  return timer
}

