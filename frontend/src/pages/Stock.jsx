import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api.js'
import { Boxes, ArrowUp, ArrowDown, Plus, X, Package, ChevronDown, Trash2 } from 'lucide-react'
import { getStoredUser } from '../services/authApi.js'
import { createLog } from '../services/logApi.js'

function todayInputValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const thaiMonths = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

function formatThaiDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`
}

function ProductSelect({ value, onChange, productTypes, placeholder = '- เลือกสินค้า -' }) {
  const [open, setOpen] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
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
        className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 hover:bg-bg-panel/80 transition"
      >
        <span className={value ? '' : 'text-slate-500'}>{value || placeholder}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border panel-sub">
          {productTypes.length > 0 && (
            <div className="border-b border-border/50 p-1">
              {productTypes.map((pt) => (
                <button
                  key={pt._id || pt.name}
                  type="button"
                  onClick={() => selectProduct(pt.name)}
                  className={`w-full px-3 py-2 text-left text-sm rounded transition hover:bg-bg-panel/60 ${
                    value === pt.name ? 'bg-sky-500/20 text-sky-200' : 'text-slate-100'
                  }`}
                >
                  {pt.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 p-2">
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

function ReceiptModal({ productTypes, preselectedProduct, onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayInputValue(),
    product: preselectedProduct || '',
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
        lot: form.lot,
        weight: Number(form.weight) || 0,
        operator: form.operator,
        notes: form.notes,
      })
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-border bg-bg-panel/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-bg-card p-5 panel-modal">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Package size={18} />
            </div>
            <h3 className="text-base font-bold text-slate-100">รับวัตถุดิบข้าวสาร</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-bg-panel/50 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">วันที่รับ</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} required />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">ประเภทสินค้า</label>
            <ProductSelect
              value={form.product}
              onChange={(name) => setForm({ ...form, product: name })}
              productTypes={productTypes}
              placeholder="- เลือกสินค้า -"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Lot</label>
              <input type="text" value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="เช่น L-24001" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">น้ำหนัก (kg)</label>
              <input type="number" min={0} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0" className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">ผู้รับ</label>
            <input type="text" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="ชื่อผู้รับ" className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">หมายเหตุ</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="หมายเหตุเพิ่มเติม" rows={2} className={`${inputClass} resize-none`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border bg-bg-panel/40 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-bg-panel/60">ยกเลิก</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-60">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Stock({ title = 'Stock Dashboard', subtitle = 'สรุปสต็อกวัตถุดิบ รับเข้า เบิกไป และคงเหลือ' }) {
  const [stock, setStock] = useState([])
  const [siloSettings, setSiloSettings] = useState([])
  const [receipts, setReceipts] = useState([])
  const [productTypes, setProductTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptProduct, setReceiptProduct] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const currentUser = getStoredUser()
  const isAdmin = currentUser?.role === 'ADMIN'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [st, ss, rc, pt] = await Promise.all([
        api.getMaterialStock(),
        api.getSiloSettings(),
        api.getMaterialReceipts(),
        api.getProductTypes(),
      ])
      setStock(st.data || [])
      setSiloSettings(ss.data || [])
      setReceipts(rc.data || [])
      setProductTypes(pt.data || [])
    } catch (err) {
      console.error('Load stock failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const openReceipt = (product = '') => {
    setReceiptProduct(product)
    setShowReceipt(true)
  }

  const handleSaveReceipt = async (data) => {
    try {
      await api.createMaterialReceipt(data)
      try {
        await createLog({ type: 'DATA', action: 'รับวัตถุดิบ', detail: `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} รับ ${data.product} ${data.weight} kg (Lot: ${data.lot || '-'})` })
      } catch {}
      await loadData()
      setShowReceipt(false)
      setReceiptProduct('')
    } catch (err) {
      console.error('Save receipt failed:', err)
      alert('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    }
  }

  const handleClearData = async () => {
    if (!isAdmin) return
    setClearing(true)
    try {
      await api.clearStockData()
      try {
        await createLog({ type: 'DATA', action: 'ล้างข้อมูล Stock', detail: `ผู้ใช้ ${currentUser?.name || currentUser?.un || 'unknown'} ล้างข้อมูล stock ทั้งหมด` })
      } catch {}
      await loadData()
      setShowClearConfirm(false)
      alert('ล้างข้อมูลเรียบร้อย')
    } catch (err) {
      console.error('Clear stock data failed:', err)
      alert('ล้างข้อมูลไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    } finally {
      setClearing(false)
    }
  }

  const totalWithdrawn = stock.reduce((sum, s) => sum + (s.withdrawn || 0), 0)
  const totalRemaining = stock.reduce((sum, s) => sum + (s.remaining || 0), 0)

  const todayDate = todayInputValue()
  const todayReceipts = receipts.filter((r) => {
    if (!r.date) return false
    const d = new Date(r.date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayDate
  })

  const tableRow = (s) => {
    const siloRemaining = s.silo || 0
    const status = (s.remaining || 0) > 0 ? { label: 'ปกติ', color: 'bg-emerald-500/15 text-emerald-300' } : { label: 'หมด', color: 'bg-rose-500/15 text-rose-300' }

    return (
      <tr key={s.product} className="border-b border-border/40 hover:bg-bg-panel/30 transition">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
              <Boxes size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">{s.product}</div>
              <div className="text-[10px] text-slate-500">{s.product}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-sky-300">{s.remaining || 0} <span className="text-xs text-slate-500">kg</span></td>
        <td className="px-4 py-3 text-right font-mono text-sm text-amber-300">{siloRemaining} <span className="text-xs text-slate-500">kg</span></td>
        <td className="px-4 py-3">
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${status.color}`}>{status.label}</span>
        </td>
        <td className="px-4 py-3">
          <button onClick={() => openReceipt(s.product)} className="rounded-lg bg-sky-600/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-600/25 transition">รับ</button>
        </td>
      </tr>
    )
  }

  return (
    <div className="w-full space-y-4 pb-10">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowClearConfirm(true)} className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-300 shadow-lg hover:bg-rose-500/20 active:scale-95 transition-all">
              <Trash2 size={16} /> ล้างข้อมูล
            </button>
          )}
          <button onClick={() => openReceipt()} className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
            <Plus size={16} /> รับวัตถุดิบ
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">กำลังโหลดข้อมูล...</div>
      )}

      <div className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-100">รายการรับเข้าสินค้าวันนี้</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/50 bg-bg-panel/30">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-bg-panel/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">สินค้า</th>
                <th className="px-4 py-3 text-right">ปริมาณรับเข้า(kg)</th>
                <th className="px-4 py-3">วันที่รับเข้า</th>
              </tr>
            </thead>
            <tbody>
              {todayReceipts.length === 0 && (
                <tr className="border-b border-border/40">
                  <td colSpan={3} className="px-4 py-3 text-center text-xs text-slate-500">ไม่มีการรับเข้าวันนี้</td>
                </tr>
              )}
              {todayReceipts.map((r) => (
                <tr key={r._id} className="border-b border-border/40">
                  <td className="px-4 py-3 font-bold text-slate-100">{r.product}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{r.weight || 0} <span className="text-xs text-slate-500">kg</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatThaiDate(r.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-bg-card/90 panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
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
                <tr className="bg-bg-panel/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3 text-right">สินค้าในสต็อค</th>
                  <th className="px-4 py-3 text-right">คงเหลือในไซโล</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">จัดการ</th>
                </tr>
              </thead>
              <tbody>{stock.map(tableRow)}</tbody>
            </table>
          </div>
        )}
      </div>

      {showReceipt && (
        <ReceiptModal
          productTypes={productTypes}
          preselectedProduct={receiptProduct}
          onClose={() => { setShowReceipt(false); setReceiptProduct('') }}
          onSave={handleSaveReceipt}
        />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-bg-card p-5 panel-modal">
            <div className="mb-4 text-center">
              <div className="mb-2 text-3xl">⚠️</div>
              <h3 className="text-base font-bold text-slate-100">ยืนยันการล้างข้อมูล</h3>
              <p className="mt-2 text-xs text-slate-400">ล้างข้อมูลรับเข้า เบิกออก ไซโล และสินค้าทั้งหมด ไม่สามารถกู้คืนได้</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 rounded-lg border border-border bg-bg-panel/40 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-bg-panel/60">ยกเลิก</button>
              <button onClick={handleClearData} disabled={clearing} className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-rose-500 active:scale-95 disabled:opacity-60">{clearing ? 'กำลังล้าง...' : 'ยืนยันล้าง'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
