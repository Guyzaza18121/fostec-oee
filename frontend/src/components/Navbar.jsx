import { useState, useEffect } from 'react'
import { useLocation } from '../router.jsx'
import PropTypes from 'prop-types'
import { Menu, Moon, Sun, Gauge } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { api } from '../services/api.js'

const PAGE_NAMES = {
  '/': 'Overview',
  '/equipment': 'Process',
  '/oee-metrics': 'OEE Metrics',
  '/availability': 'Availability',
  '/performance': 'Performance',
  '/quality': 'Quality',
  '/analytics': 'Analytics',
  '/alerts': 'Alerts',
  '/data/history': 'History',
  '/data/range': 'Range',
  '/data/export': 'Export',
  '/settings': 'Settings',
  '/user-settings': 'User Settings',
  '/user-management': 'User Management',
}

const PRODUCTION_ENTRIES_SYNC_KEY = 'productionEntriesUpdatedAt'
const PRODUCTION_ENTRIES_CHANGED_EVENT = 'production-entries:changed'
const SHIFTS_SYNC_KEY = 'shiftsUpdatedAt'
const SHIFTS_CHANGED_EVENT = 'shifts:changed'

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function getScheduleRange(dayValue, startMinutesValue, endMinutesValue) {
  const day = startOfDay(dayValue)
  if (Number.isNaN(day.getTime())) return null

  const startMinutes = Number(startMinutesValue) || 0
  const rawEndMinutes = Number(endMinutesValue)
  const endMinutes = Number.isFinite(rawEndMinutes) && rawEndMinutes > startMinutes
    ? rawEndMinutes
    : Math.min(startMinutes + 60, 24 * 60)
  const startAt = new Date(day)
  const endAt = new Date(day)
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  return { day, startAt, endAt, startMinutes, endMinutes }
}

function parseShiftMinutes(time = '') {
  const match = String(time).match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/)
  if (!match) return null
  const [, sh, sm, eh, em] = match
  const startMinutes = Number(sh) * 60 + Number(sm)
  let endMinutes = Number(eh) * 60 + Number(em)
  if (endMinutes <= startMinutes) endMinutes = 24 * 60
  return { startMinutes, endMinutes }
}

function buildProductionStatus(shifts = [], entries = []) {
  const now = new Date()
  const normalizedEntries = entries
    .map((entry) => {
      const product = entry.product || entry.name || ''
      const range = getScheduleRange(entry.date || entry.day || Date.now(), entry.startMinutes, entry.endMinutes)
      if (!product || !range) return null
      return { ...entry, ...range, product }
    })
    .filter(Boolean)
    .sort((a, b) => a.startAt - b.startAt)

  const currentEntry = normalizedEntries.find((entry) => now >= entry.startAt && now < entry.endAt)
  if (currentEntry) {
    return {
      label: 'กำลังผลิต',
      product: currentEntry.product,
      color: '#22c55e',
    }
  }

  const upcomingEntry = normalizedEntries.find((entry) => now < entry.startAt)
  if (upcomingEntry) {
    return {
      label: 'ถัดไป',
      product: upcomingEntry.product,
      color: '#3b82f6',
    }
  }

  const normalizedShifts = [...shifts]
    .map((shift) => {
      const product = shift.product || ''
      const minutes = parseShiftMinutes(shift.time)
      if (!product || !shift.productionDate || !minutes) return null
      const range = getScheduleRange(shift.productionDate, minutes.startMinutes, minutes.endMinutes)
      if (!range) return null
      return { ...shift, ...range, product }
    })
    .filter(Boolean)
    .sort((a, b) => a.startAt - b.startAt)

  const currentShift = normalizedShifts.find((shift) => now >= shift.startAt && now < shift.endAt)
  if (currentShift) {
    return {
      label: currentShift.status === 'running' ? 'กำลังผลิต' : 'ถัดไป',
      product: currentShift.product,
      color: currentShift.status === 'running' ? '#22c55e' : '#3b82f6',
    }
  }

  const upcomingShift = normalizedShifts.find((shift) => now < shift.startAt)
  if (upcomingShift) {
    return {
      label: 'ถัดไป',
      product: upcomingShift.product,
      color: '#3b82f6',
    }
  }

  return {
    label: 'ถัดไป',
    product: 'ยังไม่มีสินค้า',
    color: '#64748b',
  }
}

