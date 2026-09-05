// Data Range page - date range picker and historical dashboard from MongoDB
import { useState, useEffect, useMemo } from 'react'
import { Download, FileText, Search, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { api } from '../services/api.js'

const statusConfig = {
  running: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  breakdown: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  idle: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  stopped: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/30' }
}

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function formatDateThai(dateStr) {
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function avg(values) {
  if (!values.length) return 0
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

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

function buildExportRows(records) {
  return records.map((r) => ({
    Date: r.timestamp ? new Date(r.timestamp).toLocaleDateString('th-TH') : '-',
    Machine: r.machine,
    Line: r.line,
    OEE: r.oee,
    Availability: r.availability,
    Performance: r.performance,
    Quality: r.quality,
    Good: r.goodUnits,
    Total: r.totalUnits,
    Status: r.status || 'stopped'
  }))
}

const chartColors = [
  [14, 165, 233],
  [16, 185, 129],
  [245, 158, 11],
  [139, 92, 246],
  [244, 63, 94],
  [20, 184, 166],
  [99, 102, 241],
  [132, 204, 22],
]

function formatNumber(value, maximumFractionDigits = 1) {
  return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits })
}

function toDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function buildTrendRows(records) {
  const grouped = new Map()
  records.forEach((record) => {
    const key = toDateKey(record.timestamp)
    if (!key) return
    const current = grouped.get(key) || {
      date: key,
      count: 0,
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
    }
    current.count += 1
    current.oee += Number(record.oee) || 0
    current.availability += Number(record.availability) || 0
    current.performance += Number(record.performance) || 0
    current.quality += Number(record.quality) || 0
    grouped.set(key, current)
  })

  return Array.from(grouped.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date,
      oee: Math.round((row.oee / row.count) * 10) / 10,
      availability: Math.round((row.availability / row.count) * 10) / 10,
      performance: Math.round((row.performance / row.count) * 10) / 10,
      quality: Math.round((row.quality / row.count) * 10) / 10,
    }))
}

function buildProductFlowRows(receipts, withdraws) {
  const productMap = new Map()
  const ensureProduct = (product) => {
    const name = String(product || 'Unspecified product').trim() || 'Unspecified product'
    if (!productMap.has(name)) {
      productMap.set(name, { product: name, inbound: 0, outbound: 0 })
    }
    return productMap.get(name)
  }

  receipts.forEach((row) => {
    ensureProduct(row.product).inbound += Number(row.weight) || 0
  })
  withdraws.forEach((row) => {
    ensureProduct(row.product).outbound += Number(row.weight) || 0
  })

  return Array.from(productMap.values())
    .map((row) => ({
      ...row,
      net: Math.round((row.inbound - row.outbound) * 10) / 10,
    }))
    .sort((a, b) => (b.inbound + b.outbound) - (a.inbound + a.outbound) || a.product.localeCompare(b.product, 'th'))
}

function fitCanvasText(ctx, text, maxWidth) {
  const value = String(text || '')
  if (ctx.measureText(value).width <= maxWidth) return value
  let next = value
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1)
  }
  return `${next}...`
}

function colorToCss(color) {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
}

function compactChartItems(items, maxItems = 8) {
  const filtered = items.filter((item) => item.value > 0)
  if (filtered.length <= maxItems) return filtered

  const visible = filtered.slice(0, maxItems - 1)
  const otherValue = filtered.slice(maxItems - 1).reduce((sum, item) => sum + item.value, 0)
  return [...visible, { label: 'Other', value: otherValue }]
}

