import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createLog } from '../services/logApi.js'
import { getStoredUser } from '../services/authApi.js'
import { api } from '../services/api.js'
import ProductCalendar from '../components/ProductCalendar.jsx'
import ProductionEntryModal from '../components/ProductionEntryModal.jsx'

// Settings page from container - Data Entry Center with shift management
const shifts = [
  { id: 1, type: 'Day shift 1', name: 'Day shift A', time: '06:00 – 14:00', status: 'waiting', isCurrent: true },
  { id: 2, type: 'Day shift 2', name: 'Day shift B', time: '14:00 – 22:00', status: 'waiting', isCurrent: false },
  { id: 3, type: 'Day shift 3', name: 'Night shift A', time: '22:00 – 06:00', status: 'waiting', isCurrent: false },
  { id: 4, type: 'Day shift 4', name: 'Day shift C', time: '08:00 – 20:00', status: 'waiting', isCurrent: false }
]

const statusConfig = {
  waiting: { border: 'border-border', bg: 'bg-bg-panel/60', badgeBorder: 'border-sky-500/30', badgeBg: 'bg-sky-500/10', badgeText: 'text-sky-200', badgeLabel: 'รอคิว' },
  running: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', badgeBorder: 'border-emerald-500/30', badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-200', badgeLabel: 'กำลังทำงาน' },
  done: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', badgeBorder: 'border-emerald-500/30', badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-200', badgeLabel: 'เสร็จ' }
}

const colors = [
  '#3b82f6', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#f97316', '#ef4444'
]

const SHIFTS_SYNC_KEY = 'shiftsUpdatedAt'
const SHIFTS_CHANGED_EVENT = 'shifts:changed'
const PRODUCTION_ENTRIES_SYNC_KEY = 'productionEntriesUpdatedAt'
const PRODUCTION_ENTRIES_CHANGED_EVENT = 'production-entries:changed'
const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))
const WORK_PLAN_RANGES = [
  { value: 'today', label: 'วันนี้' },
  { value: 'week', label: 'สัปดาห์' },
  { value: 'month', label: 'เดือน' },
]
const thaiDaysFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

function notifyShiftsChanged() {
  try {
    localStorage.setItem(SHIFTS_SYNC_KEY, String(Date.now()))
  } catch {}
  window.dispatchEvent(new CustomEvent(SHIFTS_CHANGED_EVENT))
}

function mergeProductNames(...lists) {
  return Array.from(
    new Set(
      lists
        .flat()
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    )
  )
}

function formatHourLabel(hour) {
  if (hour === 24) return '12 AM'
  const h = hour % 12 || 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h} ${suffix}`
}

function formatTimeFromMinutes(minutesValue) {
  const minutesNumber = Number(minutesValue)
  if (!Number.isFinite(minutesNumber)) return '00:00'
  const clamped = Math.max(0, Math.min(minutesNumber, 24 * 60))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function formatKg(value) {
  return (Number(value) || 0).toLocaleString('en-US')
}

function normalizeShift(s, index = 0) {
  return {
    ...s,
    id: s._id || s.id,
    order: s.order ?? index,
    status: ['waiting', 'running', 'done'].includes(s.status) ? s.status : 'waiting'
  }
}

function formatThaiProductionDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${thaiDaysFull[date.getDay()]} ${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`
}

function getShiftCardHeading(shift) {
  const dateLabel = formatThaiProductionDate(shift.productionDate || shift.date || shift.createdAt)
  if (!dateLabel || !shift.product) {
    return {
      title: shift.name,
      subtitle: ''
    }
  }
  return {
    title: `ช่วงเวลา: ${dateLabel}`,
    subtitle: shift.product
  }
}

function normalizePlanEntry(entry, index = 0) {
  const date = new Date(entry.date || entry.day || entry.createdAt || Date.now())
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  const startMinutes = Number(entry.startMinutes) || 0
  const endMinutes = Number(entry.endMinutes) || Math.min(startMinutes + 60, 24 * 60)
  const cleaningParts = String(entry.cleaningTime || '00:00').split(':')
  return {
    id: entry._id || entry.id || `plan-${index}`,
    date,
    startMinutes,
    endMinutes,
    product: entry.product || entry.name || 'ไม่ระบุสินค้า',
    timeRange: entry.timeRange || `${formatTimeFromMinutes(startMinutes)} - ${formatTimeFromMinutes(endMinutes)}`,
    inputWeight: Number(entry.received ?? entry.data?.inputWeight) || 0,
    outputWeight: Number(entry.siloOutput ?? entry.data?.outputWeight) || 0,
    targetWeight: Number(entry.target ?? entry.data?.standardWeight) || 0,
    cleaningTime: entry.cleaningTime || `${cleaningParts[0] || '00'}:${cleaningParts[1] || '00'}`,
  }
}

