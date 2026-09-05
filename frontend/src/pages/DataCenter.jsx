import { useState, useEffect } from 'react'
import { useNavigate } from '../router.jsx'
import { Download, Search } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api } from '../services/api.js'

// Shared data
const statusConfig = {
  running: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  breakdown: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  idle: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  stopped: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' }
}

const dailyData = [
  { machine: 'Inbound & Storage', line: 'A', oee: 78.1, avail: 99, perf: 79, qual: 100, good: 750, total: 751, status: 'stopped' },
  { machine: 'Feeding / Material Handling', line: 'A', oee: 64.9, avail: 86, perf: 76, qual: 100, good: 623, total: 625, status: 'stopped' },
  { machine: 'Sorting & Cleaning', line: 'B', oee: 39.2, avail: 52, perf: 81, qual: 93, good: 377, total: 405, status: 'stopped' },
  { machine: 'Packaging', line: 'B', oee: 81.1, avail: 99, perf: 82, qual: 100, good: 778, total: 779, status: 'stopped' },
  { machine: 'QC & Dispatch', line: 'C', oee: 60.2, avail: 93, perf: 65, qual: 100, good: 578, total: 579, status: 'stopped' }
]

const monthlyData = [
  { month: 'ม.ค.', machine: 'Inbound & Storage', line: 'A', oee: 82.3, avail: 95, perf: 88, qual: 99, good: 1200, total: 1210 },
  { month: 'ก.พ.', machine: 'Feeding / Material Handling', line: 'A', oee: 75.5, avail: 90, perf: 85, qual: 99, good: 1100, total: 1110 },
  { month: 'มี.ค.', machine: 'Sorting & Cleaning', line: 'B', oee: 68.1, avail: 85, perf: 82, qual: 97, good: 950, total: 980 },
  { month: 'เม.ย.', machine: 'Packaging', line: 'B', oee: 85.4, avail: 96, perf: 90, qual: 99, good: 1300, total: 1310 },
  { month: 'พ.ค.', machine: 'QC & Dispatch', line: 'C', oee: 72.8, avail: 88, perf: 84, qual: 98, good: 1050, total: 1070 }
]

const yearlyData = [
  { year: '2567', machine: 'Inbound & Storage', line: 'A', oee: 80.1, avail: 94, perf: 86, qual: 99, good: 14500, total: 14650 },
  { year: '2568', machine: 'Feeding / Material Handling', line: 'A', oee: 76.3, avail: 89, perf: 83, qual: 99, good: 13200, total: 13350 },
  { year: '2569', machine: 'Sorting & Cleaning', line: 'B', oee: 65.2, avail: 82, perf: 80, qual: 96, good: 11000, total: 11500 }
]

const hourlyData = [
  { hour: '0:00', values: [65, 65, 65, 65, 65] },
  { hour: '1:00', values: [95, 95, 95, 95, 95] },
  { hour: '2:00', values: [80, 80, 80, 80, 80] },
  { hour: '3:00', values: [95, 95, 95, 95, 95] },
  { hour: '4:00', values: [95, 95, 95, 95, 95] },
  { hour: '5:00', values: [95, 95, 95, 95, 95] },
  { hour: '6:00', values: [87, 87, 87, 87, 87] },
  { hour: '7:00', values: [95, 95, 95, 95, 95] },
  { hour: '8:00', values: [95, 95, 95, 95, 95] },
  { hour: '9:00', values: [95, 95, 95, 95, 95] },
  { hour: '10:00', values: [95, 95, 95, 95, 95] },
  { hour: '11:00', values: [95, 95, 95, 95, 95] }
]

const machineCharts = [
  { name: 'Inbound & Storage', line: 'Line A', oee: 78.1, status: 'stopped' },
  { name: 'Packaging', line: 'Line B', oee: 81.1, status: 'stopped' },
  { name: 'QC & Dispatch', line: 'Line C', oee: 60.2, status: 'stopped' }
]