function createPieChartImage(items, title) {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  const chartItems = compactChartItems(items)
  const total = chartItems.reduce((sum, item) => sum + item.value, 0)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 30px Arial, Tahoma, sans-serif'
  ctx.fillText(title, 28, 46)
  ctx.fillStyle = '#475569'
  ctx.font = '22px Arial, Tahoma, sans-serif'
  ctx.fillText(`Total ${formatNumber(total)} kg`, 28, 78)

  const centerX = 215
  const centerY = 215
  const radius = 106

  if (!total) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#e2e8f0'
    ctx.fill()
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 24px Arial, Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No data', centerX, centerY + 8)
    ctx.textAlign = 'left'
    return canvas.toDataURL('image/png')
  }

  let angle = -Math.PI / 2
  chartItems.forEach((item, index) => {
    const nextAngle = angle + (item.value / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, angle, nextAngle)
    ctx.closePath()
    ctx.fillStyle = colorToCss(chartColors[index % chartColors.length])
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.stroke()
    angle = nextAngle
  })

  const legendX = 380
  let legendY = 120
  ctx.textAlign = 'left'
  chartItems.forEach((item, index) => {
    const color = chartColors[index % chartColors.length]
    const percent = total ? (item.value / total) * 100 : 0
    ctx.fillStyle = colorToCss(color)
    ctx.fillRect(legendX, legendY - 18, 20, 20)
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px Arial, Tahoma, sans-serif'
    ctx.fillText(fitCanvasText(ctx, item.label, 270), legendX + 32, legendY)
    ctx.fillStyle = '#475569'
    ctx.font = 'bold 22px Arial, Tahoma, sans-serif'
    ctx.fillText(`${formatNumber(percent)}%`, legendX + 330, legendY)
    legendY += 42
  })

  return canvas.toDataURL('image/png')
}

