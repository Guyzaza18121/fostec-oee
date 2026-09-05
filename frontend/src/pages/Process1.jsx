import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '../router.jsx'
import { api } from '../services/api.js'
import { getStoredUser } from '../services/authApi.js'
import { createLog } from '../services/logApi.js'
import useNodeRedDashboard from '../hooks/useNodeRedDashboard.js'
import { getStopTimeMinutes, getWorkingTimeMinutes } from '../utils/machineTime.js'
import { getProcessTheme } from '../utils/processTheme.js'
import {
  Activity,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  ExternalLink,
  Factory,
  Gauge,
  MoveHorizontal,
  PackageMinus,
  PackagePlus,
  Plus,
  RefreshCw,
  Scale,
  Settings,
  Trash2,
  Warehouse,
  X,
  Zap,
} from 'lucide-react'

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const thaiDaysFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

const inputClass = 'w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15'
const inputStockMachineNames = [
  ...Array.from({ length: 10 }, (_, index) => `R${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `T${index + 1}`),
]
const machineOnStatusValues = new Set(['1', 'ON', 'ONLINE', 'RUN', 'RUNNING', 'TRUE'])

function machineLookupKey(value) {
  return String(value || '').trim().toUpperCase()
}

function machineStatusIsOn(status) {
  if (status === true) return true
  if (status === false) return false
  return machineOnStatusValues.has(machineLookupKey(status))
}

function machinePowerKw(machine = {}) {
  const power = Number(machine.powerKw ?? machine.powerKW ?? machine.power_kw ?? machine.power)
  return Number.isFinite(power) && power >= 0 ? power : 0
}

function addMachineToLookup(machineByKey, machine = {}) {
  ;[machine.code, machine.machineCode, machine.machineId, machine.name, machine.id].forEach((value) => {
    const key = machineLookupKey(value)
    if (key) machineByKey.set(key, machine)
  })
}

function getNodeRedMachineGroups(dashboard = {}) {
  if (Array.isArray(dashboard?.machines)) return dashboard.machines
  if (Array.isArray(dashboard?.raw?.machines)) return dashboard.raw.machines
  return []
}

function addNodeRedStatusGroupToLookup(machineByKey, group = {}) {
  const groupId = machineLookupKey(group.id)
  const fieldPrefix = groupId.toLowerCase()
  const displayPrefix = groupId === 'RM' ? 'R' : groupId === 'TM' ? 'T' : ''
  if (!fieldPrefix || !displayPrefix) return

  Array.from({ length: 10 }, (_, index) => index + 1).forEach((number) => {
    const statusKey = `${fieldPrefix}${number}_status`
    if (!Object.prototype.hasOwnProperty.call(group, statusKey)) return
    machineByKey.set(`${displayPrefix}${number}`, {
      name: `${displayPrefix}${number}`,
      status: group[statusKey],
      powerKw: group[`${fieldPrefix}${number}_power_kw`],
      raw: group,
    })
  })
}

function buildInputStockMachineRows(machines = [], nodeRedDashboard = null) {
  const machineByKey = new Map()

  machines.forEach((machine) => addMachineToLookup(machineByKey, machine))
  getNodeRedMachineGroups(nodeRedDashboard).forEach((machine) => {
    addMachineToLookup(machineByKey, machine)
    addNodeRedStatusGroupToLookup(machineByKey, machine)
  })

  return inputStockMachineNames.map((name) => {
    const machine = machineByKey.get(name)
    return {
      name,
      isOn: machine ? machineStatusIsOn(machine.status ?? machine.isOnline ?? machine.online) : false,
      powerKw: machine ? machinePowerKw(machine) : 0,
    }
  })
}

function todayInputValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateKey(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  return `${thaiDaysFull[d.getDay()]} ${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
}

function formatWeight(value) {
  return (Number(value) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function kg(value) {
  return `${formatWeight(value)} kg`
}

function sum(rows, key = 'weight') {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
}

function countProductTypes(rows = [], predicate = () => true) {
  return new Set(rows
    .filter(predicate)
    .map((row) => String(row.product || row.name || '').trim())
    .filter(Boolean)
  ).size
}

function latestByDate(rows) {
  return [...rows].sort((a, b) => new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0))[0]
}

function statusClasses(status) {
  const map = {
    run: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300',
    wait: 'border-amber-500/35 bg-amber-500/12 text-amber-300',
    idle: 'border-slate-500/30 bg-slate-500/12 text-slate-300',
    alarm: 'border-red-500/35 bg-red-500/12 text-red-300',
  }
  return map[status] || map.idle
}

function statusText(status) {
  const map = { run: 'RUN', wait: 'WAIT', idle: 'IDLE', alarm: 'ALARM' }
  return map[status] || 'IDLE'
}

function machineStatus(machine) {
  if (!machine) return 'wait'
  if (['breakdown', 'stopped'].includes(machine.status)) return 'alarm'
  if (machine.status === 'warning') return 'wait'
  if (machine.status === 'running') return 'run'
  return 'idle'
}

function findMachine(machines, keywords) {
  const lower = keywords.map((item) => item.toLowerCase())
  return machines.find((machine) => {
    const name = String(machine.name || '').toLowerCase()
    return lower.some((keyword) => name.includes(keyword))
  })
}

function MetricTile({ label, value, icon: Icon, tone = 'text-slate-100', sub, className = '', iconClass = '' }) {
  return (
    <div className={`rounded-lg border border-border bg-bg-card/80 p-3 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
        {Icon && <Icon size={14} className={iconClass} />}
        {label}
      </div>
      <div className={`mt-2 truncate font-mono text-xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(status)}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'run' ? 'bg-emerald-300' : status === 'alarm' ? 'bg-red-300' : status === 'wait' ? 'bg-amber-300' : 'bg-slate-400'}`} />
      {statusText(status)}
    </span>
  )
}

function SourceTag({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-panel/55 px-2 py-1 text-[10px] font-bold text-slate-400">
      <Database size={11} />
      {children}
    </span>
  )
}

function StepHeader({ step, icon: Icon, title, subtitle, source, status, action, accent = 'cyan' }) {
  const accents = {
    cyan: 'bg-cyan-500/15 text-cyan-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    violet: 'bg-violet-500/15 text-violet-300',
    red: 'bg-red-500/15 text-red-300',
  }
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon size={21} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-bg-panel/70 px-2 py-1 font-mono text-[11px] font-bold text-slate-400">{step}</span>
            <h2 className="text-base font-bold text-slate-100">{title}</h2>
            <StatusPill status={status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{subtitle}</span>
            <SourceTag>{source}</SourceTag>
          </div>
        </div>
      </div>
      {action}
    </div>
  )
}

function ProcessPanel({ children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-bg-card/90 panel ${className}`}>
      {children}
    </section>
  )
}

function ProductSelect({ value, onChange, productTypes, placeholder = '- เลือกสินค้า -' }) {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectProduct = (name) => {
    onChange(name)
    setOpen(false)
    setCustomInput('')
  }

  const handleCustomChange = (e) => {
    const next = e.target.value
    setCustomInput(next)
    onChange(next)
  }

  const commitCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed) return
    onChange(trimmed)
    setOpen(false)
    setCustomInput('')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition hover:bg-bg-panel/80 focus:border-sky-500"
      >
        <span className={value ? '' : 'text-slate-500'}>{value || placeholder}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border panel-sub">
          {productTypes.length > 0 && (
            <div className="border-b border-border/50 p-1">
              {productTypes.map((pt) => (
                <button
                  key={pt._id || pt.name}
                  type="button"
                  onClick={() => selectProduct(pt.name)}
                  className={`w-full rounded px-3 py-2 text-left text-sm transition hover:bg-bg-panel/60 ${
                    value === pt.name ? 'bg-sky-500/20 text-sky-200' : 'text-slate-100'
                  }`}
                >
                  {pt.name}
                </button>
              ))}
            </div>
          )}
          <div className="p-2">
            <input
              type="text"
              value={customInput}
              onChange={handleCustomChange}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitCustom() } }}
              placeholder="พิมพ์สินค้าใหม่..."
              className="w-full rounded-lg border border-border bg-bg-panel/60 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Modal({ title, icon: Icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border panel-modal">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-sky-400" />}
            <span className="text-base font-bold text-slate-100">{title}</span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function ReceiptModal({ productTypes, preselectedProduct = '', onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayInputValue(),
    product: preselectedProduct,
    lot: '',
    weight: '',
    operator: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const product = form.product.trim()
    if (!product || !form.weight) return
    setSaving(true)
    try {
      await onSave({
        date: new Date(form.date).toISOString(),
        product,
        lot: form.lot.trim(),
        weight: Number(form.weight),
        operator: form.operator.trim(),
        notes: form.notes.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="รับวัตถุดิบข้าวสาร" icon={PackagePlus} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="วันที่รับ">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} required />
        </Field>
        <Field label="ประเภทสินค้า">
          <ProductSelect value={form.product} onChange={(v) => setForm({ ...form, product: v })} productTypes={productTypes} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lot">
            <input type="text" value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="เช่น L-24001" className={inputClass} />
          </Field>
          <Field label="น้ำหนัก (kg)">
            <input type="number" min="0" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0" className={inputClass} required />
          </Field>
        </div>
        <Field label="ผู้รับ">
          <input type="text" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="ชื่อผู้รับ" className={inputClass} />
        </Field>
        <Field label="หมายเหตุ">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="หมายเหตุเพิ่มเติม" className={inputClass} />
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-700">ยกเลิก</button>
          <button type="submit" disabled={saving} className="flex-[2] rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึกการรับเข้า'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function WithdrawModal({ productTypes, stock, onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayInputValue(),
    product: '',
    weight: '',
    productionOrder: '',
    operator: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedStock = stock.find((s) => s.product === form.product)
  const remaining = selectedStock?.remaining ?? 0

  const submit = async (e) => {
    e.preventDefault()
    const product = form.product.trim()
    if (!product || !form.weight) return
    if (!selectedStock || Number(form.weight) > remaining) {
      setError(`เบิกไม่ได้: คงเหลือ ${formatWeight(remaining)} kg`)
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave({
        date: new Date(form.date).toISOString(),
        product,
        weight: Number(form.weight),
        productionOrder: form.productionOrder.trim(),
        operator: form.operator.trim(),
        notes: form.notes.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="เบิกวัตถุดิบ" icon={PackageMinus} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="วันที่เบิก">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} required />
        </Field>
        <Field label="ประเภทสินค้า (เลือกจากที่มีในสต็อก)">
          <ProductSelect value={form.product} onChange={(v) => setForm({ ...form, product: v })} productTypes={productTypes} />
        </Field>
        {form.product && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
            คงเหลือ: <span className="font-bold">{formatWeight(remaining)} kg</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="ปริมาณเบิก (kg)">
            <input type="number" min="0" step="0.01" max={remaining} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0" className={inputClass} required />
          </Field>
          <Field label="Production Order">
            <input type="text" value={form.productionOrder} onChange={(e) => setForm({ ...form, productionOrder: e.target.value })} placeholder="เช่น PO-1042" className={inputClass} />
          </Field>
        </div>
        <Field label="ผู้เบิก">
          <input type="text" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="ชื่อผู้เบิก" className={inputClass} />
        </Field>
        <Field label="หมายเหตุ">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="หมายเหตุเพิ่มเติม" className={inputClass} />
        </Field>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-700">ยกเลิก</button>
          <button type="submit" disabled={saving} className="flex-[2] rounded-lg bg-linear-to-r from-amber-600 to-orange-600 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'เบิกวัตถุดิบ'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SiloModal({ productTypes, stock, onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayInputValue(),
    product: '',
    expectedWeight: '',
    startTime: '08:00',
    endTime: '17:00',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const product = form.product.trim()
    if (!product) return
    setSaving(true)
    try {
      await onSave({
        date: new Date(form.date).toISOString(),
        product,
        expectedWeight: Number(form.expectedWeight) || 0,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedStock = stock.find((s) => s.product === form.product)

  return (
    <Modal title="ตั้งค่าไซโล" icon={Warehouse} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="วันที่">
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} required />
        </Field>
        <Field label="ประเภทสินค้า (ผลิต)">
          <ProductSelect value={form.product} onChange={(v) => setForm({ ...form, product: v })} productTypes={productTypes} />
        </Field>
        {selectedStock && (
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-center">
            <div>
              <div className="text-[10px] text-slate-500">รับเข้า</div>
              <div className="font-mono text-sm font-bold text-emerald-300">{formatWeight(selectedStock.received)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">เบิกไป</div>
              <div className="font-mono text-sm font-bold text-amber-300">{formatWeight(selectedStock.withdrawn)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">คงเหลือ</div>
              <div className="font-mono text-sm font-bold text-sky-300">{formatWeight(selectedStock.remaining)}</div>
            </div>
          </div>
        )}
        <Field label="ปริมาณที่คาดหวัง (kg)">
          <input type="number" min="0" step="0.01" value={form.expectedWeight} onChange={(e) => setForm({ ...form, expectedWeight: e.target.value })} placeholder="0" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเริ่ม">
            <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputClass} />
          </Field>
          <Field label="เวลาสิ้นสุด">
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="หมายเหตุ">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="หมายเหตุเพิ่มเติม" className={inputClass} />
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-700">ยกเลิก</button>
          <button type="submit" disabled={saving} className="flex-[2] rounded-lg bg-linear-to-r from-violet-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : 'บันทึกไซโล'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DataTable({ columns, rows, onDelete, emptyText = 'ยังไม่มีข้อมูล' }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-border/50 bg-bg-panel/30 px-4 py-8 text-center text-sm text-slate-500">{emptyText}</div>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-panel/40">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 text-[11px] font-medium text-slate-400 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>{col.label}</th>
            ))}
            {onDelete && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row._id || idx} className="border-b border-border/30 transition hover:bg-bg-panel/20">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 text-slate-200 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              {onDelete && (
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => onDelete(row)} className="rounded p-1 text-red-400 transition hover:bg-red-500/20 hover:text-red-300" title="ลบ">
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StockCards({ stock }) {
  if (!stock.length) {
    return <div className="rounded-lg border border-border/50 bg-bg-panel/30 px-4 py-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูลสต็อก</div>
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {stock.map((item) => {
        const remaining = Number(item.remaining) || 0
        const received = Number(item.received) || 0
        const percent = received > 0 ? Math.max(0, Math.min(100, (remaining / received) * 100)) : 0
        return (
          <div key={item.product} className={`rounded-xl border p-4 ${remaining > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-bg-panel/30'}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Boxes size={16} className="shrink-0 text-cyan-300" />
                <span className="truncate text-sm font-bold text-slate-100">{item.product}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${remaining > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {remaining > 0 ? 'พร้อมใช้' : 'หมด'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-500">รับเข้า</div>
                <div className="font-mono text-sm font-bold text-emerald-300">{formatWeight(item.received)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">เบิกไป</div>
                <div className="font-mono text-sm font-bold text-amber-300">{formatWeight(item.withdrawn)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">คงเหลือ</div>
                <div className={`font-mono text-sm font-bold ${remaining > 0 ? 'text-sky-300' : 'text-slate-500'}`}>{formatWeight(item.remaining)}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-bg-panel/70">
              <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SiloStockCards({ stock }) {
  const siloItems = stock
    .map((item) => ({
      ...item,
      silo: Number(item.silo) || 0,
    }))
    .filter((item) => item.silo > 0)
    .sort((a, b) => b.silo - a.silo)

  if (!siloItems.length) {
    return (
      <div className="rounded-lg border border-border/50 bg-bg-panel/30 px-4 py-6 text-center text-sm text-slate-500">
        ยังไม่มีสินค้าคงเหลือในไซโล
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {siloItems.map((item) => {
        return (
          <div key={item.product} className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Warehouse size={16} className="shrink-0 text-violet-300" />
                <span className="truncate text-sm font-bold text-slate-100">{item.product}</span>
              </div>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                ในไซโล
              </span>
            </div>
            <div className="rounded-lg border border-border/50 bg-bg-card/60 px-3 py-3">
              <div className="text-[10px] text-slate-500">คงเหลือในไซโล</div>
              <div className="mt-1 font-mono text-2xl font-bold text-violet-300">{formatWeight(item.silo)}</div>
              <div className="text-[10px] text-slate-500">kg</div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-bg-panel/70">
              <div className="h-1.5 rounded-full bg-violet-400" style={{ width: '100%' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConveyorStatus({ machine }) {
  const status = machineStatus(machine)
  const workingTimeMinutes = getWorkingTimeMinutes(machine)
  const stopTimeMinutes = getStopTimeMinutes(machine)
  return (
    <div className={`rounded-xl border p-4 ${status === 'alarm' ? 'border-red-500/35 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MoveHorizontal size={18} className={status === 'alarm' ? 'text-red-300' : 'text-emerald-300'} />
          <span className="text-sm font-bold text-slate-100">{machine?.name || 'สายลำเลียง'}</span>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile label="สถานะ" value={machine?.status || 'waiting'} icon={Activity} tone={status === 'alarm' ? 'text-red-300' : 'text-emerald-300'} />
        <MetricTile label="OEE" value={`${Math.round(Number(machine?.oee || 0) * 10) / 10}%`} icon={Gauge} tone="text-sky-300" />
        <MetricTile label="Working time" value={`${formatWeight(workingTimeMinutes)} min`} icon={Clock} tone="text-emerald-200" />
        <MetricTile label="Stop time" value={`${formatWeight(stopTimeMinutes)} min`} icon={Clock} tone="text-rose-200" />
        <MetricTile label="Power" value="8.5 kW" icon={Zap} tone="text-amber-300" sub="รอรับค่าจริงจาก Node-RED" />
      </div>
    </div>
  )
}

function ProcessRail({ stages }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card/90 p-3">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Process Map</div>
      <div className="space-y-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className="relative">
            {index > 0 && <div className="absolute -top-2 left-5 h-2 w-px bg-border" />}
            <a href={`#${stage.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel/35 p-2 transition hover:border-sky-500/35">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stage.iconBg}`}>
                <stage.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-200">{stage.short}</div>
                <div className="truncate text-[10px] text-slate-500">{stage.source}</div>
              </div>
              <StatusPill status={stage.status} />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightPanel({ latestReceipt, latestWithdraw, latestSilo, alerts, stock, todayReceipts, todayWithdraws }) {
  const lowStock = stock.filter((item) => (Number(item.remaining) || 0) <= 0)
  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-border bg-bg-card/90 p-4">
        <div className="mb-3 text-sm font-bold text-slate-100">สิ่งที่ต้องดูวันนี้</div>
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-bg-panel/40 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <PackagePlus size={14} className="text-cyan-300" /> รับเข้าล่าสุด
            </div>
            <div className="mt-1 text-xs text-slate-400">{latestReceipt ? `${latestReceipt.product} / ${kg(latestReceipt.weight)} / Lot ${latestReceipt.lot || '-'}` : 'ยังไม่มีการรับเข้า'}</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-panel/40 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <PackageMinus size={14} className="text-amber-300" /> เบิกล่าสุด
            </div>
            <div className="mt-1 text-xs text-slate-400">{latestWithdraw ? `${latestWithdraw.product} / ${kg(latestWithdraw.weight)} / ${latestWithdraw.productionOrder || 'PO -'}` : 'ยังไม่มีการเบิก'}</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-panel/40 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Warehouse size={14} className="text-violet-300" /> ไซโลล่าสุด
            </div>
            <div className="mt-1 text-xs text-slate-400">{latestSilo ? `${latestSilo.product} / ${kg(latestSilo.expectedWeight)} / ${latestSilo.status}` : 'ยังไม่มีแผนไซโล'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-card/90 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-100">Data Health</div>
          <Database size={15} className="text-slate-500" />
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between"><span className="text-slate-400">รับเข้าวันนี้</span><span className="font-mono text-emerald-300">{todayReceipts.length}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">เอาเข้าไซโลวันนี้</span><span className="font-mono text-amber-300">{todayWithdraws.length}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">สินค้า stock หมด</span><span className={lowStock.length ? 'font-mono text-red-300' : 'font-mono text-emerald-300'}>{lowStock.length}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Alert</span><span className={alerts.length ? 'font-mono text-red-300' : 'font-mono text-emerald-300'}>{alerts.length}</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-card/90 p-4">
        <div className="mb-3 text-sm font-bold text-slate-100">ทางลัด</div>
        <div className="grid grid-cols-1 gap-2">
          <Link to="/stock" className="inline-flex items-center justify-between rounded-lg border border-border bg-bg-panel/45 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-500/35 hover:text-sky-200">
            Stock Dashboard <ExternalLink size={13} />
          </Link>
          <Link to="/data/receipts" className="inline-flex items-center justify-between rounded-lg border border-border bg-bg-panel/45 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-500/35 hover:text-sky-200">
            รายการรับเข้าสินค้า <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </aside>
  )
}

function InputStockMachineBoard({ machineRows, processTheme = getProcessTheme(1) }) {
  const onCount = machineRows.filter((machine) => machine.isOn).length
  const groups = [
    { label: 'R1-R10', machines: machineRows.filter((machine) => machine.name.startsWith('R')) },
    { label: 'T1-T10', machines: machineRows.filter((machine) => machine.name.startsWith('T')) },
  ]

  return (
    <section className={`overflow-hidden rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} panel ring-1 ${processTheme.ring}`}>
      <div className={`flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${processTheme.border} ${processTheme.metricMuted}`}>
        <div>
          <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${processTheme.text}`}>
            <Factory size={14} />
            <span>Machine Status</span>
          </div>
          <h2 className="mt-1 text-sm font-bold text-slate-100">Input Stock R / T Machines</h2>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${processTheme.chip}`}>
          ON {onCount}/{machineRows.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
        {groups.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="font-mono text-[11px] font-bold text-slate-500">{group.label}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {group.machines.map((machine) => (
                <div
                  key={machine.name}
                  className={`rounded-lg border px-3 py-2.5 ${
                    machine.isOn
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-slate-700/70 bg-bg-panel/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-base font-black text-slate-100">{machine.name}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${machine.isOn ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.5)]' : 'bg-slate-600'}`} />
                  </div>
                  <div className={`mt-2 font-mono text-xs font-black ${machine.isOn ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {machine.isOn ? 'ON' : 'OFF'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function StockDashboardSections({ todayReceipts, stock, loading, onReceive, processTheme = getProcessTheme(1) }) {
  const getStatus = (item) => (
    (Number(item.remaining) || 0) > 0
      ? { label: 'ปกติ', color: 'bg-emerald-500/15 text-emerald-300' }
      : { label: 'หมด', color: 'bg-rose-500/15 text-rose-300' }
  )

  return (
    <div className="space-y-4">
      <section className={`rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} p-4 panel ring-1 ${processTheme.ring}`}>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-100">รายการรับเข้าสินค้าวันนี้</h2>
        </div>
        <div className={`overflow-x-auto rounded-lg border ${processTheme.border} bg-bg-panel/30`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`text-[11px] font-bold uppercase tracking-wider ${processTheme.tableHead}`}>
                <th className="px-4 py-3">สินค้า</th>
                <th className="px-4 py-3 text-right">ปริมาณรับเข้า(KG)</th>
                <th className="px-4 py-3">วันที่รับเข้า</th>
              </tr>
            </thead>
            <tbody>
              {todayReceipts.length === 0 && (
                <tr className="border-b border-border/40">
                  <td colSpan={3} className="px-4 py-3 text-center text-xs text-slate-500">ไม่มีการรับเข้าวันนี้</td>
                </tr>
              )}
              {todayReceipts.map((receipt) => (
                <tr key={receipt._id || `${receipt.product}-${receipt.date}-${receipt.weight}`} className="border-b border-border/40">
                  <td className="px-4 py-3 font-bold text-slate-100">{receipt.product}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">
                    {formatWeight(receipt.weight)} <span className="text-xs text-slate-500">kg</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatThaiDate(receipt.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`overflow-hidden rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} panel ring-1 ${processTheme.ring}`}>
        <div className={`flex items-center justify-between border-b px-4 py-3 ${processTheme.border} ${processTheme.metricMuted}`}>
          <div>
            <h2 className="text-sm font-bold text-slate-100">รายละเอียดสต็อกแยกตามสินค้า</h2>
            <p className="text-[11px] text-slate-400">อัปเดตอัตโนมัติทุก 30 วินาที</p>
          </div>
        </div>

        {!stock.length && !loading && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูลสต็อก</div>
        )}

        {stock.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={`text-[11px] font-bold uppercase tracking-wider ${processTheme.tableHead}`}>
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3 text-right">สินค้าในสต็อก</th>
                  <th className="px-4 py-3 text-right">คงเหลือในไซโล</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => {
                  const status = getStatus(item)
                  return (
                    <tr key={item.product} className="border-b border-border/40 transition hover:bg-bg-panel/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${processTheme.iconBg} ${processTheme.iconText}`}>
                            <Boxes size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-100">{item.product}</div>
                            <div className="text-[10px] text-slate-500">{item.product}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-sky-300">
                        {formatWeight(item.remaining)} <span className="text-xs text-slate-500">kg</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-amber-300">
                        {formatWeight(item.silo)} <span className="text-xs text-slate-500">kg</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => onReceive(item.product)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${processTheme.chip} hover:bg-white/10`}>
                          รับ
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function Process1() {
  const processTheme = getProcessTheme(1)
  const { dashboard: nodeRedDashboard } = useNodeRedDashboard()
  const [productTypes, setProductTypes] = useState([])
  const [receipts, setReceipts] = useState([])
  const [withdraws, setWithdraws] = useState([])
  const [siloSettings, setSiloSettings] = useState([])
  const [stock, setStock] = useState([])
  const [machines, setMachines] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptProduct, setReceiptProduct] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showSilo, setShowSilo] = useState(false)

  const currentUser = getStoredUser()

  const logAction = useCallback(async (action, detail) => {
    try { await createLog({ type: 'DATA', action, detail }) } catch {}
  }, [])

  const openReceipt = (product = '') => {
    setReceiptProduct(product)
    setShowReceipt(true)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      api.getProductTypes(),
      api.getMaterialReceipts(),
      api.getMaterialWithdraws(),
      api.getSiloSettings(),
      api.getMaterialStock(),
      api.getMachines(),
      api.getAlerts(),
    ])
    const [pt, rc, wd, ss, st, mc, al] = results
    if (pt.status === 'fulfilled') setProductTypes(pt.value.data || [])
    if (rc.status === 'fulfilled') setReceipts(rc.value.data || [])
    if (wd.status === 'fulfilled') setWithdraws(wd.value.data || [])
    if (ss.status === 'fulfilled') setSiloSettings(ss.value.data || [])
    if (st.status === 'fulfilled') setStock(st.value.data || [])
    if (mc.status === 'fulfilled') setMachines(mc.value.data || [])
    if (al.status === 'fulfilled') setAlerts((al.value.data || []).filter((item) => !item.acknowledged))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
    const timer = setInterval(loadAll, 30000)
    return () => clearInterval(timer)
  }, [loadAll])

  const handleSaveReceipt = async (data) => {
    try {
      await api.createMaterialReceipt(data)
      await logAction('รับวัตถุดิบ', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} รับ ${data.product} ${data.weight} kg (Lot: ${data.lot || '-'})`)
      await loadAll()
      setShowReceipt(false)
    } catch (err) {
      console.error('Save receipt failed:', err)
      alert('บันทึกไม่สำเร็จ: ' + err.message)
    }
  }

  const handleSaveWithdraw = async (data) => {
    try {
      await api.createMaterialWithdraw(data)
      await logAction('เบิกวัตถุดิบ', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} เบิก ${data.product} ${data.weight} kg (PO: ${data.productionOrder || '-'})`)
      await loadAll()
      setShowWithdraw(false)
    } catch (err) {
      console.error('Save withdraw failed:', err)
      alert('บันทึกไม่สำเร็จ: ' + err.message)
    }
  }

  const handleSaveSilo = async (data) => {
    try {
      await api.createSiloSetting(data)
      await logAction('ตั้งค่าไซโล', `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} ตั้งค่าไซโล ${data.product} ${data.expectedWeight} kg`)
      await loadAll()
      setShowSilo(false)
    } catch (err) {
      console.error('Save silo failed:', err)
      alert('บันทึกไม่สำเร็จ: ' + err.message)
    }
  }

  const handleDeleteReceipt = async (row) => {
    if (!window.confirm(`ลบรายการรับ ${row.product} ${row.weight} kg?`)) return
    try {
      await api.deleteMaterialReceipt(row._id)
      await loadAll()
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  const handleDeleteWithdraw = async (row) => {
    if (!window.confirm(`ลบรายการเบิก ${row.product} ${row.weight} kg?`)) return
    try {
      await api.deleteMaterialWithdraw(row._id)
      await loadAll()
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  const handleDeleteSilo = async (row) => {
    if (!window.confirm(`ลบการตั้งค่าไซโล ${row.product}?`)) return
    try {
      await api.deleteSiloSetting(row._id)
      await loadAll()
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  const todayKey = todayInputValue()
  const todayReceipts = useMemo(() => receipts.filter((row) => toDateKey(row.date) === todayKey), [receipts, todayKey])
  const todayWithdraws = useMemo(() => withdraws.filter((row) => toDateKey(row.date) === todayKey), [withdraws, todayKey])
  const latestReceipt = useMemo(() => latestByDate(receipts), [receipts])
  const latestWithdraw = useMemo(() => latestByDate(withdraws), [withdraws])
  const stockProductTypes = useMemo(() => stock.map((item) => ({ name: item.product })), [stock])
  const conveyorMachine = useMemo(() => findMachine(machines, ['feeding', 'material', 'inbound']), [machines])
  const inputStockMachineRows = useMemo(
    () => buildInputStockMachineRows(machines, nodeRedDashboard),
    [machines, nodeRedDashboard]
  )
  const inputStockPowerKw = useMemo(
    () => inputStockMachineRows.reduce((total, machine) => total + machine.powerKw, 0),
    [inputStockMachineRows]
  )
  const runningInputStockMachines = inputStockMachineRows.filter((machine) => machine.isOn).length
  const inputStockMachineCount = inputStockMachineRows.length
  const todayReceiptProductCount = countProductTypes(todayReceipts)
  const todayWithdrawProductCount = countProductTypes(todayWithdraws)
  const totalRemaining = stock.reduce((acc, item) => acc + (Number(item.remaining) || 0), 0)
  const totalSilo = stock.reduce((acc, item) => acc + (Number(item.silo) || 0), 0)
  const stockProductCount = countProductTypes(stock)
  const siloProductCount = countProductTypes(stock, (item) => (Number(item.silo) || 0) > 0)
  const activeSilos = siloSettings.filter((item) => ['waiting', 'running'].includes(item.status))

  const receiptStatus = todayReceipts.length ? 'run' : 'wait'
  const stockStatus = totalRemaining > 0 ? 'run' : 'wait'
  const conveyorStatus = machineStatus(conveyorMachine)
  const withdrawStatus = todayWithdraws.length ? 'run' : totalRemaining > 0 ? 'idle' : 'wait'
  const siloStatus = activeSilos.some((item) => item.status === 'running') ? 'run' : activeSilos.length ? 'wait' : totalSilo > 0 ? 'idle' : 'wait'

  const stages = [
    { id: 'receiving', short: 'รับวัตถุดิบ', source: 'Receipts', status: receiptStatus, icon: PackagePlus, iconBg: 'bg-cyan-500/15 text-cyan-300' },
    { id: 'stock', short: 'สต็อกคงเหลือ', source: 'Stock', status: stockStatus, icon: Boxes, iconBg: 'bg-emerald-500/15 text-emerald-300' },
    { id: 'conveyor', short: 'สายลำเลียง', source: 'Machine', status: conveyorStatus, icon: MoveHorizontal, iconBg: 'bg-sky-500/15 text-sky-300' },
    { id: 'withdraw', short: 'เบิกผลิต', source: 'Withdraws', status: withdrawStatus, icon: PackageMinus, iconBg: 'bg-amber-500/15 text-amber-300' },
    { id: 'silo', short: 'ไซโล', source: 'Silo', status: siloStatus, icon: Warehouse, iconBg: 'bg-violet-500/15 text-violet-300' },
  ]

  const receiptColumns = [
    { key: 'date', label: 'วันที่รับ', render: (r) => formatThaiDate(r.date) },
    { key: 'product', label: 'สินค้า' },
    { key: 'lot', label: 'Lot', render: (r) => r.lot || '-' },
    { key: 'weight', label: 'น้ำหนัก (kg)', align: 'right', render: (r) => <span className="font-mono font-bold text-emerald-300">{formatWeight(r.weight)}</span> },
    { key: 'operator', label: 'ผู้รับ', render: (r) => r.operator || '-' },
  ]

  const withdrawColumns = [
    { key: 'date', label: 'วันที่เบิก', render: (r) => formatThaiDate(r.date) },
    { key: 'product', label: 'สินค้า' },
    { key: 'weight', label: 'ปริมาณ (kg)', align: 'right', render: (r) => <span className="font-mono font-bold text-amber-300">{formatWeight(r.weight)}</span> },
    { key: 'productionOrder', label: 'PO', render: (r) => r.productionOrder || '-' },
    { key: 'operator', label: 'ผู้เบิก', render: (r) => r.operator || '-' },
  ]

  const siloColumns = [
    { key: 'date', label: 'วันที่', render: (r) => formatThaiDate(r.date) },
    { key: 'product', label: 'สินค้า' },
    { key: 'expectedWeight', label: 'ปริมาณคาดหวัง (kg)', align: 'right', render: (r) => <span className="font-mono font-bold text-violet-300">{formatWeight(r.expectedWeight)}</span> },
    { key: 'time', label: 'ช่วงเวลา', render: (r) => `${r.startTime || '-'} - ${r.endTime || '-'}` },
    { key: 'status', label: 'สถานะ', render: (r) => {
      const map = { waiting: 'รอคิว', running: 'กำลังทำงาน', done: 'เสร็จ' }
      const colors = { waiting: 'text-sky-300', running: 'text-emerald-300', done: 'text-emerald-200' }
      return <span className={`font-bold ${colors[r.status] || colors.waiting}`}>{map[r.status] || r.status}</span>
    }},
  ]

  return (
    <div className="w-full space-y-4 pb-10">
      <div className={`rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} p-4 panel ring-1 ${processTheme.ring}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Process Flow</span>
              <ArrowRight size={12} />
              <span className={processTheme.text}>Process1</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-text-primary">Process1 — รับและจัดเก็บวัตถุดิบ</h1>
            <p className="mt-1 text-xs text-text-muted">รับเข้า · ตรวจสต็อก · ลำเลียง · เบิกเข้า Production · จัดเก็บไซโล</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={loadAll} disabled={loading} className={`inline-flex items-center gap-2 rounded-lg border bg-bg-panel/70 px-3 py-2 text-xs font-bold text-slate-300 transition disabled:opacity-60 ${processTheme.border} ${processTheme.hover}`}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => openReceipt()} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition hover:scale-[1.02] active:scale-95 ${processTheme.button}`}>
              <Plus size={16} /> รับวัตถุดิบ
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">กำลังโหลดข้อมูล...</div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricTile label="รับเข้าวันนี้" value={kg(sum(todayReceipts))} icon={PackagePlus} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub={`${todayReceipts.length} รายการ / ${todayReceiptProductCount} ชนิด`} />
          <MetricTile label="เอาเข้าไซโลวันนี้" value={kg(sum(todayWithdraws))} icon={PackageMinus} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub={`${todayWithdraws.length} รายการ / ${todayWithdrawProductCount} ชนิด`} />
          <MetricTile label="Stock คงเหลือ" value={kg(totalRemaining)} icon={Scale} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub={`${stockProductCount} ชนิดสินค้า`} />
          <MetricTile label="สต็อคในไซโล" value={kg(totalSilo)} icon={Warehouse} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub={`${siloProductCount} ชนิดสินค้า / ${activeSilos.length} แผน active`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="สายพานที่ทำงานอยู่" value={`${runningInputStockMachines}/${inputStockMachineCount}`} icon={MoveHorizontal} tone={runningInputStockMachines ? processTheme.value : 'text-slate-300'} iconClass={processTheme.iconText} className={processTheme.metric} sub="จำนวนเครื่องที่ทำงานอยู่ใน Process นี้" />
          <MetricTile label="จำนวนเครื่องที่รันอยู่" value={`${runningInputStockMachines} เครื่อง`} icon={Activity} tone={runningInputStockMachines ? processTheme.value : 'text-slate-300'} iconClass={processTheme.iconText} className={processTheme.metric} sub={`${inputStockMachineCount} เครื่องทั้งหมดใน Process นี้`} />
          <MetricTile label="จำนวนสินค้าทั้งหมดในระบบ" value={`${stockProductCount} ชนิด`} icon={Boxes} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub="นับจากรายการสินค้าใน Stock" />
          <MetricTile label="Total Power KW" value={`${formatWeight(inputStockPowerKw)} kW`} icon={Zap} tone={processTheme.value} iconClass={processTheme.iconText} className={processTheme.metric} sub="รวมทุกเครื่องจาก Node-RED" />
        </div>
      </div>

      <InputStockMachineBoard
        machineRows={inputStockMachineRows}
        processTheme={processTheme}
      />

      <StockDashboardSections
        todayReceipts={todayReceipts}
        stock={stock}
        loading={loading}
        onReceive={openReceipt}
        processTheme={processTheme}
      />

      {false && (
        <main className="space-y-4">
          <ProcessPanel className="border-cyan-500/30" id="receiving">
            <StepHeader
              step="1"
              icon={PackagePlus}
              title="รับวัตถุดิบข้าวสาร"
              subtitle="บันทึกรับเข้า แยกตามสินค้าและ Lot พร้อมเป็นข้อมูลต้นทางของ Stock"
              source="Material Receipts"
              status={receiptStatus}
              accent="cyan"
              action={
                <button onClick={() => setShowReceipt(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95">
                  <Plus size={16} /> รับวัตถุดิบ
                </button>
              }
            />
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <MetricTile label="รับเข้าวันนี้" value={kg(sum(todayReceipts))} icon={Scale} tone="text-emerald-300" />
                <MetricTile label="Lot ล่าสุด" value={latestReceipt?.lot || '-'} icon={Database} tone="text-sky-300" sub={latestReceipt?.product || 'ไม่มีข้อมูล'} />
              </div>
              <DataTable columns={receiptColumns} rows={receipts.slice(0, 8)} onDelete={handleDeleteReceipt} emptyText="ยังไม่มีประวัติการรับเข้า" />
            </div>
          </ProcessPanel>

          <ProcessPanel id="stock" className="border-emerald-500/25">
            <StepHeader
              step="2"
              icon={Boxes}
              title="สต็อกคงเหลือและจัดเก็บวัตถุดิบ"
              subtitle="ข้อมูลสะสมจากรับเข้าและเบิกออก ไม่ต้องกรอกซ้ำในหน้า Process"
              source="Stock Summary"
              status={stockStatus}
              accent="emerald"
              action={
                <Link to="/stock" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-panel/60 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-sky-500/35 hover:text-sky-200">
                  ไป Stock <ExternalLink size={13} />
                </Link>
              }
            />
            <div className="p-4">
              <StockCards stock={stock} />
            </div>
          </ProcessPanel>

          <ProcessPanel id="conveyor" className="border-sky-500/25">
            <StepHeader
              step="3"
              icon={MoveHorizontal}
              title="สถานะสายลำเลียง"
              subtitle="จุดนี้ควรรับค่าจาก PLC / Node-RED เช่น Run/Stop, Power, Runtime"
              source="Machine API"
              status={conveyorStatus}
              accent="cyan"
            />
            <div className="p-4">
              <ConveyorStatus machine={conveyorMachine} />
            </div>
          </ProcessPanel>

          <ProcessPanel id="withdraw" className="border-amber-500/30">
            <StepHeader
              step="4"
              icon={PackageMinus}
              title="เบิกวัตถุดิบเข้า Production"
              subtitle="ดึงจากระบบ Stock Dashboard และตรวจคงเหลือก่อนเบิก"
              source="Material Withdraws"
              status={withdrawStatus}
              accent="amber"
              action={
                <button onClick={() => setShowWithdraw(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95">
                  <Plus size={16} /> เบิกวัตถุดิบ
                </button>
              }
            />
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <MetricTile label="เอาเข้าไซโลวันนี้" value={kg(sum(todayWithdraws))} icon={PackageMinus} tone="text-amber-300" />
                <MetricTile label="PO ล่าสุด" value={latestWithdraw?.productionOrder || '-'} icon={Factory} tone="text-violet-300" sub={latestWithdraw?.product || 'ไม่มีข้อมูล'} />
                <MetricTile label="FIFO Check" value={latestWithdraw ? 'ผ่าน' : 'รอเบิก'} icon={CheckCircle2} tone={latestWithdraw ? 'text-emerald-300' : 'text-slate-400'} />
              </div>
              <DataTable columns={withdrawColumns} rows={withdraws.slice(0, 8)} onDelete={handleDeleteWithdraw} emptyText="ยังไม่มีประวัติการเบิก" />
            </div>
          </ProcessPanel>

          <ProcessPanel id="silo" className="border-violet-500/30">
            <StepHeader
              step="5"
              icon={Warehouse}
              title="จัดเก็บข้าวสารในไซโล"
              subtitle="กำหนดสินค้า ปริมาณคาดหวัง ช่วงเวลา และใช้ดูการไหลต่อไปยังการผลิต"
              source="Silo Settings"
              status={siloStatus}
              accent="violet"
              action={
                <button onClick={() => setShowSilo(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95">
                  <Plus size={16} /> ตั้งค่าไซโล
                </button>
              }
            />
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <MetricTile label="สต็อคในไซโล" value={kg(totalSilo)} icon={Warehouse} tone="text-violet-300" sub={`${siloProductCount} สินค้า`} />
                <MetricTile label="แผน Active" value={`${activeSilos.length}`} icon={CalendarClock} tone="text-sky-300" />
                <MetricTile label="Sensor" value="รอ Temp/Humidity" icon={Gauge} tone="text-amber-300" sub="เตรียมรับค่าจากภายนอก" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">คงเหลือในไซโลแยกตามสินค้า</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">ดึงจาก Stock Summary: แสดงว่าสินค้าใดอยู่ในไซโลเท่าไร</p>
                  </div>
                  <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-mono text-xs font-bold text-violet-300">
                    {kg(totalSilo)}
                  </span>
                </div>
                <SiloStockCards stock={stock} />
              </div>
              <DataTable columns={siloColumns} rows={siloSettings.slice(0, 8)} onDelete={handleDeleteSilo} emptyText="ยังไม่มีแผนไซโล" />
            </div>
          </ProcessPanel>
        </main>
      )}

      {showReceipt && (
        <ReceiptModal
          productTypes={productTypes}
          preselectedProduct={receiptProduct}
          onClose={() => { setShowReceipt(false); setReceiptProduct('') }}
          onSave={handleSaveReceipt}
        />
      )}
      {showWithdraw && <WithdrawModal productTypes={stockProductTypes} stock={stock} onClose={() => setShowWithdraw(false)} onSave={handleSaveWithdraw} />}
      {showSilo && <SiloModal productTypes={stockProductTypes.length ? stockProductTypes : productTypes} stock={stock} onClose={() => setShowSilo(false)} onSave={handleSaveSilo} />}
    </div>
  )
}
