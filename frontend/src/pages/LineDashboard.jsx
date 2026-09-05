import { useEffect, useState } from 'react'
import { Monitor, Activity, Clock, Package } from 'lucide-react'
import { api } from '../services/api.js'

// ── Inline SVG Gauge ──────────────────────────────────────────────
function GaugeSVG({ value, color, size = 90 }) {
  const r = size * 0.32
  const c = 2 * Math.PI * r
  const dashVal = (value / 100) * c * 0.75
  const dashEmpty = c * 0.75 - dashVal
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth={size * 0.09}
        strokeDasharray={`${c * 0.75} ${c * 0.25}`} strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
        strokeDasharray={`${dashVal} ${dashEmpty}`} strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.7s' }} />
      <text x={cx} y={cy + size * 0.05} textAnchor="middle" fill="var(--color-text-primary)" fontSize={size * 0.18} fontWeight="700" fontFamily="monospace">{typeof value === 'number' ? value.toFixed(1) : value}%</text>
    </svg>
  )
}

const statusConfig = {
  running: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'running' },
  stopped: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'stopped' },
  breakdown: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'breakdown' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'warning' },
  idle: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'warning' },
}

export default function LineDashboard() {
  const [machines, setMachines] = useState([])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const res = await api.getMachines()
        if (cancelled) return
        setMachines(res.data || [])
      } catch (err) {
        // silently fail
      }
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const lines = machines.map((m, i) => ({
    id: m.line || String.fromCharCode(65 + i),
    name: m.name,
    status: m.status || 'stopped',
    oee: m.oee || 0,
    availability: m.availability || 0,
    performance: m.performance || 0,
    quality: m.quality || 0,
    good: m.goodUnits || 0,
    total: m.totalUnits || 0,
  }))
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Line Dashboard</h1>
        <p className="text-xs text-text-muted mt-1">Real-time line status and OEE by production line</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lines.map((line) => {
          const config = statusConfig[line.status] || statusConfig.stopped
          return (
            <div key={line.id} className="bg-bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-muted">LINE {line.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${config.bg} ${config.color} border ${config.border}`}>
                    {config.label}
                  </span>
                </div>
                <span className="text-xs text-text-muted">{line.name}</span>
              </div>

              <div className="flex items-center gap-4">
                <GaugeSVG value={line.oee} color={line.status === 'stopped' ? '#ef4444' : '#06b6d4'} size={90} />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">OEE</span>
                    <span className="text-cyan font-bold">{line.oee}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Availability</span>
                    <span className="text-green-400 font-bold">{line.availability}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Performance</span>
                    <span className="text-amber-400 font-bold">{line.performance}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Quality</span>
                    <span className="text-purple font-bold">{line.quality}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-text-muted">
                <span>Good: <span className="text-green-400 font-bold">{line.good}</span> / {line.total}</span>
                <span>Scrap: <span className="text-red-400 font-bold">{line.total - line.good}</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