function createTrendChartImage(trendRows) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  const chartX = 72
  const chartY = 76
  const chartW = 1040
  const chartH = 220
  const series = [
    { key: 'oee', label: 'OEE', color: [14, 165, 233] },
    { key: 'availability', label: 'Availability', color: [16, 185, 129] },
    { key: 'performance', label: 'Performance', color: [245, 158, 11] },
    { key: 'quality', label: 'Quality', color: [139, 92, 246] },
  ]

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 30px Arial, Tahoma, sans-serif'
  ctx.fillText('Trend', 30, 44)

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.fillStyle = '#64748b'
  ctx.font = '18px Arial, Tahoma, sans-serif'
  for (let i = 0; i <= 5; i += 1) {
    const value = i * 20
    const y = chartY + chartH - (value / 100) * chartH
    ctx.beginPath()
    ctx.moveTo(chartX, y)
    ctx.lineTo(chartX + chartW, y)
    ctx.stroke()
    ctx.fillText(`${value}%`, 20, y + 6)
  }

  ctx.strokeStyle = '#94a3b8'
  ctx.beginPath()
  ctx.moveTo(chartX, chartY)
  ctx.lineTo(chartX, chartY + chartH)
  ctx.lineTo(chartX + chartW, chartY + chartH)
  ctx.stroke()

  if (!trendRows.length) {
    ctx.fillStyle = '#64748b'
    ctx.font = 'bold 24px Arial, Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No trend data', chartX + chartW / 2, chartY + chartH / 2)
    ctx.textAlign = 'left'
    return canvas.toDataURL('image/png')
  }

  const xForIndex = (index) => chartX + (trendRows.length === 1 ? chartW / 2 : (index / (trendRows.length - 1)) * chartW)
  const yForValue = (value) => chartY + chartH - (Math.max(0, Math.min(100, value)) / 100) * chartH

  series.forEach((item) => {
    ctx.strokeStyle = colorToCss(item.color)
    ctx.fillStyle = colorToCss(item.color)
    ctx.lineWidth = 4
    ctx.beginPath()
    trendRows.forEach((row, index) => {
      const x = xForIndex(index)
      const y = yForValue(row[item.key])
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    trendRows.forEach((row, index) => {
      const x = xForIndex(index)
      const y = yForValue(row[item.key])
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  const labelEvery = Math.max(1, Math.ceil(trendRows.length / 6))
  ctx.fillStyle = '#64748b'
  ctx.font = '18px Arial, Tahoma, sans-serif'
  ctx.textAlign = 'center'
  trendRows.forEach((row, index) => {
    if (index !== 0 && index !== trendRows.length - 1 && index % labelEvery !== 0) return
    ctx.fillText(row.date.slice(5), xForIndex(index), chartY + chartH + 28)
  })
  ctx.textAlign = 'left'

  let legendX = 770
  series.forEach((item) => {
    ctx.fillStyle = colorToCss(item.color)
    ctx.fillRect(legendX, 27, 18, 18)
    ctx.fillStyle = '#0f172a'
    ctx.font = '18px Arial, Tahoma, sans-serif'
    ctx.fillText(item.label, legendX + 26, 43)
    legendX += item.label === 'Availability' ? 160 : 110
  })

  return canvas.toDataURL('image/png')
}

function createProductFlowTableImage(rows) {
  if (!rows.length) return null

  const maxRows = 8
  const visibleRows = rows.length > maxRows
    ? [
        ...rows.slice(0, maxRows - 1),
        rows.slice(maxRows - 1).reduce((summary, row) => ({
          product: 'Other',
          inbound: summary.inbound + row.inbound,
          outbound: summary.outbound + row.outbound,
          net: summary.net + row.net,
        }), { product: 'Other', inbound: 0, outbound: 0, net: 0 }),
      ]
    : rows

  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 460
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 30px Arial, Tahoma, sans-serif'
  ctx.fillText('Product Flow Detail', 28, 42)

  const columns = [
    { label: 'Product', x: 36, w: 315, align: 'left' },
    { label: 'Inbound kg', x: 390, w: 130, align: 'right' },
    { label: 'Outbound kg', x: 555, w: 145, align: 'right' },
    { label: 'Net kg', x: 735, w: 110, align: 'right' },
  ]
  const tableX = 28
  const tableY = 66
  const rowH = 40

  ctx.fillStyle = '#0ea5e9'
  ctx.fillRect(tableX, tableY, 844, 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px Arial, Tahoma, sans-serif'
  columns.forEach((column) => {
    ctx.textAlign = column.align
    ctx.fillText(column.label, column.align === 'right' ? column.x + column.w : column.x, tableY + 28)
  })

  visibleRows.forEach((row, index) => {
    const y = tableY + 42 + index * rowH
    ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff'
    ctx.fillRect(tableX, y, 844, rowH)
    ctx.strokeStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.moveTo(tableX, y + rowH)
    ctx.lineTo(tableX + 844, y + rowH)
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.font = '20px Arial, Tahoma, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(fitCanvasText(ctx, row.product, 300), columns[0].x, y + 26)
    ctx.textAlign = 'right'
    ctx.fillText(formatNumber(row.inbound), columns[1].x + columns[1].w, y + 26)
    ctx.fillText(formatNumber(row.outbound), columns[2].x + columns[2].w, y + 26)
    ctx.fillStyle = row.net < 0 ? '#e11d48' : '#059669'
    ctx.fillText(formatNumber(row.net), columns[3].x + columns[3].w, y + 26)
  })
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

function drawMetricCard(doc, x, y, width, height, label, value, color) {
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(x, y, width, height, 3, 3, 'FD')
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(label, x + 5, y + 9)
  doc.setTextColor(color[0], color[1], color[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(value, x + 5, y + 25)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
}

function ExportFormatModal({ isOpen, onClose, onSelect }) {
  if (!isOpen) return null

  const formats = [
    { id: 'csv', label: '.CSV', icon: Download },
    { id: 'pdf', label: '.PDF', icon: FileText }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border panel-modal p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-100">เลือกรูปแบบไฟล์</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {formats.map((format) => {
            const Icon = format.icon
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => onSelect(format.id)}
                className="flex items-center justify-center gap-3 rounded-lg border border-border bg-bg-panel/60 p-4 text-left transition hover:border-sky-500 hover:bg-sky-500/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-base font-bold text-slate-100">{format.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DataRange() {
  const [startDate, setStartDate] = useState(toISODate(new Date()))
  const [endDate, setEndDate] = useState(toISODate(new Date()))
  const [searched, setSearched] = useState(false)
  const [records, setRecords] = useState([])
  const [materialReceipts, setMaterialReceipts] = useState([])
  const [materialWithdraws, setMaterialWithdraws] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const fetchHistory = async (start, end) => {
    setSearched(true)
    setLoading(true)
    setError(null)
    const params = { start: start.toISOString(), end: end.toISOString() }
    try {
      const [history, receipts, withdraws] = await Promise.all([
        api.getOEEHistory({ ...params, limit: 500 }),
        api.getMaterialReceipts(params),
        api.getMaterialWithdraws(params),
      ])
      setRecords(history.data || [])
      setMaterialReceipts(receipts.data || [])
      setMaterialWithdraws(withdraws.data || [])
    } catch (err) {
      setError(err.message)
      setRecords([])
      setMaterialReceipts([])
      setMaterialWithdraws([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    const start = new Date(startDate)
    const end = new Date(endDate + 'T23:59:59.999Z')
    fetchHistory(start, end)
  }

  const handleExportCSV = () => {
    if (!records.length) return
    const exportRows = buildExportRows(records)
    const csv = objectsToCSV(exportRows)
    const filename = `machine_data_${startDate}_to_${endDate}.csv`
    downloadBlob(csv, filename, 'text/csv')
  }

  const handleExportPDF = () => {
    if (!records.length) return

    try {
      const reportSummary = {
        oee: avg(records.map((r) => r.oee)),
        availability: avg(records.map((r) => r.availability)),
        performance: avg(records.map((r) => r.performance)),
        quality: avg(records.map((r) => r.quality)),
      }
      const trendRows = buildTrendRows(records)
      const productFlowRows = buildProductFlowRows(materialReceipts, materialWithdraws)
      const inboundTotal = productFlowRows.reduce((sum, row) => sum + row.inbound, 0)
      const outboundTotal = productFlowRows.reduce((sum, row) => sum + row.outbound, 0)
      const trendImage = createTrendChartImage(trendRows)
      const inboundPie = createPieChartImage(
        productFlowRows.map((row) => ({ label: row.product, value: row.inbound })),
        'Inbound by Product'
      )
      const outboundPie = createPieChartImage(
        productFlowRows.map((row) => ({ label: row.product, value: row.outbound })),
        'Outbound by Product'
      )
      const productTableImage = createProductFlowTableImage(productFlowRows)
      const generatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(15, 23, 42)
      doc.text('OEE', 14, 18)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Range: ${startDate} to ${endDate}`, 14, 26)
      doc.text(`Records: ${records.length}`, 14, 32)
      doc.text(`Generated: ${generatedAt}`, 120, 26)

      drawMetricCard(doc, 14, 40, 42, 30, 'OEE', `${formatNumber(reportSummary.oee)}%`, [14, 165, 233])
      drawMetricCard(doc, 61, 40, 42, 30, 'Availability', `${formatNumber(reportSummary.availability)}%`, [16, 185, 129])
      drawMetricCard(doc, 108, 40, 42, 30, 'Performance', `${formatNumber(reportSummary.performance)}%`, [245, 158, 11])
      drawMetricCard(doc, 155, 40, 42, 30, 'Quality', `${formatNumber(reportSummary.quality)}%`, [139, 92, 246])

      doc.addImage(trendImage, 'PNG', 14, 78, 182, 55)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text('Product Flow', 14, 145)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(`Inbound ${formatNumber(inboundTotal)} kg | Outbound ${formatNumber(outboundTotal)} kg`, 14, 151)
      doc.addImage(inboundPie, 'PNG', 14, 156, 88, 35)
      doc.addImage(outboundPie, 'PNG', 108, 156, 88, 35)
      if (productTableImage) {
        doc.addImage(productTableImage, 'PNG', 14, 198, 182, 93)
      }

      doc.save(`machine_data_${startDate}_to_${endDate}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('สร้าง PDF ไม่สำเร็จ: ' + (err.message || 'Unknown error'))
    }
  }

  const handleExportSelect = (format) => {
    setExportOpen(false)
    if (format === 'pdf') {
      handleExportPDF()
      return
    }
    handleExportCSV()
  }

  useEffect(() => {
    const start = new Date(startDate)
    const end = new Date(endDate + 'T23:59:59.999Z')
    fetchHistory(start, end)
  }, [])

  const summary = useMemo(() => {
    if (!records.length) return null
    return {
      oee: avg(records.map((r) => r.oee)),
      availability: avg(records.map((r) => r.availability)),
      performance: avg(records.map((r) => r.performance)),
      quality: avg(records.map((r) => r.quality)),
      good: records.reduce((a, r) => a + (r.goodUnits || 0), 0),
      total: records.reduce((a, r) => a + (r.totalUnits || 0), 0)
    }
  }, [records])

  return (
    <div className="min-h-screen p-8">
      <style>
        {`
          input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
          }
          input[type="date"]::-webkit-inner-spin-button,
          input[type="date"]::-webkit-clear-button {
            filter: invert(1);
          }
        `}
      </style>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-xl border border-border panel-sub p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Search className="h-8 w-8 text-sky-400" />
            ดูข้อมูลตามช่วงเวลา
          </h1>
          <p className="text-base text-slate-400 mt-2">เลือกช่วงวันที่ที่ต้องการดูข้อมูล</p>
        </div>

        {/* Date Range Form */}
        <div className="rounded-xl border border-border panel-sub p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">วันที่เริ่มต้น</label>
              <input
                className="w-full rounded-lg border border-border bg-bg-panel/80 px-4 py-3 text-base text-slate-100 font-mono outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">วันที่สิ้นสุด</label>
              <input
                className="w-full rounded-lg border border-border bg-bg-panel/80 px-4 py-3 text-base text-slate-100 font-mono outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleSearch}
                className="w-full max-w-xs rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-6 py-3 text-base font-bold text-white hover:from-sky-400 hover:to-indigo-400 transition shadow-lg shadow-sky-500/25"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {searched ? (
          <div className="space-y-6">
            {/* Summary Dashboard */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">OEE</div>
                  <div className="font-mono text-2xl font-bold text-sky-300">{summary.oee}%</div>
                </div>
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">Availability</div>
                  <div className="font-mono text-2xl font-bold text-emerald-300">{summary.availability}%</div>
                </div>
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">Performance</div>
                  <div className="font-mono text-2xl font-bold text-amber-300">{summary.performance}%</div>
                </div>
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">Quality</div>
                  <div className="font-mono text-2xl font-bold text-violet-300">{summary.quality}%</div>
                </div>
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">Good</div>
                  <div className="font-mono text-2xl font-bold text-emerald-300">{summary.good.toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-border panel-sub p-4 text-center shadow-xl">
                  <div className="text-xs text-slate-400 mb-1">Total</div>
                  <div className="font-mono text-2xl font-bold text-slate-300">{summary.total.toLocaleString()}</div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border panel-sub overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <p className="text-base text-slate-300">ผลลัพธ์การค้นหา: <span className="text-sky-300">{formatDateThai(startDate)}</span> ถึง <span className="text-sky-300">{formatDateThai(endDate)}</span> ({records.length} รายการ)</p>
                <button
                  onClick={() => setExportOpen(true)}
                  disabled={!records.length}
                  className="flex items-center gap-2 rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 px-4 py-2 text-sm font-bold text-white hover:from-sky-400 hover:to-indigo-400 transition shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  Export ข้อมูลช่วงเวลา
                </button>
              </div>
              {loading ? (
                <div className="text-center text-slate-400 py-10">กำลังโหลดข้อมูล...</div>
              ) : error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 m-4 text-red-300">โหลดข้อมูลไม่สำเร็จ: {error}</div>
              ) : records.length === 0 ? (
                <div className="text-center text-slate-400 py-10">ไม่พบข้อมูลในช่วงเวลาที่เลือก</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-card/50">
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Machine</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-400">Line</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">OEE%</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Avail%</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Perf%</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Qual%</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Good</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-400">Total</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row, i) => {
                        const status = row.status || 'stopped'
                        const config = statusConfig[status] || statusConfig.stopped
                        const date = row.timestamp ? new Date(row.timestamp).toLocaleDateString('th-TH') : '-'
                        return (
                          <tr key={row._id || i} className="border-b border-border/50 hover:bg-bg-card/30 transition">
                            <td className="px-4 py-3 font-mono text-slate-400">{date}</td>
                            <td className="px-4 py-3 font-semibold text-slate-100">{row.machine}</td>
                            <td className="px-4 py-3 text-slate-400">{row.line}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-sky-300">{row.oee}%</td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-300">{row.availability}%</td>
                            <td className="px-4 py-3 text-right font-mono text-amber-300">{row.performance}%</td>
                            <td className="px-4 py-3 text-right font-mono text-violet-300">{row.quality}%</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">{row.goodUnits}</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">{row.totalUnits}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${config.bg} ${config.text} ${config.border}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border panel-sub p-10 text-center shadow-xl">
            <div className="flex justify-center mb-4">
              <Search className="h-12 w-12 text-sky-400" />
            </div>
            <div className="text-lg font-bold text-slate-300">เลือกช่วงเวลาที่ต้องการ</div>
            <div className="text-sm text-slate-400 mt-1">กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด แล้วกดค้นหา</div>
          </div>
        )}
      </div>
      <ExportFormatModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onSelect={handleExportSelect}
      />
    </div>
  )
}