export default function Navbar({ onMenuToggle, collapsed = false, user = null, onLogout }) {
  const [now, setNow] = useState(new Date())
  const [stats, setStats] = useState({ run: 0, idle: 0, down: 0, oee: 0, avail: 0, perf: 0, qual: 0 })
  const [productionStatus, setProductionStatus] = useState({ label: 'ถัดไป', product: 'กำลังโหลด...', color: '#64748b' })
  const location = useLocation()
  const pageName = PAGE_NAMES[location.pathname] || 'OEE'
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const [summaryRes, machinesRes] = await Promise.all([api.getSummary(), api.getMachines()])
        if (cancelled) return
        const s = summaryRes.data || {}
        const machines = machinesRes.data || []
        const run = machines.filter(m => m.status === 'running').length
        const down = machines.filter(m => m.status === 'breakdown' || m.status === 'stopped').length
        const idle = machines.filter(m => m.status === 'warning' || m.status === 'idle').length
        setStats({
          run, idle, down,
          oee: s.oee || 0,
          avail: s.availability || 0,
          perf: s.performance || 0,
          qual: s.quality || 0,
        })
      } catch (err) {
        // silently fail — navbar stats are non-critical
      }
    }
    fetchStats()
    const timer = setInterval(fetchStats, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchProductionStatus = async () => {
      try {
        const [shiftsRes, entriesRes] = await Promise.all([
          api.getShifts(),
          api.getProductionEntries({ limit: 1000 }),
        ])
        if (cancelled) return
        setProductionStatus(buildProductionStatus(shiftsRes.data || [], entriesRes.data || []))
      } catch (err) {
        if (!cancelled) {
          setProductionStatus({ label: 'ถัดไป', product: 'ยังไม่มีสินค้า', color: '#64748b' })
        }
      }
    }

    fetchProductionStatus()
    const timer = setInterval(fetchProductionStatus, 5000)
    const handleProductionEntriesChanged = () => fetchProductionStatus()
    const handleShiftsChanged = () => fetchProductionStatus()
    const handleStorage = (event) => {
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY || event.key === SHIFTS_SYNC_KEY) fetchProductionStatus()
    }
    window.addEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
    window.addEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
    window.addEventListener('storage', handleStorage)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
      window.removeEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg-card/85 px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-md">
      <div className="flex min-h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-panel/70 text-slate-300 transition hover:border-blue-400/50 hover:text-blue-300 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <img src="/Logo-FOSTEC4.png" alt="FOSTEC" className={`h-11 w-auto object-contain ${collapsed ? 'hidden lg:block' : 'hidden'}`} />
          <div className={`h-8 w-px bg-gradient-to-b from-transparent via-border-2 to-transparent ${collapsed ? 'hidden lg:block' : 'hidden'}`} />
          <div className="hidden min-w-[210px] leading-tight 2xl:block">
            <div className="truncate text-sm font-extrabold tracking-wide text-slate-100">{pageName} <span className="text-gradient">Monitor</span></div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-500">INTELLIGENT MANAGEMENT 4.0</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-[10px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.18)] sm:flex">
            <span className="flex items-center gap-1.5 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-soft-pulse" />{stats.run} Run</span>
            <span className="flex items-center gap-1.5 text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{stats.idle} Idle</span>
            <span className="flex items-center gap-1.5 text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />{stats.down} Down</span>
          </div>

          <div className="hidden items-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/8 px-3 py-2 text-[10px] font-semibold shadow-sm sm:flex">
            <Gauge size={13} className="text-blue-300" strokeWidth={2.2} />
            <span className="text-slate-300">OEE</span>
            <span className="font-mono text-sm font-bold text-gradient">{stats.oee.toFixed(1)}%</span>
          </div>

          <div
            className="hidden min-w-0 max-w-[240px] items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold text-slate-200 transition-opacity hover:opacity-85 lg:flex"
            title={`${productionStatus.label}: ${productionStatus.product}`}
            style={{ borderColor: `${productionStatus.color}80`, backgroundColor: `${productionStatus.color}18` }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: productionStatus.color, boxShadow: `0 0 8px ${productionStatus.color}80` }}
            />
            <span className="truncate">{productionStatus.label}: {productionStatus.product}</span>
          </div>

          <div className="hidden shrink-0 text-center sm:block">
            <div className="font-mono text-[19px] font-extrabold leading-none text-slate-100">{now.toLocaleTimeString('en-US', { hour12: false })}</div>
            <div className="mt-1 text-[8px] font-medium leading-none text-slate-500">{now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-panel/55 text-slate-400 transition hover:text-blue-300"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative">
            <button onClick={onLogout} className="flex items-center gap-2 rounded-lg border border-border bg-bg-panel/55 px-2 py-1.5 transition hover:bg-bg-panel">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border text-xs font-bold" style={{ background: user?.avatar ? 'transparent' : '#5d5fef30', color: user?.avatar ? 'transparent' : '#8ea0ff' }}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || 'A'
                )}
              </div>
              <div className="hidden leading-tight sm:block">
                <div className="text-[11px] font-semibold text-slate-100">{user?.name || 'Guest'}</div>
                <div className="text-[8px] uppercase" style={{ color: '#8ea0ff' }}>{user?.role || 'VIEWER'}</div>
              </div>
              <svg className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

Navbar.propTypes = {
  onMenuToggle: PropTypes.func.isRequired,
  collapsed: PropTypes.bool,
  user: PropTypes.object,
  onLogout: PropTypes.func.isRequired,
}
