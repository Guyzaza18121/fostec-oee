import { useState, useEffect, useRef, useMemo } from 'react'
import PropTypes from 'prop-types'

const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

function formatHourLabel(hour) {
  const h = hour % 12 || 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h} ${suffix}`
}

export default function ProductionEntryModal({ slot, entry = null, products = [], stockData = [], onClose, onSave, onDelete }) {
  const isEdit = Boolean(entry)

  const initialStartHour = isEdit ? Math.floor(entry.startMinutes / 60) : slot?.hour ?? 0
  const initialEndHour = isEdit ? Math.floor(entry.endMinutes / 60) : (slot?.hour ?? 0) + 1

  const initialDay = isEdit ? new Date(entry.day) : (slot?.day ? new Date(slot.day) : new Date())
  initialDay.setHours(0, 0, 0, 0)

  const [selectedDate, setSelectedDate] = useState(initialDay)
  const dateInputRef = useRef(null)
  const [form, setForm] = useState({
    product: '',
    inputWeight: '',
    outputWeight: '',
    standardWeight: '',
    cleaningHours: '00',
    cleaningMinutes: '00',
    startHour: initialStartHour.toString().padStart(2, '0'),
    endHour: initialEndHour.toString().padStart(2, '0'),
  })

  useEffect(() => {
    if (isEdit) {
      const day = new Date(entry.day)
      day.setHours(0, 0, 0, 0)
      setSelectedDate(day)
      setForm({
        product: entry.name || '',
        inputWeight: entry.data?.inputWeight || '',
        outputWeight: entry.data?.outputWeight || '',
        standardWeight: entry.data?.standardWeight || '',
        cleaningHours: entry.data?.cleaningHours || '00',
        cleaningMinutes: entry.data?.cleaningMinutes || '00',
        startHour: Math.floor(entry.startMinutes / 60).toString().padStart(2, '0'),
        endHour: Math.floor(entry.endMinutes / 60).toString().padStart(2, '0'),
      })
    } else if (slot) {
      const day = new Date(slot.day)
      day.setHours(0, 0, 0, 0)
      setSelectedDate(day)
      const start = slot.hour
      const end = slot.hour + 1
      setForm((prev) => ({
        ...prev,
        product: products[0] || '',
        cleaningHours: '00',
        cleaningMinutes: '00',
        startHour: start.toString().padStart(2, '0'),
        endHour: end.toString().padStart(2, '0'),
      }))
    }
  }, [isEdit, entry, slot, products])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const availableStock = useMemo(() => {
    const item = stockData.find((s) => s.product === form.product)
    return item ? item.remaining || 0 : 0
  }, [stockData, form.product])

  const currentSilo = useMemo(() => {
    const item = stockData.find((s) => s.product === form.product)
    return item ? item.silo || 0 : 0
  }, [stockData, form.product])

  const insufficientStock = Number(form.inputWeight) > 0 && Number(form.inputWeight) > availableStock

  const projectedSilo = currentSilo + (Number(form.inputWeight) || 0) - (Number(form.outputWeight) || 0)
  const insufficientSilo = Number(form.outputWeight) > 0 && projectedSilo < 0

  const handleSubmit = (e) => {
    e.preventDefault()
    if (insufficientStock) {
      alert('สินค้าในสต็อคไม่เพียงพอต่อการเอาเข้าไซโล')
      return
    }
    if (insufficientSilo) {
      alert('คงเหลือในไซโลไม่พอต่อการผลิต')
      return
    }
    onSave({ ...form, day: selectedDate })
  }

  const startHourNum = Number(form.startHour)
  const endHourNum = Number(form.endHour)
  const timeLabel = selectedDate
    ? `${thaiDays[selectedDate.getDay()]} ${selectedDate.getDate()} ${thaiMonths[selectedDate.getMonth()]} ${selectedDate.getFullYear() + 543} • ${formatHourLabel(startHourNum)} - ${formatHourLabel(endHourNum)}`
    : ''

  const dateInputValue = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  const displayDate = `${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`

  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border panel-modal">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <span className="text-base font-bold text-slate-100">
              {isEdit ? 'แก้ไขข้อมูลการผลิต' : 'กรอกข้อมูลการผลิต'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto p-5 space-y-4 text-sm">
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
            ช่วงเวลา: {timeLabel}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">วันที่</label>
            <div className="relative">
              <input
                ref={dateInputRef}
                type="date"
                value={dateInputValue}
                onChange={(e) => {
                  const value = e.target.value
                  if (value) {
                    const [y, m, d] = value.split('-').map(Number)
                    const next = new Date(y, m - 1, d)
                    next.setHours(0, 0, 0, 0)
                    setSelectedDate(next)
                  }
                }}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 hover:bg-bg-panel/80 transition"
              >
                <span>{displayDate}</span>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">เริ่มต้น</label>
              <select
                value={form.startHour}
                onChange={(e) => updateField('startHour', e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{formatHourLabel(Number(h))}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">สิ้นสุด</label>
              <select
                value={form.endHour}
                onChange={(e) => updateField('endHour', e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{formatHourLabel(Number(h))}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">สินค้า</label>
            <select
              value={form.product}
              onChange={(e) => updateField('product', e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
              required
            >
              <option value="">- เลือกสินค้า -</option>
              {products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">ปริมาณเบิกเข้าไซโล (Kg)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.inputWeight}
                onChange={(e) => updateField('inputWeight', e.target.value)}
                placeholder="0"
                className={`w-full rounded-lg border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 ${
                  insufficientStock ? 'border-rose-500 focus:border-rose-500' : 'border-border focus:border-sky-500'
                }`}
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500">คงเหลือในสต็อค: <span className="font-mono font-bold text-sky-300">{availableStock} kg</span></span>
                {insufficientStock && (
                  <span className="text-rose-300">สินค้าในสต็อคไม่เพียงพอต่อการเอาเข้าไซโล</span>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">ปริมาณผลิตสินค้า (เบิกออกไซโล) (Kg)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.outputWeight}
                onChange={(e) => updateField('outputWeight', e.target.value)}
                placeholder="0"
                className={`w-full rounded-lg border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 ${
                  insufficientSilo ? 'border-rose-500 focus:border-rose-500' : 'border-border focus:border-sky-500'
                }`}
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500">คงเหลือในไซโล: <span className="font-mono font-bold text-amber-300">{currentSilo} kg</span></span>
                {insufficientSilo && (
                  <span className="text-rose-300">คงเหลือในไซโลไม่พอต่อการผลิต</span>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">น้ำหนักมาตรฐานที่ควรได้</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.standardWeight}
                onChange={(e) => updateField('standardWeight', e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">CLEANING TIME</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] text-slate-500">ชั่วโมง</label>
                <select
                  value={form.cleaningHours}
                  onChange={(e) => updateField('cleaningHours', e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-slate-500">นาที</label>
                <select
                  value={form.cleaningMinutes}
                  onChange={(e) => updateField('cleaningMinutes', e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  {['00', '15', '30', '45'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-slate-800 py-3 text-sm font-bold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`ต้องการลบ "${entry.name}" ใช่ไหม?`)) onDelete(entry)
                }}
                className="rounded-lg bg-rose-600/80 px-4 py-3 text-sm font-bold text-white hover:bg-rose-500 transition-colors"
              >
                ลบ
              </button>
            )}
            <button
              type="submit"
              className="flex-2 rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

ProductionEntryModal.propTypes = {
  slot: PropTypes.shape({
    day: PropTypes.instanceOf(Date).isRequired,
    hour: PropTypes.number.isRequired,
  }),
  entry: PropTypes.shape({
    id: PropTypes.string,
    day: PropTypes.instanceOf(Date),
    startMinutes: PropTypes.number,
    endMinutes: PropTypes.number,
    name: PropTypes.string,
    data: PropTypes.object,
  }),
  products: PropTypes.arrayOf(PropTypes.string),
  stockData: PropTypes.arrayOf(PropTypes.shape({
    product: PropTypes.string,
    received: PropTypes.number,
    withdrawn: PropTypes.number,
    remaining: PropTypes.number,
  })),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
}
