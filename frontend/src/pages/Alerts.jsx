import { useEffect, useMemo, useState } from 'react'
import { Bell, Download, FileText, RefreshCw, Trash2, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api } from '../services/api.js'

function normalizeSeverity(value, type) {
  const severity = String(value || (type === 'breakdown' ? 'critical' : 'warning')).toLowerCase()
  return ['critical', 'warning', 'info'].includes(severity) ? severity : 'warning'
}

function formatDateTime(ts) {
  if (!ts) return { date: '-', time: '-' }
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return { date: '-', time: '-' }
  return {
    date: d.toLocaleDateString('th-TH'),
    time: d.toLocaleTimeString('en-US', { hour12: false }),
  }
}

function mapAlert(alert, index) {
  const rawTimestamp = alert.timestamp || alert.createdAt || null
  const { date, time } = formatDateTime(rawTimestamp)
  const severity = normalizeSeverity(alert.severity, alert.type)
  const equipment = alert.equipment || alert.machine || alert.line || 'System'

  return {
    id: alert._id || alert.id || `alert-${index}`,
    severity,
    title: alert.title || alert.message || `${equipment} - ${alert.type || 'Alert'}`,
    rawTimestamp,
    date,
    time,
    equipment,
    status: alert.acknowledged ? 'ACKNOWLEDGED' : (alert.status || 'RAISED'),
    details: alert.details || alert.description || alert.desc || '',
  }
}

function objectsToCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers]
  rows.forEach((row) => {
    lines.push(headers.map((header) => {
      const value = row[header] ?? ''
      return `"${String(value).replace(/"/g, '""')}"`
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

function buildExportRows(alerts) {
  return alerts.map((alert) => ({
    Date: alert.date,
    Time: alert.time,
    Severity: alert.severity.toUpperCase(),
    Status: alert.status,
    Equipment: alert.equipment,
    Title: alert.title,
    Details: alert.details || '-',
  }))
}

function buildExportName(filter, extension) {
  const stamp = new Date().toISOString().slice(0, 10)
  return `alarm_report_${filter}_${stamp}.${extension}`
}

function ExportFormatModal({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null

  const formats = [
    { id: 'csv', label: '.CSV', icon: Download },
    { id: 'pdf', label: '.PDF', icon: FileText },
  ]

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border panel-modal p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">เลือกประเภทไฟล์ Export</h2>
            <p className="mt-1 text-xs text-slate-400">ส่งออกข้อมูล Alarm จากรายการที่กำลังแสดงอยู่</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-400 transition hover:border-rose-500/40 hover:text-rose-300"
            aria-label="Close export format dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {formats.map((format) => {
            const Icon = format.icon
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => onSelect(format.id)}
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg-panel/45 px-4 py-5 text-slate-200 transition hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-200"
              >
                <Icon size={24} />
                <span className="font-mono text-sm font-bold">{format.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const severityConfig = {
  critical: {
    borderColor: 'border-red-500',
    bgColor: 'bg-red-950/20',
    badgeBorder: 'border-red-500/30',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-200',
  },
  warning: {
    borderColor: 'border-amber-400',
    bgColor: 'bg-amber-950/10',
    badgeBorder: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-200',
  },
  info: {
    borderColor: 'border-sky-400',
    bgColor: 'bg-sky-950/10',
    badgeBorder: 'border-sky-500/30',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-200',
  },
}

export default function Alerts() {
  const [filter, setFilter] = useState('all')
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const fetchAlerts = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await api.getAlerts()
      const data = Array.isArray(res.data) ? res.data.map(mapAlert) : []
      setAlerts(data)
      setError('')
    } catch (err) {
      setError(err.message || 'ไม่สามารถโหลด alerts ได้')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async (options) => {
      if (cancelled) return
      await fetchAlerts(options)
    }

    load()
    const timer = setInterval(() => load({ silent: true }), 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const counts = useMemo(() => ({
    critical: alerts.filter((alert) => alert.severity === 'critical').length,
    warning: alerts.filter((alert) => alert.severity === 'warning').length,
    info: alerts.filter((alert) => alert.severity === 'info').length,
  }), [alerts])

  const filteredAlerts = useMemo(() => (
    filter === 'all' ? alerts : alerts.filter((alert) => alert.severity === filter)
  ), [alerts, filter])

  const getBtnClass = (value, activeColor, hoverBorder) => {
    const base = 'rounded-lg px-3 py-1.5 text-xs font-bold transition-all border '
    if (filter === value) return base + activeColor
    return base + `border-transparent bg-bg-card/30 text-slate-400 hover:${hoverBorder} hover:text-slate-200`
  }

  const handleExportCSV = () => {
    const rows = buildExportRows(filteredAlerts)
    downloadBlob(objectsToCSV(rows), buildExportName(filter, 'csv'), 'text/csv')
  }

  const handleExportPDF = () => {
    const rows = buildExportRows(filteredAlerts)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const generatedAt = new Date().toLocaleString('th-TH')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Alarm Report', 14, 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(`Filter: ${filter.toUpperCase()} | Records: ${rows.length} | Generated: ${generatedAt}`, 14, 23)

    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Time', 'Severity', 'Status', 'Equipment', 'Title', 'Details']],
      body: rows.map((row) => [row.Date, row.Time, row.Severity, row.Status, row.Equipment, row.Title, row.Details]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
        3: { cellWidth: 28 },
        4: { cellWidth: 34 },
        5: { cellWidth: 70 },
        6: { cellWidth: 80 },
      },
      margin: { left: 14, right: 14 },
    })

    doc.save(buildExportName(filter, 'pdf'))
  }

  const handleExportSelect = (format) => {
    setExportOpen(false)
    if (!filteredAlerts.length) return
    if (format === 'pdf') {
      handleExportPDF()
      return
    }
    handleExportCSV()
  }

  const handleClearAlerts = async () => {
    if (!alerts.length || clearing) return
    const confirmed = window.confirm('ต้องการลบ Alarm ทั้งหมดใช่ไหม?')
    if (!confirmed) return

    setClearing(true)
    try {
      await api.clearAlerts()
      setAlerts([])
      setFilter('all')
      setError('')
    } catch (err) {
      setError(err.message || 'ไม่สามารถ clear alarm ทั้งหมดได้')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-border panel-sub p-4 shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
              <Bell size={21} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Alarm Management</h1>
              <p className="text-xs text-slate-400">Real-time alarm list with CSV and PDF export</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFilter('all')} className={getBtnClass('all', 'border-slate-600 bg-slate-700 text-slate-100', 'border-slate-600')}>ALL ({alerts.length})</button>
            <button onClick={() => setFilter('critical')} className={getBtnClass('critical', 'border-red-500/40 bg-red-950/40 text-red-300', 'border-red-500/30')}>CRITICAL ({counts.critical})</button>
            <button onClick={() => setFilter('warning')} className={getBtnClass('warning', 'border-amber-500/40 bg-amber-950/40 text-amber-300', 'border-amber-500/30')}>WARNING ({counts.warning})</button>
            <button onClick={() => setFilter('info')} className={getBtnClass('info', 'border-sky-500/40 bg-sky-950/40 text-sky-300', 'border-sky-500/30')}>INFO ({counts.info})</button>
            <button
              type="button"
              onClick={() => fetchAlerts({ silent: true })}
              disabled={loading || refreshing || clearing}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card/40 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-sky-500/40 hover:text-sky-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClearAlerts}
              disabled={!alerts.length || loading || clearing}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={14} className={clearing ? 'animate-pulse' : ''} />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              disabled={!filteredAlerts.length || loading || clearing}
              className="inline-flex items-center gap-2 rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border panel-sub">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="py-8 text-center text-slate-400">
              <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-rose-300">{error}</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">ไม่มี alerts</div>
          ) : (
            filteredAlerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.warning
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-4 rounded-xl border-l-4 ${config.borderColor} ${config.bgColor} p-4 transition-all hover:brightness-110`}
                >
                  <div className={`h-3 w-3 shrink-0 rounded-full ${alert.severity === 'critical' ? 'bg-red-400' : alert.severity === 'warning' ? 'bg-amber-300' : 'bg-sky-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] ${config.badgeBorder} ${config.badgeBg} ${config.badgeText}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <div className="truncate text-sm font-bold text-slate-100">{alert.title}</div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] text-slate-400">{alert.time}</div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300">
                      <span>{alert.status}</span>
                      <span className="text-slate-500">Equipment: {alert.equipment}</span>
                      <span className="text-slate-500">Date: {alert.date}</span>
                    </div>
                    {alert.details && <div className="mt-1 text-xs text-slate-400">{alert.details}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="border-t border-border bg-bg-card/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <button disabled className="cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2 text-xs font-semibold text-slate-600 transition-all">Previous</button>
            <div className="text-sm text-slate-300">
              Page <span className="font-mono font-bold text-slate-100">1</span> of <span className="font-mono">1</span>
              <span className="ml-2 text-slate-400">({filteredAlerts.length} alerts)</span>
            </div>
            <button disabled className="cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2 text-xs font-semibold text-slate-600 transition-all">Next</button>
          </div>
        </div>
      </div>

      <ExportFormatModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onSelect={handleExportSelect}
      />
    </div>
  )
}