function getPlanStatus(entry) {
  const now = new Date()
  const startAt = new Date(entry.date)
  startAt.setHours(Math.floor(entry.startMinutes / 60), entry.startMinutes % 60, 0, 0)
  const endAt = new Date(entry.date)
  endAt.setHours(Math.floor(entry.endMinutes / 60), entry.endMinutes % 60, 0, 0)

  if (now >= startAt && now <= endAt) {
    return {
      label: 'กำลังทำ',
      className: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
      dotClassName: 'bg-sky-400',
    }
  }
  if (now > endAt) {
    return {
      label: 'เสร็จ',
      className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
      dotClassName: 'bg-emerald-400',
    }
  }
  return {
    label: 'รอทำ',
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    dotClassName: 'bg-amber-400',
  }
}

function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfCalendarDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfCalendarWeek(date) {
  const next = startOfCalendarDay(date)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function isEntryInWorkPlanRange(entryDate, range, baseDate = new Date()) {
  const day = startOfCalendarDay(entryDate)
  const today = startOfCalendarDay(baseDate)

  if (range === 'today') {
    return isSameCalendarDay(day, today)
  }
  if (range === 'week') {
    const weekStart = startOfCalendarWeek(today)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return day >= weekStart && day <= weekEnd
  }
  if (range === 'month') {
    return day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth()
  }
  return true
}

export default function Settings() {
  const [showModal, setShowModal] = useState(false)
  const [showProductionEntryModal, setShowProductionEntryModal] = useState(false)
  const [productionEntrySlot, setProductionEntrySlot] = useState(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [creatingShift, setCreatingShift] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [products, setProducts] = useState([])
  const [stockData, setStockData] = useState([])
  const [productionEntries, setProductionEntries] = useState([])
  const [productionEntriesLoading, setProductionEntriesLoading] = useState(true)
  const [workPlanRange, setWorkPlanRange] = useState('today')
  const [formData, setFormData] = useState({
    machine: '',
    line: 'A',
    good: '',
    total: '',
    cleaningHours: '00',
    cleaningMinutes: '00'
  })
  const [shiftData, setShiftData] = useState(shifts.map((s, i) => ({ ...s, color: s.id === 1 ? '#3b82f6' : s.id === 2 ? '#10b981' : s.id === 3 ? '#f59e0b' : '#ef4444', order: i })))
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [orderSaved, setOrderSaved] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [editingStatusId, setEditingStatusId] = useState(null)
  const calendarRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const fetchProducts = async () => {
      try {
        const res = await api.getProductTypes()
        if (cancelled) return
        const names = (res.data || []).map((p) => p.name)
        setProducts((prev) => mergeProductNames(names, prev))
        if (names.length) {
          setFormData((prev) => (prev.machine ? prev : { ...prev, machine: names[0] }))
        }
      } catch (err) {
        console.error('Failed to load products:', err)
      }
    }
    const fetchStockData = async () => {
      try {
        const res = await api.getMaterialStock()
        if (cancelled) return
        const stock = res.data || []
        const stockNames = stock.map((item) => item.product)
        setStockData(stock)
        setProducts((prev) => mergeProductNames(prev, stockNames))
        if (stockNames.length) {
          setFormData((prev) => (prev.machine ? prev : { ...prev, machine: stockNames[0] }))
        }
      } catch (err) {
        console.error('Failed to load material stock:', err)
      }
    }
    const fetchProductionEntries = async () => {
      try {
        setProductionEntriesLoading(true)
        const res = await api.getProductionEntries({ limit: 1000 })
        if (cancelled) return
        setProductionEntries(res.data || [])
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load production entries:', err)
          setProductionEntries([])
        }
      } finally {
        if (!cancelled) setProductionEntriesLoading(false)
      }
    }
    const fetchShifts = async () => {
      try {
        const json = await api.getShifts()
        if (cancelled) return
        if (json.success && Array.isArray(json.data)) {
          setShiftData(json.data.map((s, i) => normalizeShift(s, i)))
        }
      } catch (err) {
        console.error('Failed to load shifts:', err)
      }
    }
    fetchShifts()
    fetchProducts()
    fetchStockData()
    fetchProductionEntries()
    const handleShiftsChanged = () => { fetchShifts(); fetchProducts(); fetchStockData() }
    const handleProductionEntriesChanged = () => { fetchProductionEntries(); fetchStockData() }
    const handleStorage = (event) => {
      if (event.key === SHIFTS_SYNC_KEY) fetchShifts()
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY) fetchProductionEntries()
    }
    window.addEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
    window.addEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
      window.removeEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const [newShift, setNewShift] = useState({
    name: '',
    timeStart: '06:00',
    timeEnd: '14:00',
    color: '#3b82f6',
    status: 'waiting',
  })

  const currentUser = getStoredUser()
  const isAnyRunning = shiftData.some((s) => s.status === 'running')
  const workPlanEntries = useMemo(() => {
    return productionEntries
      .map((entry, index) => normalizePlanEntry(entry, index))
      .filter(Boolean)
      .sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime()
        return dateDiff || a.startMinutes - b.startMinutes
      })
  }, [productionEntries])
  const todayPlanEntries = useMemo(() => {
    const today = new Date()
    return workPlanEntries.filter((entry) => isSameCalendarDay(entry.date, today))
  }, [workPlanEntries])
  const filteredWorkPlanEntries = useMemo(() => {
    return workPlanEntries.filter((entry) => isEntryInWorkPlanRange(entry.date, workPlanRange))
  }, [workPlanEntries, workPlanRange])
  const workPlanRangeLabel = WORK_PLAN_RANGES.find((item) => item.value === workPlanRange)?.label || 'ทั้งหมด'
  const workPlanGroups = useMemo(() => {
    const groups = new Map()
    filteredWorkPlanEntries.forEach((entry) => {
      const key = `${entry.date.getFullYear()}-${entry.date.getMonth()}-${entry.date.getDate()}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date: entry.date,
          entries: [],
        })
      }
      groups.get(key).entries.push(entry)
    })
    return Array.from(groups.values())
  }, [filteredWorkPlanEntries])
  const workPlanTotals = useMemo(() => {
    return filteredWorkPlanEntries.reduce(
      (totals, entry) => ({
        input: totals.input + entry.inputWeight,
        output: totals.output + entry.outputWeight,
        target: totals.target + entry.targetWeight,
      }),
      { input: 0, output: 0, target: 0 }
    )
  }, [filteredWorkPlanEntries])

  const logAction = async (action, detail) => {
    try {
      await createLog({ type: 'DATA', action, detail })
    } catch (err) {
      console.error('Log action failed:', err)
    }
  }

  const openProductionEntryModal = () => {
    const now = new Date()
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    setProductionEntrySlot({ day, hour: Math.min(now.getHours(), 22) })
    setShowProductionEntryModal(true)
  }

  const saveProductionEntry = async (entry) => {
    const day = entry.day instanceof Date ? new Date(entry.day) : new Date(entry.day || Date.now())
    day.setHours(0, 0, 0, 0)
    const startHour = Number(entry.startHour) || 0
    let endHour = Number(entry.endHour) || startHour + 1
    if (endHour <= startHour) endHour = startHour + 1
    endHour = Math.min(endHour, 24)
    const startMinutes = startHour * 60
    const endMinutes = endHour * 60

    try {
      if (!calendarRef.current?.addEntry) {
        throw new Error('Production calendar is not ready')
      }
      await calendarRef.current?.addEntry({
        name: entry.product,
        product: entry.product,
        day,
        time: `${formatHourLabel(startHour)} - ${formatHourLabel(endHour)}`,
        startMinutes,
        endMinutes,
        status: 'running',
        color: '#22d3ee',
        data: {
          inputWeight: entry.inputWeight,
          outputWeight: entry.outputWeight,
          standardWeight: entry.standardWeight,
          cleaningHours: entry.cleaningHours,
          cleaningMinutes: entry.cleaningMinutes,
        },
      })
      setShowProductionEntryModal(false)
      setProductionEntrySlot(null)
      logAction('Create production entry', `${currentUser?.name || currentUser?.un || 'unknown'} saved ${entry.product || 'unknown product'}`)
    } catch (err) {
      console.error('Save production entry failed:', err)
    }
  }

  const handleSubmit = () => {
    setCreatingShift(true)
    setShowModal(false)
    setShowShiftModal(true)
  }

  const handleShiftSave = async () => {
    const shiftName = newShift.name || `Shift ${shiftData.length + 1}`
    const payload = {
      type: shiftName,
      name: shiftName,
      time: `${newShift.timeStart} – ${newShift.timeEnd}`,
      status: newShift.status,
      isCurrent: false,
      color: newShift.color,
      productionDate: new Date().toISOString(),
      product: formData.machine,
      received: Number(formData.good) || 0,
      target: Number(formData.total) || 0,
      bagSize: 0,
      cleaningTime: `${formData.cleaningHours}:${formData.cleaningMinutes}`,
    }
    let createdShiftId = null
    try {
      const json = await api.createShift(payload)
      if (json.success) {
        createdShiftId = json.data._id || json.data.id
        const [startH, startM] = newShift.timeStart.split(':').map(Number)
        const [endH, endM] = newShift.timeEnd.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        let endMinutes = endH * 60 + endM
        if (endMinutes < startMinutes) endMinutes = 24 * 60
        const entryDay = new Date()
        entryDay.setHours(0, 0, 0, 0)
        await calendarRef.current?.addEntry({
          shiftId: createdShiftId,
          shift: json.data.name || shiftName,
          name: formData.machine,
          product: formData.machine,
          day: entryDay,
          time: `${newShift.timeStart} - ${newShift.timeEnd}`,
          status: 'running',
          color: newShift.color,
          data: {
            inputWeight: formData.good,
            standardWeight: formData.total,
            cleaningHours: formData.cleaningHours,
            cleaningMinutes: formData.cleaningMinutes,
          },
          startMinutes,
          endMinutes,
        })
        setShiftData([...shiftData, normalizeShift(json.data, shiftData.length)])
        notifyShiftsChanged()
        logAction('สร้าง Shift', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} สร้างกะ ${shiftName} (สินค้า: ${formData.machine})`)
      }
    } catch (err) {
      console.error('Save shift failed:', err)
      if (createdShiftId) {
        await api.deleteShift(createdShiftId).catch((rollbackErr) => {
          console.error('Rollback shift failed:', rollbackErr)
        })
      }
      alert('บันทึกกะไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    }
    setShowShiftModal(false)
    setFormData({ machine: products[0] || '', line: 'A', good: '', total: '', cleaningHours: '00', cleaningMinutes: '00' })
    setNewShift({ name: '', timeStart: '06:00', timeEnd: '14:00', color: '#3b82f6', status: 'waiting' })
  }

  const handleShiftUpdate = async () => {
    try {
      await Promise.all(shiftData.map((shift, index) => {
        const { id, ...payload } = shift
        return api.updateShift(id, { ...payload, order: index, received: Number(payload.received) || 0, target: Number(payload.target) || 0 })
      }))
      notifyShiftsChanged()
      logAction('บันทึก/จัดเรียง Shift', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} บันทึกและจัดเรียงกะ ${shiftData.length} รายการ`)
    } catch (err) {
      console.error('Update shifts failed:', err)
    }
    setShowShiftModal(false)
  }

  const handleDeleteShift = async (id) => {
    if (!confirm('ต้องการลบกะนี้?')) return
    const shiftName = shiftData.find((s) => s.id === id)?.name || id
    try {
      const json = await api.deleteShift(id)
      if (json.success) {
        setShiftData(shiftData.filter((s) => s.id !== id))
        notifyShiftsChanged()
        // Also delete production entries linked to this shift
        try {
          const entriesRes = await api.getProductionEntries({ limit: 1000 })
          const linkedEntries = (entriesRes.data || []).filter((e) => e.shiftId === id)
          await Promise.all(
            linkedEntries.map((e) => api.deleteProductionEntry(e._id).catch(() => {}))
          )
          // Notify calendar to refresh
          localStorage.setItem('productionEntriesUpdatedAt', String(Date.now()))
          window.dispatchEvent(new CustomEvent('production-entries:changed'))
        } catch {}
        logAction('ลบ Shift', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} ลบกะ ${shiftName}`)
      }
    } catch (err) {
      console.error('Delete shift failed:', err)
    }
  }

  const handleDragStart = (e, id) => {
    if (isAnyRunning) {
      alert('เครื่องจักรกำลังทำงาน ไม่สามารถจัดเรียงคิวได้')
      e.preventDefault()
      return
    }
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, id) => {
    if (isAnyRunning) return
    e.preventDefault()
    if (id !== draggedId) setDragOverId(id)
  }

  const handleDrop = async (e, targetId) => {
    e.preventDefault()
    setDragOverId(null)
    if (isAnyRunning || draggedId === targetId || !draggedId) {
      setDraggedId(null)
      return
    }
    const fromIndex = shiftData.findIndex((s) => s.id === draggedId)
    const toIndex = shiftData.findIndex((s) => s.id === targetId)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedId(null)
      return
    }
    const next = [...shiftData]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    const reordered = next.map((s, i) => ({ ...s, order: i }))
    setShiftData(reordered)
    setDraggedId(null)

    try {
      setSavingOrder(true)
      await Promise.all(reordered.map((shift) => {
        const { id, ...payload } = shift
        return api.updateShift(id, payload)
      }))
      setOrderSaved(true)
      notifyShiftsChanged()
      setTimeout(() => setOrderSaved(false), 2000)
      logAction('จัดเรียงคิว Shift', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} จัดเรียง Shift ${reordered.length} รายการ`)
    } catch (err) {
      console.error('Save order failed:', err)
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleStatusChange = async (id, newStatus) => {
    const prevShift = shiftData.find((s) => s.id === id)
    const prevStatus = prevShift?.status || 'waiting'
    setEditingStatusId(null)
    setShiftData(shiftData.map((s) => s.id === id ? { ...s, status: newStatus } : s))
    try {
      const json = await api.updateShift(id, { status: newStatus })
      if (json.success) {
        notifyShiftsChanged()
        logAction('เปลี่ยนสถานะ Shift', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} เปลี่ยน ${prevShift?.name} จาก ${prevStatus} เป็น ${newStatus}`)
      } else {
        throw new Error(json.message || 'Update failed')
      }
    } catch (err) {
      console.error('Status change failed:', err)
      setShiftData(shiftData.map((s) => s.id === id ? { ...s, status: prevStatus } : s))
    }
  }

  return (
    <div className="space-y-3">
      <ProductCalendar ref={calendarRef} shifts={shiftData} />

      {showProductionEntryModal && (
        <ProductionEntryModal
          slot={productionEntrySlot}
          products={products}
          stockData={stockData}
          onClose={() => {
            setShowProductionEntryModal(false)
            setProductionEntrySlot(null)
          }}
          onSave={saveProductionEntry}
        />
      )}

      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-lg">🗓️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-100">แผนการทำงาน</h2>
                <p className="mt-1 text-xs text-slate-400">สรุปจากข้อมูลใน Calendar เรียงตามวันและเวลา</p>
                <div className="mt-3 inline-flex rounded-lg border border-border bg-bg-panel/60 p-1">
                  {WORK_PLAN_RANGES.map((option) => {
                    const selected = workPlanRange === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setWorkPlanRange(option.value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                          selected
                            ? 'bg-sky-500 text-white shadow-sm shadow-sky-900/30'
                            : 'text-slate-400 hover:bg-bg-card/70 hover:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:min-w-[620px]">
            <div className="rounded-lg border border-border bg-bg-panel/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">แผนในช่วงนี้</div>
              <div className="mt-1 font-mono text-lg font-black text-slate-100">{filteredWorkPlanEntries.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-bg-panel/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">ช่วงเวลา</div>
              <div className="mt-1 text-sm font-black text-sky-300">{workPlanRangeLabel}</div>
            </div>
            <div className="rounded-lg border border-border bg-bg-panel/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">เอาเข้าไซโลรวม</div>
              <div className="mt-1 font-mono text-lg font-black text-emerald-300">{formatKg(workPlanTotals.input)} kg</div>
            </div>
            <div className="rounded-lg border border-border bg-bg-panel/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">ผลิตจากไซโลรวม</div>
              <div className="mt-1 font-mono text-lg font-black text-violet-300">{formatKg(workPlanTotals.output)} kg</div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {productionEntriesLoading ? (
            <div className="rounded-xl border border-border bg-bg-panel/40 px-4 py-8 text-center text-sm text-slate-400">
              กำลังโหลดแผนการทำงาน...
            </div>
          ) : workPlanGroups.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-panel/40 px-4 py-8 text-center text-sm text-slate-400">
              ยังไม่มีแผนการทำงาน
            </div>
          ) : (
            workPlanGroups.map((group) => {
              const dailyInput = group.entries.reduce((sum, entry) => sum + entry.inputWeight, 0)
              const dailyOutput = group.entries.reduce((sum, entry) => sum + entry.outputWeight, 0)
              return (
                <div key={group.key} className="overflow-hidden rounded-xl border border-border bg-bg-panel/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg-panel/60 px-4 py-3">
                    <div>
                      <div className="text-sm font-bold text-slate-100">{formatThaiProductionDate(group.date)}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{group.entries.length} งาน</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-emerald-200">
                        เข้า {formatKg(dailyInput)} kg
                      </span>
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 font-mono text-violet-200">
                        ออก {formatKg(dailyOutput)} kg
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {group.entries.map((entry) => {
                      const status = getPlanStatus(entry)
                      return (
                        <div key={entry.id} className="grid grid-cols-1 gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] lg:grid-cols-[150px_1fr_130px_130px_130px_100px] lg:items-center">
                          <div>
                            <div className="font-mono text-sm font-bold text-sky-200">{entry.timeRange}</div>
                            <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
                              {status.label}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-100">{entry.product}</div>
                            <div className="mt-0.5 text-xs text-slate-500">Cleaning {entry.cleaningTime}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">เอาเข้าไซโล</div>
                            <div className="mt-1 font-mono text-sm font-black text-emerald-300">{formatKg(entry.inputWeight)} kg</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">ผลิตจากไซโล</div>
                            <div className="mt-1 font-mono text-sm font-black text-violet-300">{formatKg(entry.outputWeight)} kg</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">มาตรฐาน</div>
                            <div className="mt-1 font-mono text-sm font-black text-amber-300">{formatKg(entry.targetWeight)} kg</div>
                          </div>
                          <div className="text-right lg:text-left">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">ระยะเวลา</div>
                            <div className="mt-1 font-mono text-sm font-bold text-slate-200">
                              {Math.max(0, (entry.endMinutes - entry.startMinutes) / 60).toLocaleString('en-US')} ชม.
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {false && (
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="text-center">
          <div className="text-lg font-bold text-slate-100 mb-4">⏰ ตั้งค่ากะการทำงาน</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {shiftData.map((shift) => {
              const config = statusConfig[shift.status] || statusConfig.waiting
              const isDragging = draggedId === shift.id
              const isDragOver = dragOverId === shift.id
              const heading = getShiftCardHeading(shift)
              return (
                <div
                  key={shift.id}
                  draggable={!isAnyRunning}
                  onDragStart={(e) => handleDragStart(e, shift.id)}
                  onDragOver={(e) => handleDragOver(e, shift.id)}
                  onDrop={(e) => handleDrop(e, shift.id)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl border p-4 text-left transition-all ${config.border} ${config.bg} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'ring-2 ring-sky-500/50 border-sky-500/50' : ''} ${isAnyRunning ? 'cursor-not-allowed' : 'cursor-move'}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="truncate text-sm font-semibold text-slate-100">{heading.title}</div>
                      {heading.subtitle && (
                        <div className="mt-0.5 truncate text-xs font-semibold text-sky-200">{heading.subtitle}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingStatusId === shift.id ? (
                        <select
                          className="rounded-full border px-2 py-0.5 font-mono text-[10px] bg-bg-card text-slate-100 outline-none focus:border-sky-500"
                          value={shift.status}
                          onChange={(e) => handleStatusChange(shift.id, e.target.value)}
                          onBlur={() => setEditingStatusId(null)}
                          autoFocus
                        >
                          <option value="waiting">รอคิว</option>
                          <option value="running">กำลังทำงาน</option>
                          <option value="done">เสร็จ</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingStatusId(shift.id)}
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${config.badgeBorder} ${config.badgeBg} ${config.badgeText} hover:opacity-80`}
                          title="คลิกเพื่อเปลี่ยนสถานะ"
                        >
                          {config.badgeLabel}
                        </button>
                      )}
                      <button
                        onClick={() => { setCreatingShift(false); setShowShiftModal(true) }}
                        className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition"
                        title="แก้ไขกะ"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition"
                        title="ลบกะ"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-400">{shift.time}</div>
                  {shift.product && (
                    <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                      <div><span className="text-slate-500">สินค้า:</span> {shift.product}</div>
                      <div><span className="text-slate-500">รับเข้า:</span> {shift.received || 0} Kg</div>
                      <div><span className="text-slate-500">น้ำหนักมาตรฐานที่ควรได้:</span> {shift.target || 0} Kg</div>
                      <div><span className="text-slate-500">Cleaning:</span> {shift.cleaningTime}</div>
                    </div>
                  )}
                  {shift.isCurrent && (
                    <div className="mt-2 text-xs font-semibold text-sky-300">● กะปัจจุบัน</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      )}

      {/* Shift Settings Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <div className="relative w-[600px] max-w-full overflow-hidden rounded-xl border border-border panel-modal">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {creatingShift ? '⏰ กำหนดชื่อกะ / บันทึกกะใหม่' : '⏰ กำหนดการทำงานกะ'}
              </span>
              <button onClick={() => { setShowShiftModal(false); setCreatingShift(false) }} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors">✕</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 text-sm text-slate-300">
              <div className="space-y-3">
                {creatingShift && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                    <div className="mb-3 text-sm font-semibold text-sky-200">📦 ข้อมูลการผลิตที่บันทึก</div>
                    <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                      <div><span className="text-slate-500">สินค้า:</span> {formData.machine}</div>
                      <div><span className="text-slate-500">รับเข้า:</span> {formData.good || 0} Kg</div>
                      <div><span className="text-slate-500">น้ำหนักมาตรฐานที่ควรได้:</span> {formData.total || 0} Kg</div>
                      <div><span className="text-slate-500">Cleaning:</span> {formData.cleaningHours}:{formData.cleaningMinutes}</div>
                    </div>
                    <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">ชื่อกะ</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          placeholder="Shift name"
                          value={newShift.name}
                          onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">เวลาเริ่ม</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time"
                          value={newShift.timeStart}
                          onChange={(e) => setNewShift({ ...newShift, timeStart: e.target.value })} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">เวลาสิ้นสุด</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time"
                          value={newShift.timeEnd}
                          onChange={(e) => setNewShift({ ...newShift, timeEnd: e.target.value })} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">สีประจำกะ</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {colors.map((c) => (
                            <button key={c} type="button" onClick={() => setNewShift({ ...newShift, color: c })}
                              className={`h-7 w-7 rounded-full border transition-all ${newShift.color === c ? 'border-white/70 ring-2 ring-white/20' : 'border-white/10 hover:border-white/30'}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border px-2 py-0.5 text-xs font-medium border-sky-500/30 bg-sky-500/10 text-sky-200">
                        รอคิว
                      </span>
                      <span className="text-xs text-slate-400">สถานะเริ่มต้นสำหรับ Shift ใหม่</span>
                    </div>
                  </div>
                )}
                {shiftData.map((shift, idx) => (
                  <div key={shift.id} className={`rounded-xl border p-4 ${statusConfig[shift.status].border} ${statusConfig[shift.status].bg}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold"
                          style={{
                            backgroundColor: shift.status === 'done' ? 'rgba(16,185,129,0.15)' : `${shift.color}20`,
                            borderColor: shift.status === 'running' || shift.status === 'done' ? '#10b981' : shift.color,
                            color: shift.status === 'running' || shift.status === 'done' ? '#34d399' : undefined
                          }}>
                          {shift.id}
                        </div>
                        <div className="text-sm font-semibold text-slate-100">{shift.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {editingStatusId === shift.id ? (
                          <select
                            className="rounded-full border px-2 py-0.5 text-xs font-medium bg-bg-card text-slate-100 outline-none focus:border-sky-500"
                            value={shift.status}
                            onChange={(e) => handleStatusChange(shift.id, e.target.value)}
                            onBlur={() => setEditingStatusId(null)}
                            autoFocus
                          >
                            <option value="waiting">รอคิว</option>
                            <option value="running">กำลังทำงาน</option>
                            <option value="done">เสร็จ</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingStatusId(shift.id)}
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig[shift.status]?.badgeBorder || statusConfig.waiting.badgeBorder} ${statusConfig[shift.status]?.badgeBg || statusConfig.waiting.badgeBg} ${statusConfig[shift.status]?.badgeText || statusConfig.waiting.badgeText} hover:opacity-80`}
                            title="คลิกเพื่อเปลี่ยนสถานะ"
                          >
                            {statusConfig[shift.status]?.badgeLabel || 'รอคิว'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteShift(shift.id)}
                          className="ml-1 flex h-6 w-6 items-center justify-center rounded text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300 transition"
                          title="ลบกะ"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">ชื่อกะ</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          value={shift.name}
                          onChange={(e) => setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, name: e.target.value } : s))} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">เวลาเริ่ม</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time"
                          value={shift.time.split('–')[0].trim()}
                          onChange={(e) => {
                            const end = shift.time.split('–')[1].trim()
                            setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, time: `${e.target.value} – ${end}` } : s))
                          }} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">เวลาสิ้นสุด</div>
                        <input className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500" type="time"
                          value={shift.time.split('–')[1].trim()}
                          onChange={(e) => {
                            const start = shift.time.split('–')[0].trim()
                            setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, time: `${start} – ${e.target.value}` } : s))
                          }} />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">สีประจำกะ</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {colors.map((c) => (
                            <button key={c} type="button" onClick={() => setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, color: c } : s))}
                              className={`h-7 w-7 rounded-full border transition-all ${shift.color === c ? 'border-white/70 ring-2 ring-white/20' : 'border-white/10 hover:border-white/30'}`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-slate-400">{shift.color}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">สินค้า</div>
                        <select
                          className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          value={shift.product || products[0] || ''}
                          onChange={(e) => setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, product: e.target.value } : s))}
                        >
                          {products.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Cleaning</div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            value={(shift.cleaningTime || '00:00').split(':')[0]}
                            onChange={(e) => {
                              const [, m] = (shift.cleaningTime || '00:00').split(':')
                              setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, cleaningTime: `${e.target.value}:${m || '00'}` } : s))
                            }}
                          >
                            {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <select
                            className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            value={(shift.cleaningTime || '00:00').split(':')[1] || '00'}
                            onChange={(e) => {
                              const [h] = (shift.cleaningTime || '00:00').split(':')
                              setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, cleaningTime: `${h || '00'}:${e.target.value}` } : s))
                            }}
                          >
                            {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">รับเข้า (Kg)</div>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                          placeholder="0"
                          value={shift.received || ''}
                          onChange={(e) => setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, received: e.target.value } : s))}
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">น้ำหนักมาตรฐานที่ควรได้ (Kg)</div>
                        <input
                          type="number"
                          className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                          placeholder="0"
                          value={shift.target || ''}
                          onChange={(e) => setShiftData(shiftData.map((s) => s.id === shift.id ? { ...s, target: e.target.value } : s))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setShowShiftModal(false); setCreatingShift(false) }} className="flex-1 rounded-lg border border-border bg-bg-panel/40 px-3 py-2 text-sm text-slate-400 hover:text-slate-200">ยกเลิก</button>
                  <button onClick={creatingShift ? handleShiftSave : handleShiftUpdate} className="flex-[2] rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 px-3 py-2 text-sm font-bold text-white">💾 {creatingShift ? 'บันทึกกะใหม่' : 'บันทึกการตั้งค่า'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-xl border border-border panel-modal p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-100">📦 กรอกข้อมูลการผลิต</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">สินค้า</div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProductOpen(!productOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  >
                    <span>{formData.machine}</span>
                    <span className={`text-xs transition-transform ${productOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {productOpen && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-lg">
                      {products.map((product) => (
                        <button
                          key={product}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, machine: product })
                            setProductOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition hover:bg-bg-panel/60 ${
                            formData.machine === product ? 'bg-sky-500/20 text-sky-200' : 'text-slate-100'
                          }`}
                        >
                          {product}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">ปริมาณ รับเข้า (Kg)</div>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                    placeholder="0"
                    value={formData.good}
                    onChange={(e) => setFormData({ ...formData, good: e.target.value })}
                  />
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">น้ำหนักมาตรฐานที่ควรได้ (Kg)</div>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                    placeholder="0"
                    value={formData.total}
                    onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Cleaning Time</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 text-[10px] text-slate-500">ชั่วโมง</div>
                    <select
                      className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                      value={formData.cleaningHours}
                      onChange={(e) => setFormData({ ...formData, cleaningHours: e.target.value })}
                    >
                      {hours.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] text-slate-500">นาที</div>
                    <select
                      className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 font-mono"
                      value={formData.cleaningMinutes}
                      onChange={(e) => setFormData({ ...formData, cleaningMinutes: e.target.value })}
                    >
                      {minutes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSubmit} className="flex-[2] rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:brightness-110 transition-all">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
