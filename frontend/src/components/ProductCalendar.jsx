import { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ChevronLeft, ChevronRight, Clock, ChevronDown, MoreHorizontal, Plus, X } from 'lucide-react'
import PropTypes from 'prop-types'
import ProductionEntryModal from './ProductionEntryModal.jsx'
import { api } from '../services/api.js'

const HOUR_START = 0
const HOUR_END = 24
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const SLOT_HEIGHT = 34 // px per hour; gives schedule cards enough room to stay readable.
const PRODUCTION_ENTRIES_SYNC_KEY = 'productionEntriesUpdatedAt'
const PRODUCTION_ENTRIES_CHANGED_EVENT = 'production-entries:changed'
const calendarDayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const thaiDaysFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day // Sunday based
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getEntryDateRange(entry) {
  const day = new Date(entry.day)
  if (Number.isNaN(day.getTime())) return null

  const startMinutes = Number(entry.startMinutes) || 0
  const rawEndMinutes = Number(entry.endMinutes)
  const endMinutes = Number.isFinite(rawEndMinutes) && rawEndMinutes > startMinutes
    ? rawEndMinutes
    : Math.min(startMinutes + 60, 24 * 60)
  const startAt = new Date(day)
  const endAt = new Date(day)
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)

  return { startAt, endAt }
}

function getEntryRuntimeStatus(entry, now = new Date()) {
  const range = getEntryDateRange(entry)
  if (!range) return 'waiting'
  if (now >= range.endAt) return 'done'
  if (now >= range.startAt) return 'running'
  return 'waiting'
}

const ENTRY_STATUS_STYLES = {
  active: {
    scheduledTitleClassName: 'text-blue-300/75 group-hover:text-blue-200',
    scheduledTimeClassName: 'text-sky-300',
    cardClassName: 'border-sky-300/40 bg-sky-500/15 shadow-[0_8px_18px_rgba(2,132,199,0.14)] hover:border-sky-300/70 hover:bg-sky-500/20 hover:shadow-[0_10px_26px_rgba(14,165,233,0.22)]',
    cardTitleClassName: 'text-sky-50',
    accentClassName: 'bg-sky-300/90 shadow-[0_0_10px_rgba(56,189,248,0.5)]',
    monthBackground: 'rgba(34,211,238,0.12)',
    monthDot: '#22d3ee',
  },
  done: {
    scheduledTitleClassName: 'text-emerald-300/85 group-hover:text-emerald-200',
    scheduledTimeClassName: 'text-emerald-300',
    cardClassName: 'border-emerald-300/45 bg-emerald-500/15 shadow-[0_8px_18px_rgba(16,185,129,0.14)] hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:shadow-[0_10px_26px_rgba(16,185,129,0.22)]',
    cardTitleClassName: 'text-emerald-50',
    accentClassName: 'bg-emerald-300/90 shadow-[0_0_10px_rgba(52,211,153,0.5)]',
    monthBackground: 'rgba(16,185,129,0.12)',
    monthDot: '#34d399',
  },
}

function getEntryStatusStyle(entry, now = new Date()) {
  return getEntryRuntimeStatus(entry, now) === 'done'
    ? ENTRY_STATUS_STYLES.done
    : ENTRY_STATUS_STYLES.active
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const start = startOfWeek(firstDay)
  const days = []
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i))
  }
  return days
}

function getYearMonths(year) {
  return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
}

const VIEW_OPTIONS = [
  { value: 'day', label: 'วัน' },
  { value: 'week', label: 'สัปดาห์' },
  { value: 'month', label: 'เดือน' },
  { value: 'year', label: 'ปี' },
]

