import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Download, FileText, Package, RefreshCw, Search, Scale, UserRound } from 'lucide-react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { api } from '../services/api.js'

function todayInputValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateKey(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateThai(dateKey) {
  if (!dateKey) return '-'
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeThai(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function formatWeight(value) {
  return (Number(value) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function buildProductSummary(rows) {
  const map = new Map()
  rows.forEach((row) => {
    const product = row.product || 'ไม่ระบุสินค้า'
    const current = map.get(product) || { product, count: 0, totalWeight: 0, lots: new Set(), operators: new Set() }
    current.count += 1
    current.totalWeight += row.weight
    if (row.lot) current.lots.add(row.lot)
    if (row.operator) current.operators.add(row.operator)
    map.set(product, current)
  })
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      lots: Array.from(item.lots),
      operators: Array.from(item.operators),
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight || a.product.localeCompare(b.product, 'th'))
}

export default function DataReceipts() {
  const [receipts, setReceipts] = useState([])
  const [selectedDate, setSelectedDate] = useState(todayInputValue())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)

  const loadReceipts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMaterialReceipts()
      setReceipts(res.data || [])
    } catch (err) {
      setError(err.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReceipts()
  }, [])

  const normalizedReceipts = useMemo(() => {
    return receipts
      .map((row, index) => ({
        ...row,
        key: row._id || `${row.product || 'product'}-${row.date || index}-${index}`,
        dateKey: toDateKey(row.date),
        weight: Number(row.weight) || 0,
      }))
      .filter((row) => row.dateKey)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [receipts])

  const dailySummaries = useMemo(() => {
    const map = new Map()
    normalizedReceipts.forEach((row) => {
      const current = map.get(row.dateKey) || { dateKey: row.dateKey, count: 0, totalWeight: 0, products: new Set() }
      current.count += 1
      current.totalWeight += row.weight
      current.products.add(row.product || 'ไม่ระบุสินค้า')
      map.set(row.dateKey, current)
    })
    return Array.from(map.values())
      .map((item) => ({ ...item, products: Array.from(item.products).sort((a, b) => a.localeCompare(b, 'th')) }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [normalizedReceipts])

  const selectedReceipts = useMemo(() => {
    return normalizedReceipts
      .filter((row) => row.dateKey === selectedDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [normalizedReceipts, selectedDate])

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return selectedReceipts
    return selectedReceipts.filter((row) => {
      return [row.product, row.lot, row.operator, row.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [selectedReceipts, search])

  const productSummary = useMemo(() => buildProductSummary(selectedReceipts), [selectedReceipts])
  const visibleProductSummary = useMemo(() => buildProductSummary(visibleReceipts), [visibleReceipts])
  const totalWeight = selectedReceipts.reduce((sum, row) => sum + row.weight, 0)
  const visibleWeight = visibleReceipts.reduce((sum, row) => sum + row.weight, 0)
  const selectedDaySummary = dailySummaries.find((day) => day.dateKey === selectedDate)

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey)
    setSearch('')
  }

  const handleExportPDF = async () => {
    if (!selectedReceipts.length) {
      alert('ไม่มีข้อมูลสำหรับ Export PDF')
      return
    }

    setExporting(true)
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }
      pdf.save(`material_receipts_${selectedDate}.pdf`)
    } catch (err) {
      console.error('Export material receipts PDF failed:', err)
      alert('สร้าง PDF ไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <style>
        {`
          input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
          }
        `}
      </style>

      <div className="flex flex-col gap-4 rounded-xl border border-border panel-sub p-5 shadow-xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Package size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">รายการรับเข้าสินค้า</h1>
              <p className="mt-1 text-sm text-slate-400">เลือกวันที่เพื่อดูว่าวันนั้นรับเข้าสินค้าอะไรบ้าง</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={exporting || !selectedReceipts.length}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={17} />
          {exporting ? 'กำลังสร้าง PDF...' : 'Export PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border panel-sub p-4 shadow-xl lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">เลือกวันที่รับเข้า</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleSelectDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-card/80 px-3 py-2.5 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400">ค้นหาในวันที่เลือก</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาสินค้า, Lot, ผู้รับ หรือหมายเหตุ"
              className="w-full rounded-lg border border-border bg-bg-card/80 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={loadReceipts}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-card/70 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-sky-500/40 hover:text-sky-200 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <CalendarDays size={14} /> วันที่เลือก
          </div>
          <div className="text-lg font-bold text-slate-100">{formatDateThai(selectedDate)}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <FileText size={14} /> จำนวนรายการ
          </div>
          <div className="font-mono text-2xl font-bold text-sky-300">{selectedReceipts.length}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <Package size={14} /> ชนิดสินค้า
          </div>
          <div className="font-mono text-2xl font-bold text-cyan-300">{productSummary.length}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <Scale size={14} /> น้ำหนักรวม
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-300">{formatWeight(totalWeight)} <span className="text-sm text-slate-500">kg</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-border panel-sub">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-slate-100">รายการรับเข้าตามวัน</h2>
            <p className="mt-1 text-xs text-slate-400">เลือกวันจากรายการด้านล่างเพื่อดูรายละเอียด</p>
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="rounded-lg border border-border bg-bg-card/50 p-4 text-center text-sm text-slate-400">กำลังโหลดข้อมูล...</div>
            ) : dailySummaries.length === 0 ? (
              <div className="rounded-lg border border-border bg-bg-card/50 p-4 text-center text-sm text-slate-400">ยังไม่มีรายการรับเข้า</div>
            ) : (
              dailySummaries.map((day) => (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => handleSelectDate(day.dateKey)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedDate === day.dateKey
                      ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
                      : 'border-border bg-bg-card/45 text-slate-300 hover:border-sky-500/30 hover:bg-bg-card/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">{formatDateThai(day.dateKey)}</div>
                    <div className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] text-cyan-300">{day.count}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{day.products.slice(0, 3).join(', ') || '-'}</div>
                  <div className="mt-2 font-mono text-xs font-bold text-emerald-300">{formatWeight(day.totalWeight)} kg</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-5">
          <div className="rounded-xl border border-border panel-sub">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-100">สินค้าที่รับเข้าในวันที่ {formatDateThai(selectedDate)}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedDaySummary ? `${selectedDaySummary.products.length} ชนิดสินค้า / ${selectedDaySummary.count} รายการ` : 'ไม่พบข้อมูลในวันที่เลือก'}
                </p>
              </div>
              {search && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200">
                  ผลค้นหา {visibleReceipts.length} รายการ / {formatWeight(visibleWeight)} kg
                </div>
              )}
            </div>

            {selectedReceipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <Package className="mb-3 h-10 w-10 text-slate-500" />
                <div className="text-base font-bold text-slate-300">ไม่มีรายการรับเข้าในวันนี้</div>
                <div className="mt-1 text-sm text-slate-500">เลือกวันที่อื่นจากรายการด้านซ้าย หรือเลือกจากช่องวันที่ด้านบน</div>
              </div>
            ) : visibleProductSummary.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleProductSummary.map((item) => (
                  <div key={item.product} className="rounded-lg border border-border bg-bg-card/45 p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-100">{item.product}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.count} รายการ</div>
                      </div>
                      <Package size={18} className="shrink-0 text-cyan-300" />
                    </div>
                    <div className="font-mono text-xl font-bold text-emerald-300">{formatWeight(item.totalWeight)} <span className="text-sm text-slate-500">kg</span></div>
                    <div className="mt-3 truncate text-xs text-slate-400">Lot: {item.lots.length ? item.lots.join(', ') : '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border panel-sub">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-slate-100">รายละเอียดรายการรับเข้า</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-card/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">เวลา</th>
                    <th className="px-4 py-3">สินค้า</th>
                    <th className="px-4 py-3">Lot</th>
                    <th className="px-4 py-3 text-right">น้ำหนัก (kg)</th>
                    <th className="px-4 py-3">ผู้รับ</th>
                    <th className="px-4 py-3">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">ไม่มีข้อมูลที่จะแสดง</td>
                    </tr>
                  ) : (
                    visibleReceipts.map((row) => (
                      <tr key={row.key} className="border-b border-border/40 transition hover:bg-bg-card/30">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{formatTimeThai(row.date)}</td>
                        <td className="px-4 py-3 font-bold text-slate-100">{row.product || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.lot || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-300">{formatWeight(row.weight)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.operator || '-'}</td>
                        <td className="max-w-[260px] px-4 py-3 text-slate-400">
                          <div className="truncate">{row.notes || '-'}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <div
        ref={reportRef}
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '794px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'Tahoma, Arial, sans-serif',
          padding: '34px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ borderBottom: '3px solid #0ea5e9', paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>รายงานรายการรับเข้าสินค้า</div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#475569' }}>วันที่รับเข้า: {formatDateThai(selectedDate)}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
              <div>Generated: {new Date().toLocaleString('th-TH')}</div>
              <div>File: material_receipts_{selectedDate}.pdf</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>จำนวนรายการ</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{selectedReceipts.length}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>ชนิดสินค้า</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{productSummary.length}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>น้ำหนักรวม</div>
            <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700 }}>{formatWeight(totalWeight)} kg</div>
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 8, fontSize: 17, fontWeight: 700 }}>สรุปตามสินค้า</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#e0f2fe' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'left' }}>สินค้า</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'right' }}>จำนวนรายการ</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'right' }}>น้ำหนักรวม (kg)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'left' }}>Lot</th>
              </tr>
            </thead>
            <tbody>
              {productSummary.map((item) => (
                <tr key={item.product}>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>{item.product}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'right' }}>{item.count}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'right' }}>{formatWeight(item.totalWeight)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 8 }}>{item.lots.length ? item.lots.join(', ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontSize: 17, fontWeight: 700 }}>รายละเอียดรายการรับเข้า</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'left' }}>เวลา</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'left' }}>สินค้า</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'left' }}>Lot</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'right' }}>น้ำหนัก (kg)</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'left' }}>ผู้รับ</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'left' }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {selectedReceipts.map((row) => (
                <tr key={row.key}>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7 }}>{formatTimeThai(row.date)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7 }}>{row.product || '-'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7 }}>{row.lot || '-'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7, textAlign: 'right' }}>{formatWeight(row.weight)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7 }}>{row.operator || '-'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: 7 }}>{row.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