function objectsToCSV(rows) {
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers]
  rows.forEach((row) => {
    lines.push(headers.map((h) => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }))
  })
  return lines.map((line) => line.join(',')).join('\n')
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function doExport(rows, filenameBase, format) {
  if (!rows || rows.length === 0) {
    alert('ไม่มีข้อมูลสำหรับ Export')
    return
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `${filenameBase}_${dateStr}`

  if (format === 'pdf') {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const headers = Object.keys(rows[0])
      const head = [headers.map((h) => h.toUpperCase())]
      const body = rows.map((row) => headers.map((h) => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        return String(val)
      }))

      doc.setFontSize(16)
      doc.text('OEE Report', 14, 18)
      doc.setFontSize(10)
      doc.text(`Generated: ${dateStr}`, 14, 26)

      autoTable(doc, {
        head,
        body,
        startY: 32,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
        margin: { left: 14, right: 14 },
      })

      doc.save(`${filename}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('สร้าง PDF ไม่สำเร็จ: ' + err.message)
    }
    return
  }

  const csv = objectsToCSV(rows)
  const ext = format === 'xls' ? 'xls' : 'csv'
  downloadBlob(csv, `${filename}.${ext}`, 'text/csv')
}

function ExportModal({ isOpen, onClose, onSelect, title = 'เลือกรูปแบบไฟล์' }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md rounded-xl border border-border panel-modal p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-400 mt-1">เลือกรูปแบบไฟล์ที่ต้องการ Export</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'csv', label: '.CSV' },
            { id: 'xls', label: '.XLS' },
            { id: 'pdf', label: '.PDF' }
          ].map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => onSelect(fmt.id)}
              className="rounded-lg border border-border bg-bg-panel/60 px-4 py-4 font-mono text-base font-bold text-slate-200 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-200 transition"
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatPercent(value) {
  if (value === undefined || value === null) return '-'
  return `${Math.round(value * 10) / 10}%`
}

function latestPerMachine(records) {
  const map = new Map()
  records.forEach((r) => {
    const existing = map.get(r.machine)
    if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
      map.set(r.machine, r)
    }
  })
  return Array.from(map.values()).map((r) => ({
    machine: r.machine,
    line: r.line,
    oee: r.oee,
    avail: r.availability,
    perf: r.performance,
    qual: r.quality,
    good: r.goodUnits,
    total: r.totalUnits,
    status: r.status,
  }))
}

function HistorySection() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('daily')
  const [exportOpen, setExportOpen] = useState(false)
  const [historyRecords, setHistoryRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getOEEHistory({ limit: 500 }),
      api.getOEEHistorySummary(),
    ])
      .then(([historyRes, summaryRes]) => {
        if (cancelled) return
        setHistoryRecords(historyRes.data || [])
        setSummary(summaryRes.data || null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load OEE history:', err)
        setError('โหลดข้อมูลจาก server ไม่สำเร็จ ใช้ข้อมูลตัวอย่างแทน')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const latestDaily = latestPerMachine(historyRecords)
  const currentData = filter === 'daily'
    ? (latestDaily.length ? latestDaily : dailyData)
    : filter === 'monthly'
    ? monthlyData
    : yearlyData

  const summaryValues = summary || {}

  const isActive = (f) => filter === f
    ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
    : 'bg-bg-card/30 text-slate-400 border border-transparent hover:border-border hover:text-slate-200'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100">📋 ข้อมูลย้อนหลัง</h1>
            <p className="text-sm text-slate-400 mt-1">ข้อมูลการผลิตย้อนหลัง</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white hover:from-emerald-400 hover:to-teal-400 transition shadow-lg shadow-emerald-500/25"
            >
              <Download className="h-4 w-4" />
              Export ข้อมูลย้อนหลัง
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('daily')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('daily')}`}>📅 รายวัน</button>
          <button onClick={() => setFilter('monthly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('monthly')}`}>📆 รายเดือน</button>
          <button onClick={() => setFilter('yearly')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive('yearly')}`}>📊 รายปี</button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-slate-400">กำลังโหลดข้อมูล...</div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
          <div className="text-xs text-slate-400 mb-1">OEE</div>
          <div className="font-mono text-3xl font-bold text-sky-300">{formatPercent(summaryValues.oee ?? 64.7)}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
          <div className="text-xs text-slate-400 mb-1">Availability</div>
          <div className="font-mono text-3xl font-bold text-emerald-300">{formatPercent(summaryValues.availability ?? 85.7)}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
          <div className="text-xs text-slate-400 mb-1">Performance</div>
          <div className="font-mono text-3xl font-bold text-amber-300">{formatPercent(summaryValues.performance ?? 76.6)}</div>
        </div>
        <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
          <div className="text-xs text-slate-400 mb-1">Quality</div>
          <div className="font-mono text-3xl font-bold text-violet-300">{formatPercent(summaryValues.quality ?? 98.5)}</div>
        </div>
      </div>

      {filter === 'daily' && (
        <div className="rounded-xl border border-border panel-sub overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-base text-slate-300">ข้อมูลประจำวันที่ <span className="text-sky-300">6 มิถุนายน 2569</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-bg-card/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Machine</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Line</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">OEE%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Avail%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Perf%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Qual%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Good</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Total</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((row, i) => {
                  const status = row.status || 'stopped'
                  const config = statusConfig[status] || statusConfig.stopped
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-bg-card/30 transition">
                      <td className="px-6 py-4 font-semibold text-slate-100 text-base">{row.machine}</td>
                      <td className="px-6 py-4 text-slate-400 text-base">{row.line}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-sky-300 text-lg">{row.oee}%</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-300 text-lg">{row.avail}%</td>
                      <td className="px-6 py-4 text-right font-mono text-amber-300 text-lg">{row.perf}%</td>
                      <td className="px-6 py-4 text-right font-mono text-violet-300 text-lg">{row.qual}%</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.good}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.total}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${config.bg} ${config.text} ${config.border}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filter === 'monthly' && (
        <div className="rounded-xl border border-border panel-sub overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-base text-slate-300">ข้อมูลรายเดือน <span className="text-sky-300">ปี 2569</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-bg-card/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Month</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Machine</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">OEE%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Avail%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Perf%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Qual%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Good</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-card/30 transition">
                    <td className="px-6 py-4 font-semibold text-slate-100 text-base">{row.month}</td>
                    <td className="px-6 py-4 text-slate-400 text-base">{row.machine}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sky-300 text-lg">{row.oee}%</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-300 text-lg">{row.avail}%</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-300 text-lg">{row.perf}%</td>
                    <td className="px-6 py-4 text-right font-mono text-violet-300 text-lg">{row.qual}%</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.good}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filter === 'yearly' && (
        <div className="rounded-xl border border-border panel-sub overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-base text-slate-300">ข้อมูลรายปี <span className="text-sky-300">ย้อนหลัง 3 ปี</span></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-bg-card/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Year</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-400">Machine</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">OEE%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Avail%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Perf%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Qual%</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Good</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {yearlyData.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-card/30 transition">
                    <td className="px-6 py-4 font-semibold text-slate-100 text-base">{row.year}</td>
                    <td className="px-6 py-4 text-slate-400 text-base">{row.machine}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-sky-300 text-lg">{row.oee}%</td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-300 text-lg">{row.avail}%</td>
                    <td className="px-6 py-4 text-right font-mono text-amber-300 text-lg">{row.perf}%</td>
                    <td className="px-6 py-4 text-right font-mono text-violet-300 text-lg">{row.qual}%</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.good}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-300 text-lg">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border panel-sub overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-base text-slate-300">สรุปข้อมูลรายชั่วโมง - วันนี้ <span className="text-sky-300">6 มิถุนายน 2569</span></p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-card/50">
                <th className="px-3 py-2 text-left font-semibold text-slate-400">ชม.</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-400">
                  <div className="text-xs">Inbound & Storage</div>
                  <div className="text-xs text-slate-400">Line A</div>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-400">
                  <div className="text-xs">Feeding / Material Handling</div>
                  <div className="text-xs text-slate-400">Line A</div>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-400">
                  <div className="text-xs">Sorting & Cleaning</div>
                  <div className="text-xs text-slate-400">Line B</div>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-400">
                  <div className="text-xs">Packaging</div>
                  <div className="text-xs text-slate-400">Line B</div>
                </th>
                <th className="px-3 py-2 text-center font-semibold text-slate-400">
                  <div className="text-xs">QC & Dispatch</div>
                  <div className="text-xs text-slate-400">Line C</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {hourlyData.map((row, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-bg-card/20 transition">
                  <td className="px-3 py-2 font-semibold text-slate-100 border-r border-border/30">{row.hour}</td>
                  {row.values.map((val, j) => (
                    <td key={j} className="px-3 py-2 text-center">
                      <div className="font-mono text-sm font-bold text-sky-300">{val}%</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        {machineCharts.map((machine, i) => {
          const status = machine.status || 'stopped'
          const config = statusConfig[status] || statusConfig.stopped
          return (
            <div key={i} className="rounded-xl border border-border panel-sub p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{machine.name}</h3>
                  <p className="text-sm text-slate-400">{machine.line}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg font-bold text-sky-300">{machine.oee}%</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${config.bg} ${config.text} ${config.border}`}>
                    {status}
                  </span>
                </div>
              </div>
              <div className="h-64 mb-4 bg-bg-card/30 rounded-lg flex items-center justify-center">
                <p className="text-slate-400 text-sm">Chart placeholder - hourly OEE bars</p>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  <span>Running</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500"></div>
                  <span>Idle</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500"></div>
                  <span>Breakdown</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-slate-400/30"></div>
                  <span>Future</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onSelect={(format) => {
          doExport(currentData, `history_${filter}`, format)
          setExportOpen(false)
        }}
        title="Export ข้อมูลย้อนหลัง"
      />
    </div>
  )
}

export default function DataCenter() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl border border-border panel-sub p-4 shadow-xl mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 mb-1">📊 ศูนย์ข้อมูล</h1>
              <p className="text-sm text-slate-400">ดูข้อมูลการผลิตย้อนหลังและ Export ข้อมูล</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/data/export')}
                className="flex items-center gap-2 rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white hover:from-sky-400 hover:to-indigo-400 transition shadow-lg shadow-sky-500/25"
              >
                <Download className="h-4 w-4" />
                Export ข้อมูลเครื่องจักร
              </button>
              <button
                onClick={() => navigate('/data/range')}
                className="flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-500/20 transition"
              >
                <Search className="h-4 w-4" />
                ดูข้อมูลตามช่วงเวลา
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border panel p-4 md:p-6">
          <HistorySection />
        </div>
      </div>
    </div>
  )
}