function formatHourLabel(hour) {
  const h = hour % 12 || 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h} ${suffix}`
}

function mapBackendEntryToFrontend(entry) {
  const startMinutes = entry.startMinutes ?? 0
  const endMinutes = entry.endMinutes ?? Math.max(startMinutes + 60, 1)
  const top = ((startMinutes - HOUR_START * 60) / 60) * SLOT_HEIGHT
  const height = ((endMinutes - startMinutes) / 60) * SLOT_HEIGHT
  const [cleaningHours = '00', cleaningMinutes = '00'] = String(entry.cleaningTime || '00:00').split(':')
  return {
    id: entry._id || `entry-${Date.now()}-${Math.random()}`,
    backendId: entry._id || null,
    shiftId: entry.shiftId || null,
    shift: entry.shift || '',
    day: new Date(entry.date),
    name: entry.product || 'ไม่ระบุสินค้า',
    product: entry.product || '',
    time: entry.timeRange || `${formatHourLabel(Math.floor(startMinutes / 60))} - ${formatHourLabel(Math.floor(endMinutes / 60))}`,
    startMinutes,
    endMinutes,
    line: entry.line || '',
    operator: entry.operator || '',
    notes: entry.notes || '',
    actualBags: entry.actualBags || 0,
    bagSize: entry.bagSize || 0,
    top,
    height,
    status: 'running',
    color: '#22d3ee',
    data: {
      inputWeight: entry.received || '',
      outputWeight: entry.siloOutput || '',
      standardWeight: entry.target || '',
      cleaningHours,
      cleaningMinutes,
    },
  }
}

function buildFrontendEntry(form, selectedDay) {
  const startHour = Number(form.startHour)
  const endHour = Number(form.endHour)
  const startMinutes = startHour * 60
  const endMinutes = Math.max(endHour, startHour + 1) * 60
  return {
    name: form.product || 'ไม่ระบุสินค้า',
    product: form.product,
    time: `${formatHourLabel(startHour)} - ${formatHourLabel(Math.floor(endMinutes / 60))}`,
    startMinutes,
    endMinutes,
    top: ((startMinutes - HOUR_START * 60) / 60) * SLOT_HEIGHT,
    height: ((endMinutes - startMinutes) / 60) * SLOT_HEIGHT,
    status: 'running',
    color: '#22d3ee',
    data: { ...form },
    day: selectedDay,
  }
}

function getEntryGridPosition(entry) {
  const startMinutes = Number(entry.startMinutes) || 0
  const rawEndMinutes = Number(entry.endMinutes)
  const endMinutes = Number.isFinite(rawEndMinutes) && rawEndMinutes > startMinutes
    ? rawEndMinutes
    : Math.min(startMinutes + 60, HOUR_END * 60)

  return {
    top: ((startMinutes - HOUR_START * 60) / 60) * SLOT_HEIGHT,
    height: ((endMinutes - startMinutes) / 60) * SLOT_HEIGHT,
  }
}

function mapFrontendEntryToBackend(entry) {
  return {
    shiftId: entry.shiftId || null,
    date: entry.day instanceof Date ? entry.day.toISOString() : entry.day,
    product: entry.product || entry.name,
    timeRange: entry.time,
    received: Number(entry.data?.inputWeight) || 0,
    siloOutput: Number(entry.data?.outputWeight) || 0,
    target: Number(entry.data?.standardWeight) || 0,
    cleaningTime: `${entry.data?.cleaningHours || '00'}:${entry.data?.cleaningMinutes || '00'}`,
    startMinutes: entry.startMinutes,
    endMinutes: entry.endMinutes,
    shift: entry.shift || '',
    line: entry.line || '',
    actualBags: entry.actualBags || 0,
    bagSize: entry.bagSize || 0,
    operator: entry.operator || '',
    notes: entry.notes || '',
  }
}

function notifyProductionEntriesChanged() {
  try {
    localStorage.setItem(PRODUCTION_ENTRIES_SYNC_KEY, String(Date.now()))
  } catch {}
  window.dispatchEvent(new CustomEvent(PRODUCTION_ENTRIES_CHANGED_EVENT))
}

function ProductCalendar({ shifts = [] }, ref) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('week')
  const [selectedDay, setSelectedDay] = useState(null)
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [hoveredEntry, setHoveredEntry] = useState(null)
  const [entries, setEntries] = useState([])
  const [stockData, setStockData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [clockNow, setClockNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadEntries = () => {
      setLoading(true)
      api.getProductionEntries({ limit: 1000 })
        .then((res) => {
          if (cancelled) return
          const data = (res.data || []).map(mapBackendEntryToFrontend)
          setEntries(data)
          setLoadError(null)
        })
        .catch((err) => {
          if (cancelled) return
          console.error('Failed to load production entries:', err)
          setLoadError('โหลดข้อมูลจาก server ไม่สำเร็จ')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    loadEntries()
    api.getMaterialStock().then((res) => { if (!cancelled) setStockData(res.data || []) }).catch(() => {})
    const handleChanged = () => {
      loadEntries()
      api.getMaterialStock().then((res) => { if (!cancelled) setStockData(res.data || []) }).catch(() => {})
    }
    const handleStorage = (event) => {
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY) loadEntries()
    }
    window.addEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    addEntry: (entry) => {
      const payload = mapFrontendEntryToBackend(entry)
      return api.createProductionEntry(payload)
        .then((res) => {
          const created = mapBackendEntryToFrontend(res.data)
          setEntries((prev) => [...prev, created])
          notifyProductionEntriesChanged()
          return created
        })
        .catch((err) => {
          console.error('Failed to create production entry:', err)
          throw err
        })
    },
  }))
  const today = useMemo(() => {
    const value = new Date(clockNow)
    value.setHours(0, 0, 0, 0)
    return value
  }, [clockNow])

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate])
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekEnd = weekDays[6]

  const currentTimeMinutes = useMemo(() => clockNow.getHours() * 60 + clockNow.getMinutes(), [clockNow])

  const isTodayInWeek = weekDays.some((d) => isSameDay(d, today))

  const products = useMemo(() => {
    const list = shifts
      .map((s) => s.product)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)
    return list
  }, [shifts])

  const miniCalendarDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate])
  const monthDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate])
  const yearMonths = useMemo(() => getYearMonths(currentDate.getFullYear()), [currentDate])

  const goToPrev = () => {
    if (viewMode === 'day') {
      const day = selectedDay || today
      const prev = addDays(day, -1)
      setCurrentDate(prev)
      setSelectedDay(prev)
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(weekStart, -7))
    } else if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === 'year') {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1))
    }
  }

  const goToNext = () => {
    if (viewMode === 'day') {
      const day = selectedDay || today
      const next = addDays(day, 1)
      setCurrentDate(next)
      setSelectedDay(next)
    } else if (viewMode === 'week') {
      setCurrentDate(addDays(weekStart, 7))
    } else if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === 'year') {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDay(null)
    setViewMode('week')
  }

  const openDayView = (day) => {
    setSelectedDay(day)
    setCurrentDate(day)
    setViewMode('day')
  }

  const openEntryModal = (day, hour) => {
    setSelectedSlot({ day, hour })
    setEditingEntry(null)
    setEntryModalOpen(true)
  }

  const openCurrentEntryModal = () => {
    const now = new Date()
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    openEntryModal(day, Math.min(now.getHours(), 22))
  }

  const openEditEntryModal = (entry) => {
    setSelectedSlot(null)
    setEditingEntry(entry)
    setEntryModalOpen(true)
  }

  const deleteEntry = async (entry) => {
    try {
      if (entry.backendId) {
        await api.deleteProductionEntry(entry.backendId)
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      notifyProductionEntriesChanged()
      closeEntryModal()
    } catch (err) {
      console.error('Failed to delete production entry:', err)
      alert('ลบไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    }
  }

  const closeEntryModal = () => {
    setEntryModalOpen(false)
    setSelectedSlot(null)
    setEditingEntry(null)
  }

  const renderDeleteEntryButton = (entry) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        deleteEntry(entry)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute right-1.5 top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-rose-300/30 bg-bg-card/90 text-rose-300 opacity-0 shadow-lg shadow-black/25 backdrop-blur transition duration-150 hover:border-rose-300/60 hover:bg-rose-500/25 hover:text-rose-100 group-hover:opacity-100 focus:opacity-100"
      title="ลบ"
      aria-label="ลบรายการนี้"
    >
      <X className="h-3 w-3" strokeWidth={2.6} />
    </button>
  )

  const renderEntryPopup = (entry, day) => {
    const dayLabel = `${thaiDaysFull[day.getDay()]} ${day.getDate()} ${thaiMonths[day.getMonth()]} ${day.getFullYear() + 543}`
    return (
      <div className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-lg border border-border bg-bg-card p-2.5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold text-sky-300">{entry.name}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">{dayLabel}</div>
            <div className="text-[10px] text-slate-300">{entry.time}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteEntry(entry) }}
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
            title="ลบ"
          >
            ลบ
          </button>
        </div>
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">รับเข้า</span>
            <span className="text-slate-200">{entry.data?.inputWeight || 0}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">มาตรฐาน</span>
            <span className="text-slate-200">{entry.data?.standardWeight || 0}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Cleaning</span>
            <span className="text-slate-200">{entry.data?.cleaningHours || '00'}:{entry.data?.cleaningMinutes || '00'}</span>
          </div>
        </div>
      </div>
    )
  }

  const saveEntry = async (form) => {
    const entryDay = form.day
      ? new Date(form.day)
      : selectedSlot?.day || editingEntry?.day || new Date()
    const baseEntry = {
      ...buildFrontendEntry(form, entryDay),
      shiftId: editingEntry?.shiftId || null,
      shift: editingEntry?.shift || '',
      line: editingEntry?.line || '',
      operator: editingEntry?.operator || '',
      notes: editingEntry?.notes || '',
      actualBags: editingEntry?.actualBags || 0,
      bagSize: editingEntry?.bagSize || 0,
    }
    try {
      if (editingEntry?.backendId) {
        const payload = mapFrontendEntryToBackend({ ...baseEntry, backendId: editingEntry.backendId })
        const res = await api.updateProductionEntry(editingEntry.backendId, payload)
        const updated = mapBackendEntryToFrontend(res.data)
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? updated : e)))
        notifyProductionEntriesChanged()
      } else if (selectedSlot) {
        const payload = mapFrontendEntryToBackend(baseEntry)
        const res = await api.createProductionEntry(payload)
        const created = mapBackendEntryToFrontend(res.data)
        setEntries((prev) => [...prev, created])
        notifyProductionEntriesChanged()
      }
    } catch (err) {
      console.error('Failed to save production entry:', err)
      setLoadError('บันทึกข้อมูลไม่สำเร็จ')
    } finally {
      closeEntryModal()
    }
  }

  const handleGridClick = (day) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const hour = Math.floor(y / SLOT_HEIGHT)
    if (hour >= 0 && hour < HOURS.length) {
      openEntryModal(day, hour)
    }
  }

  const switchView = (mode) => {
    setViewMode(mode)
    setViewDropdownOpen(false)
    if (mode !== 'day') {
      setSelectedDay(null)
    } else if (!selectedDay) {
      setSelectedDay(today)
      setCurrentDate(today)
    }
  }

  const monthLabel = `${thaiMonths[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`
  const weekRangeLabel = `${weekStart.getDate()} - ${weekEnd.getDate()} ${thaiMonths[weekStart.getMonth()]} ${weekStart.getFullYear() + 543}`
  const yearLabel = `${currentDate.getFullYear() + 543}`
  const dayLabel = selectedDay ? `${thaiDaysFull[selectedDay.getDay()]} ${selectedDay.getDate()} ${thaiMonths[selectedDay.getMonth()]} ${selectedDay.getFullYear() + 543}` : ''
  const currentViewLabel = VIEW_OPTIONS.find((v) => v.value === viewMode)?.label || 'สัปดาห์'

  const scheduledEntries = useMemo(() => {
    return entries
      .filter((entry) => entry.day.getMonth() === currentDate.getMonth() && entry.day.getFullYear() === currentDate.getFullYear())
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes)
      .slice(0, 8)
  }, [entries, currentDate])

  const entriesInPeriod = useMemo(() => {
    if (viewMode === 'day' && selectedDay) return entries.filter((e) => isSameDay(e.day, selectedDay))
    if (viewMode === 'week') return entries.filter((e) => weekDays.some((wd) => isSameDay(wd, e.day)))
    if (viewMode === 'month') return entries.filter((e) => e.day.getMonth() === currentDate.getMonth() && e.day.getFullYear() === currentDate.getFullYear())
    if (viewMode === 'year') return entries.filter((e) => e.day.getFullYear() === currentDate.getFullYear())
    return entries
  }, [entries, viewMode, selectedDay, weekDays, currentDate])

  const entrySummary = useMemo(() => {
    return entriesInPeriod.reduce((summary, entry) => {
      const status = getEntryRuntimeStatus(entry, clockNow)
      return {
        ...summary,
        [status]: summary[status] + 1,
      }
    }, { waiting: 0, running: 0, done: 0 })
  }, [entriesInPeriod, clockNow])

  const summaryTitle = viewMode === 'day' && selectedDay
    ? 'สรุปกะในวันที่เลือก'
    : viewMode === 'month'
      ? 'สรุปกะในเดือน'
      : viewMode === 'year'
        ? 'สรุปกะในปี'
        : 'สรุปกะในสัปดาห์'

  const statusDot = (color) => (
    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
  )

  return (
    <section className="w-full rounded-xl border border-border bg-bg-card/90 p-4 panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Mini month calendar */}
        <div className="relative w-full shrink-0 overflow-hidden rounded-lg border border-border/70 bg-[#0d0b22] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:w-[374px]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100">{monthLabel}</h2>
            <div className="flex overflow-hidden rounded-lg bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.22)]">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="flex h-10 w-11 items-center justify-center text-white transition hover:bg-blue-500"
                aria-label="Previous month"
              >
                <ChevronLeft size={20} strokeWidth={3} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="flex h-10 w-11 items-center justify-center border-l border-white/20 text-white transition hover:bg-blue-500"
                aria-label="Next month"
              >
                <ChevronRight size={20} strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-7 text-center text-xs font-bold text-slate-400">
            {calendarDayLabels.map((label) => (
              <div key={label} className="pb-3">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-slate-100/80">
            {miniCalendarDays.map((d, idx) => {
              const inMonth = d.getMonth() === currentDate.getMonth()
              const isToday = isSameDay(d, today)
              const isSelectedDay = selectedDay && isSameDay(d, selectedDay)
              const dayEntries = entries.filter((entry) => isSameDay(entry.day, d))
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentDate(d)
                    openDayView(d)
                  }}
                  className={`relative flex h-12 items-center justify-center border-b border-r border-slate-100/80 text-sm transition hover:bg-blue-500/15 ${
                    isSelectedDay
                      ? 'bg-indigo-500/45 text-white'
                      : isToday
                        ? 'text-sky-200'
                        : inMonth
                          ? 'text-slate-100'
                          : 'text-slate-600'
                  }`}
                >
                  <span className="leading-none">{d.getDate()}</span>
                  {dayEntries.length > 0 && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                      {dayEntries.length > 1 && <span className="text-[9px] font-bold text-sky-300">{dayEntries.length}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <h3 className="text-xl font-bold text-slate-100">Scheduled Plan</h3>
            <div className="mt-4 max-h-[250px] space-y-3 overflow-y-auto pr-1">
              {loading && (
                <div className="rounded-lg border border-border bg-bg-panel/35 px-4 py-5 text-sm text-slate-400">
                  Loading schedule...
                </div>
              )}
              {loadError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                  {loadError}
                </div>
              )}
              {!loading && !loadError && scheduledEntries.length === 0 && (
                <div className="rounded-lg border border-border bg-bg-panel/35 px-4 py-5 text-sm text-slate-400">
                  No production schedule this month.
                </div>
              )}
              {scheduledEntries.map((entry) => {
                const entryStyle = getEntryStatusStyle(entry, clockNow)
                return (
                  <button
                    key={`scheduled-${entry.id}`}
                    type="button"
                    onClick={() => openEditEntryModal(entry)}
                    className="group flex w-full items-center gap-4 rounded-lg bg-[#0b0b20]/80 px-3 py-3 text-left transition hover:bg-bg-panel/70"
                  >
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-bg-panel/70 leading-none shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                      <span className="text-[11px] font-black text-orange-400">{calendarDayLabels[entry.day.getDay()].slice(0, 3)}</span>
                      <span className="mt-1 text-base font-bold text-slate-100">{entry.day.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-lg font-semibold ${entryStyle.scheduledTitleClassName}`}>{entry.name}</span>
                      <span className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${entryStyle.scheduledTimeClassName}`}>
                        <Clock size={13} />
                        {entry.time}
                      </span>
                    </span>
                    <MoreHorizontal className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2.4} />
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={openCurrentEntryModal}
              className="mt-4 ml-auto flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500 text-white shadow-[0_12px_28px_rgba(249,115,22,0.34)] transition hover:bg-orange-400"
              aria-label="Add production schedule"
              title="Add production schedule"
            >
              <Plus size={22} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">
              {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="rounded p-1 text-slate-400 hover:bg-bg-panel/60 hover:text-slate-200"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="rounded p-1 text-slate-400 hover:bg-bg-panel/60 hover:text-slate-200"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-400">
            {thaiDays.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center text-[11px]">
            {miniCalendarDays.map((d, idx) => {
              const inMonth = d.getMonth() === currentDate.getMonth()
              const isToday = isSameDay(d, today)
              const isSelectedWeek = weekDays.some((wd) => isSameDay(wd, d))
              const isSelectedDay = selectedDay && isSameDay(d, selectedDay)
              if (!inMonth) return <div key={idx} className="m-0.5 h-7 w-7" />
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentDate(d)
                    openDayView(d)
                  }}
                  className={`m-0.5 flex h-7 w-7 items-center justify-center rounded-full transition ${
                    isSelectedDay
                      ? 'ring-2 ring-sky-400 bg-sky-500/30 text-sky-100 font-bold'
                      : isToday
                        ? 'bg-sky-500 text-white font-bold'
                        : isSelectedWeek
                          ? 'bg-sky-500/20 text-sky-200'
                          : 'text-slate-300 hover:bg-bg-panel/60'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-bg-panel/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Clock size={14} className="text-sky-400" />
              {summaryTitle}
            </div>
            {loading && (
              <div className="text-[11px] text-slate-400">กำลังโหลดข้อมูล...</div>
            )}
            {loadError && (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200">
                {loadError}
              </div>
            )}
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>รายการในช่วงนี้</span>
                <span className="text-sky-300 font-medium">{entriesInPeriod.length}</span>
              </div>
              <div className="flex justify-between">
                <span>กำลังทำงาน</span>
                <span className="text-emerald-400 font-medium">{entrySummary.running}</span>
              </div>
              <div className="flex justify-between">
                <span>เสร็จสิ้น</span>
                <span className="text-emerald-300 font-medium">{entrySummary.done}</span>
              </div>
              <div className="flex justify-between">
                <span>รอผลิต</span>
                <span className="text-sky-300 font-medium">{entrySummary.waiting}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={openCurrentEntryModal}
              className="mt-3 w-full rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:from-sky-400 hover:to-indigo-400"
            >
              📦 กรอกข้อมูลการผลิต
            </button>
          </div>
        </div>

        {/* Calendar view */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-slate-100">
                {viewMode === 'day' && selectedDay
                  ? `ตารางกะวัน${thaiDaysFull[selectedDay.getDay()]}ที่ ${selectedDay.getDate()}`
                  : viewMode === 'month'
                    ? `ตารางกะเดือน${thaiMonths[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`
                    : viewMode === 'year'
                      ? `ตารางกะปี ${yearLabel}`
                      : 'ตารางกะการผลิต'}
              </div>
              <div className="text-[11px] text-slate-400">
                {viewMode === 'day' && selectedDay ? dayLabel : viewMode === 'year' ? yearLabel : weekRangeLabel}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode dropdown */}
              <div className="relative">
                <button
                  onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                  className="flex items-center gap-1 rounded-lg border border-border bg-bg-panel/40 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-bg-panel/60"
                >
                  {currentViewLabel}
                  <ChevronDown size={14} className={`transition-transform ${viewDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {viewDropdownOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-28 overflow-hidden rounded-lg border border-border bg-bg-card shadow-lg">
                    {VIEW_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => switchView(option.value)}
                        className={`w-full px-3 py-2 text-left text-xs transition hover:bg-bg-panel/60 ${
                          viewMode === option.value ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={goToPrev}
                className="rounded-lg border border-border p-1.5 text-slate-400 hover:bg-bg-panel/60 hover:text-slate-200"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goToToday}
                className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
              >
                วันนี้
              </button>
              <button
                onClick={goToNext}
                className="rounded-lg border border-border p-1.5 text-slate-400 hover:bg-bg-panel/60 hover:text-slate-200"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="text-lg font-bold text-slate-100 mb-2">
            {viewMode === 'year' ? yearLabel : monthLabel}
          </div>

          {viewMode === 'week' && (
            <div className="rounded-lg border border-border bg-bg-card">
              {/* Header row */}
              <div className="sticky top-0 z-10 grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-bg-panel/80">
                <div className="border-r border-border p-2 text-[10px] text-slate-500"></div>
                {weekDays.map((day, idx) => {
                  const isToday = isSameDay(day, today)
                  return (
                    <button
                      key={idx}
                      onClick={() => openDayView(day)}
                      className={`border-r border-border p-2 text-center transition hover:bg-bg-panel/50 ${isToday ? 'bg-sky-500/10' : ''}`}
                    >
                      <div className={`text-[11px] font-medium ${isToday ? 'text-sky-300' : 'text-slate-400'}`}>
                        {thaiDays[idx]}
                      </div>
                      <div
                        className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition ${
                          isToday ? 'bg-sky-500 text-white' : 'text-slate-200 hover:bg-sky-500/20 hover:text-sky-200'
                        }`}
                      >
                        {day.getDate()}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Time grid */}
              <div className="relative grid grid-cols-[60px_repeat(7,1fr)] pt-3" style={{ height: HOURS.length * SLOT_HEIGHT }}>
                {/* Hour rows */}
                {HOURS.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-b border-border/50"
                    style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    <div className="absolute top-1 left-0 w-15 pr-2 text-right text-[10px] text-slate-500">
                      {formatHourLabel(hour)}
                    </div>
                  </div>
                ))}

                {/* Columns */}
                <div className="absolute left-15 right-0 top-0 bottom-0 grid grid-cols-7">
                  {weekDays.map((day, dayIdx) => {
                    const isToday = isSameDay(day, today)
                    return (
                      <div
                        key={dayIdx}
                        onClick={handleGridClick(day)}
                        className={`relative cursor-pointer border-r border-border/50 transition hover:bg-sky-500/5 ${isToday ? 'bg-sky-500/5' : ''}`}
                      >
                        {HOURS.map((_, hIdx) => (
                          <div
                            key={hIdx}
                            className="pointer-events-none absolute w-full border-b border-dashed border-border/30"
                            style={{ top: hIdx * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* Current time indicator */}
                {isTodayInWeek && (
                  <div
                    className="absolute left-15 right-0 z-20 pointer-events-none"
                    style={{ top: ((currentTimeMinutes - HOUR_START * 60) / 60) * SLOT_HEIGHT }}
                  >
                    <div className="relative flex items-center">
                      <div className="absolute -left-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                      <div className="h-px w-full bg-red-500/70" />
                    </div>
                  </div>
                )}

                {/* Production entries for the selected week */}
                {weekDays.map((day, dayIdx) => {
                  const dayEntries = entries.filter((entry) => isSameDay(entry.day, day))
                  return (
                    <div key={dayIdx}>
                      {dayEntries.map((entry) => {
                        const position = getEntryGridPosition(entry)
                        const entryStyle = getEntryStatusStyle(entry, clockNow)
                        return (
                          <div
                            key={`entry-${dayIdx}-${entry.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditEntryModal(entry)
                            }}
                            onMouseEnter={() => setHoveredEntry({ entry, day })}
                            onMouseLeave={() => setHoveredEntry(null)}
                            className={`group absolute z-20 rounded-md border px-2.5 py-1.5 text-left ring-1 ring-white/5 transition hover:z-30 cursor-pointer ${entryStyle.cardClassName}`}
                            style={{
                              left: `calc(60px + (${dayIdx} * ((100% - 60px) / 7)) + 6px)`,
                              top: position.top + 2,
                              height: Math.max(position.height - 4, 30),
                              width: 'calc((100% - 60px) / 7 - 12px)',
                            }}
                            title={`${entry.name} (${entry.time})`}
                          >
                            {renderDeleteEntryButton(entry)}
                            <div className={`absolute inset-y-1 left-1 w-1 rounded-full ${entryStyle.accentClassName}`} />
                            <div className="relative flex h-full min-w-0 items-center pl-2 pr-5">
                              <div className={`truncate text-[12px] font-extrabold leading-tight ${entryStyle.cardTitleClassName}`}>{entry.name}</div>
                            </div>
                            {hoveredEntry?.entry.id === entry.id && renderEntryPopup(entry, day)}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === 'day' && selectedDay && (
            <div className="rounded-lg border border-border bg-bg-card">
              <div className="sticky top-0 z-10 border-b border-border bg-bg-panel/80 p-3 text-center">
                <div className={`text-[11px] font-medium ${isSameDay(selectedDay, today) ? 'text-sky-300' : 'text-slate-400'}`}>
                  {thaiDays[selectedDay.getDay()]}
                </div>
                <div
                  className={`mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                    isSameDay(selectedDay, today) ? 'bg-sky-500 text-white' : 'text-slate-200 bg-bg-panel/60'
                  }`}
                >
                  {selectedDay.getDate()}
                </div>
              </div>

              <div className="relative grid grid-cols-[60px_1fr] pt-3" style={{ height: HOURS.length * SLOT_HEIGHT }}>
                {HOURS.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-b border-border/50"
                    style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    <div className="absolute top-1 left-0 w-15 pr-2 text-right text-[10px] text-slate-500">
                      {formatHourLabel(hour)}
                    </div>
                  </div>
                ))}

                <div
                  onClick={handleGridClick(selectedDay)}
                  className={`absolute left-15 right-0 top-0 bottom-0 cursor-pointer transition hover:bg-sky-500/5 ${isSameDay(selectedDay, today) ? 'bg-sky-500/5' : ''}`}
                >
                  {HOURS.map((_, hIdx) => (
                    <div
                      key={hIdx}
                      className="pointer-events-none absolute w-full border-b border-dashed border-border/30"
                      style={{ top: hIdx * SLOT_HEIGHT + SLOT_HEIGHT / 2 }}
                    />
                  ))}
                </div>

                {isSameDay(selectedDay, today) && (
                  <div
                    className="absolute left-15 right-0 z-20 pointer-events-none"
                    style={{ top: ((currentTimeMinutes - HOUR_START * 60) / 60) * SLOT_HEIGHT }}
                  >
                    <div className="relative flex items-center">
                      <div className="absolute -left-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                      <div className="h-px w-full bg-red-500/70" />
                    </div>
                  </div>
                )}

                {entries
                  .filter((entry) => isSameDay(entry.day, selectedDay))
                  .map((entry) => {
                    const position = getEntryGridPosition(entry)
                    const entryStyle = getEntryStatusStyle(entry, clockNow)
                    return (
                      <div
                        key={`entry-${entry.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditEntryModal(entry)
                        }}
                        onMouseEnter={() => setHoveredEntry({ entry, day: selectedDay })}
                        onMouseLeave={() => setHoveredEntry(null)}
                        className={`group absolute z-20 rounded-lg border px-3 py-2 text-left ring-1 ring-white/5 transition hover:z-30 cursor-pointer ${entryStyle.cardClassName}`}
                        style={{
                          left: '68px',
                          top: position.top + 2,
                          height: Math.max(position.height - 4, 34),
                          right: '10px',
                        }}
                        title={`${entry.name} (${entry.time})`}
                      >
                        {renderDeleteEntryButton(entry)}
                        <div className={`absolute inset-y-1.5 left-1.5 w-1 rounded-full ${entryStyle.accentClassName}`} />
                        <div className="relative flex h-full min-w-0 items-center pl-3 pr-6">
                          <div className={`truncate text-base font-extrabold leading-tight ${entryStyle.cardTitleClassName}`}>{entry.name}</div>
                        </div>
                        {hoveredEntry?.entry.id === entry.id && renderEntryPopup(entry, selectedDay)}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {viewMode === 'month' && (
            <div className="rounded-lg border border-border bg-bg-card p-4">
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400 mb-2">
                {thaiDays.map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((d, idx) => {
                  const inMonth = d.getMonth() === currentDate.getMonth()
                  const isToday = isSameDay(d, today)
                  const dayEvents = entries
                    .filter((e) => isSameDay(e.day, d))
                    .map((e) => ({ ...e, source: 'entry', statusStyle: getEntryStatusStyle(e, clockNow) }))
                  const visibleEvents = dayEvents.slice(0, 3)
                  const moreCount = dayEvents.length - visibleEvents.length
                  return (
                    <button
                      key={idx}
                      onClick={() => openDayView(d)}
                      className={`relative min-h-22 rounded-lg border p-1.5 text-left transition hover:bg-bg-panel/40 ${
                        isToday ? 'border-sky-500/40 bg-sky-500/10' : inMonth ? 'border-border/50 bg-bg-panel/20' : 'border-border/30 bg-transparent opacity-50'
                      }`}
                    >
                      <div className={`text-[11px] font-medium ${isToday ? 'text-sky-300' : 'text-slate-400'}`}>
                        {d.getDate()}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {visibleEvents.map((event) => (
                          <div
                            key={`${event.source}-${event.id}`}
                            className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] text-slate-200"
                            style={{ backgroundColor: event.source === 'entry' ? event.statusStyle.monthBackground : `${event.color}15` }}
                            title={`${event.name} (${event.time})`}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: event.source === 'entry' ? event.statusStyle.monthDot : event.color }}
                            />
                            <span className="shrink-0 text-slate-400">{event.time}</span>
                            <span className="truncate">{event.name}</span>
                          </div>
                        ))}
                        {moreCount > 0 && (
                          <div className="text-[9px] text-slate-500 px-1">+{moreCount} รายการ</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {viewMode === 'year' && (
            <div className="rounded-lg border border-border bg-bg-card p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {yearMonths.map((monthDate, mIdx) => (
                  <button
                    key={mIdx}
                    onClick={() => {
                      setCurrentDate(monthDate)
                      switchView('month')
                    }}
                    className="rounded-lg border border-border/50 bg-bg-panel/20 p-3 text-left transition hover:border-sky-500/30"
                  >
                    <div className="mb-2 text-center text-sm font-semibold text-slate-200">
                      {thaiMonths[monthDate.getMonth()]}
                    </div>
                    <div className="grid grid-cols-7 text-center text-[9px] text-slate-500">
                      {thaiDays.map((d) => (
                        <div key={d} className="py-0.5">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 text-center text-[10px]">
                      {getMonthDays(monthDate.getFullYear(), monthDate.getMonth()).map((d, dIdx) => {
                        const inMonth = d.getMonth() === monthDate.getMonth()
                        const isToday = isSameDay(d, today)
                        if (!inMonth) return <div key={dIdx} />
                        return (
                          <div
                            key={dIdx}
                            className={`py-0.5 ${
                              isToday ? 'rounded-full bg-sky-500 text-white font-bold' : 'text-slate-400'
                            }`}
                          >
                            {d.getDate()}
                          </div>
                        )
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <span>วันนี้</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>เวลาปัจจุบัน</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>กำลังทำงาน</span>
            </div>
          </div>
        </div>
      </div>

      {entryModalOpen && (
        <ProductionEntryModal
          slot={selectedSlot}
          entry={editingEntry}
          products={products}
          stockData={stockData}
          onClose={closeEntryModal}
          onSave={saveEntry}
          onDelete={deleteEntry}
        />
      )}
    </section>
  )
}

const ForwardedProductCalendar = forwardRef(ProductCalendar)
ForwardedProductCalendar.propTypes = {
  shifts: PropTypes.array,
}
export default ForwardedProductCalendar
