// Data Export page - export Process 5 Packaging machine data
import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api } from '../services/api.js'

const PROCESS_ID = 5
const PROCESS_NAME = 'Packaging'
const PROCESS_TITLE = 'Process 5 - Packaging'

const PROCESS_5_MACHINE_META = [
  { id: 'pkg-1', type: 'Critical Control Point' },
  { id: 'pkg-2', type: 'Automatic Packing' },
  { id: 'pkg-3', type: 'Sealing Machine' },
  { id: 'pkg-4', type: 'Checkweigher' },
  { id: 'pkg-5', type: 'Bag Discharge Conveyor' },
]

function toISO(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function numberOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function formatNumber(value, digits = 1) {
  return numberOr(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function escapeCSVCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
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

function resolvePackagingStatus(item = {}) {
  const value = String(item.status || item.state || '').trim().toUpperCase()
  if (['RUNNING', 'RUN'].includes(value)) return 'RUNNING'
  if (['STANDBY', 'STANBY'].includes(value)) return 'STANDBY'
  if (['DISCONNECT', 'DISCONNECTED', 'OFFLINE'].includes(value)) return 'DISCONNECT'

  const powerKw = numberOr(item.powerKw)
  if (item.rawStatus === false || item.isOnline === false) return 'DISCONNECT'
  if (item.rawStatus === true || item.isOnline === true) return powerKw > 1 ? 'RUNNING' : 'STANDBY'
  return 'DISCONNECT'
}

function statusClass(status) {
  if (status === 'RUNNING') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
  if (status === 'STANDBY') return 'border-amber-500/30 bg-amber-500/15 text-amber-300'
  return 'border-red-500/30 bg-red-500/15 text-red-300'
}

export default function DataExport() {
  const [fileFormat, setFileFormat] = useState('csv')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api.getNodeRedDashboard()
      .then((res) => {
        if (cancelled) return
        setDashboard(res.data || res || null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setDashboard(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const exportData = useMemo(() => {
    const packaging = Array.isArray(dashboard?.packaging) ? dashboard.packaging : []
    return packaging.map((item, index) => {
      const meta = PROCESS_5_MACHINE_META.find((entry) => entry.id === item.id) || PROCESS_5_MACHINE_META[index] || {}
      return {
        process: PROCESS_TITLE,
        machineId: item.id || meta.id || `pkg-${index + 1}`,
        machine: item.name || `Packaging ${index + 1}`,
        type: meta.type || 'Packaging Machine',
        status: resolvePackagingStatus(item),
        powerKw: numberOr(item.powerKw),
        energyKwh: numberOr(item.powerKwh),
        workingTimeMinutes: Math.round(numberOr(item.workingTimeMinutes)),
        stopTimeMinutes: Math.round(numberOr(item.stopTimeMinutes)),
        sourceUpdatedAt: dashboard?.updatedAt || '',
      }
    })
  }, [dashboard])

  const totals = useMemo(() => {
    return exportData.reduce((summary, row) => ({
      total: summary.total + 1,
      running: summary.running + (row.status === 'RUNNING' ? 1 : 0),
      standby: summary.standby + (row.status === 'STANDBY' ? 1 : 0),
      disconnect: summary.disconnect + (row.status === 'DISCONNECT' ? 1 : 0),
      powerKw: summary.powerKw + row.powerKw,
      energyKwh: summary.energyKwh + row.energyKwh,
      workingTimeMinutes: summary.workingTimeMinutes + row.workingTimeMinutes,
      stopTimeMinutes: summary.stopTimeMinutes + row.stopTimeMinutes,
    }), {
      total: 0,
      running: 0,
      standby: 0,
      disconnect: 0,
      powerKw: 0,
      energyKwh: 0,
      workingTimeMinutes: 0,
      stopTimeMinutes: 0,
    })
  }, [exportData])

  const buildExportRows = () => {
    const headers = ['Process', 'Machine ID', 'Machine', 'Type', 'Status', 'Power kW', 'Energy kWh', 'Working time', 'Stop time', 'Updated at']
    const rows = exportData.map((row) => [
      row.process,
      row.machineId,
      row.machine,
      row.type,
      row.status,
      formatNumber(row.powerKw, 2),
      formatNumber(row.energyKwh, 2),
      `${row.workingTimeMinutes} min`,
      `${row.stopTimeMinutes} min`,
      row.sourceUpdatedAt,
    ])

    return { headers, rows }
  }

  const exportCSV = (filename) => {
    const { headers, rows } = buildExportRows()
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSVCell).join(','))
      .join('\n')

    downloadBlob(csvContent, `${filename}.csv`, 'text/csv')
  }

  const exportPDF = (filename, today) => {
    const { headers, rows } = buildExportRows()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(16)
    doc.text(`${PROCESS_TITLE} Export Report`, 14, 16)
    doc.setFontSize(9)
    doc.text(`Generated: ${today}`, 14, 23)
    doc.text(`Machines: ${totals.total}`, 14, 29)
    doc.text(`Running / Standby / Disconnect: ${totals.running} / ${totals.standby} / ${totals.disconnect}`, 52, 29)
    doc.text(`Power: ${formatNumber(totals.powerKw, 2)} kW`, 130, 29)
    doc.text(`Energy: ${formatNumber(totals.energyKwh, 2)} kWh`, 170, 29)

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 34 },
        2: { cellWidth: 36 },
        3: { cellWidth: 32 },
        9: { cellWidth: 42 },
      },
    })

    doc.save(`${filename}.pdf`)
  }

  const handleExport = () => {
    if (!exportData.length) {
      alert('ไม่มีข้อมูล Process 5 ให้ export')
      return
    }

    setExporting(true)

    const today = toISO(new Date())
    const filename = `process_${PROCESS_ID}_packaging_${today}`
    try {
      if (fileFormat === 'pdf') exportPDF(filename, today)
      else exportCSV(filename)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export ไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    } finally {
      setTimeout(() => setExporting(false), 600)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="rounded-xl border border-border panel-sub p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-100">Export ข้อมูล</h1>
          <p className="mt-2 text-base text-slate-400">ส่งออกข้อมูลเครื่องจักรเฉพาะ {PROCESS_TITLE}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-border panel-sub p-8 shadow-xl space-y-6">
            <div>
              <div className="mb-3 text-sm uppercase tracking-wider text-slate-400">รูปแบบไฟล์</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setFileFormat('csv')}
                  className={`flex-1 rounded-lg border px-4 py-3 font-mono text-base font-bold ${
                    fileFormat === 'csv'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                      : 'border-border bg-bg-panel/20 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  .CSV
                </button>
                <button
                  onClick={() => setFileFormat('pdf')}
                  className={`flex-1 rounded-lg border px-4 py-3 font-mono text-base font-bold ${
                    fileFormat === 'pdf'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                      : 'border-border bg-bg-panel/20 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  .PDF
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                โหลดข้อมูล Node-RED ไม่สำเร็จ: {error}
              </div>
            )}

            <div className="rounded-lg border border-border bg-bg-card/50 p-4 text-base text-slate-400">
              Process=<span className="font-mono text-sky-300">5</span> | Run/Std/Dis=<span className="font-mono text-emerald-300">{totals.running}</span>/<span className="font-mono text-amber-300">{totals.standby}</span>/<span className="font-mono text-red-300">{totals.disconnect}</span> | Power <span className="font-mono text-cyan-300">{formatNumber(totals.powerKw, 2)} kW</span> | Energy <span className="font-mono text-violet-300">{formatNumber(totals.energyKwh, 2)} kWh</span>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting || loading}
              className="w-full rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-4 py-4 text-base font-bold text-white transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'กำลัง Export...' : `Export ${fileFormat.toUpperCase()}`}
            </button>
          </div>

          <div className="rounded-xl border border-border panel-sub p-8 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-slate-100">ข้อมูลที่จะส่งออก</h2>
            {loading ? (
              <div className="py-8 text-center text-slate-400">กำลังโหลดข้อมูล Process 5...</div>
            ) : exportData.length === 0 ? (
              <div className="py-8 text-center text-slate-400">ไม่พบข้อมูล Packaging จาก Node-RED</div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-400">
                  <p className="mb-2">• ข้อมูลเฉพาะ {PROCESS_TITLE}</p>
                  <p className="mb-2">• เครื่องจักรทั้งหมด {exportData.length} เครื่อง</p>
                  <p className="mb-2">• สถานะ RUNNING / STANDBY / DISCONNECT</p>
                  <p className="mb-2">• Power kW, Energy kWh, Working time, Stop time</p>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-card/30 p-4">
                  <div className="mb-2 text-xs text-slate-400">ตัวอย่างข้อมูล</div>
                  <div className="space-y-1 font-mono text-xs text-slate-300">
                    {exportData.map((row) => (
                      <div key={row.machineId} className="flex flex-wrap items-center gap-2">
                        <span>{row.machine}</span>
                        <span className="text-slate-500">|</span>
                        <span>{row.type}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(row.status)}`}>{row.status}</span>
                        <span>{formatNumber(row.powerKw, 2)} kW</span>
                        <span>{formatNumber(row.energyKwh, 2)} kWh</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
