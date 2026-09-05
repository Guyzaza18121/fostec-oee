import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

const DEFAULT_POLL_INTERVAL_MS = 5000
const MIN_POLL_INTERVAL_MS = 250

export default function useNodeRedDashboard(pollInterval = 5000) {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    const intervalMs = Math.max(MIN_POLL_INTERVAL_MS, Number(pollInterval) || DEFAULT_POLL_INTERVAL_MS)

    async function fetchDashboard() {
      if (inFlight) return
      inFlight = true
      try {
        const res = await api.getNodeRedDashboard()
        if (cancelled) return
        setDashboard(res.data || res || null)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
        inFlight = false
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchDashboard()
    }

    fetchDashboard()
    const timer = setInterval(fetchDashboard, intervalMs)
    window.addEventListener('focus', fetchDashboard)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', fetchDashboard)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pollInterval])

  return { dashboard, loading, error }
}
