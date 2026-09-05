// Quality page from container - shows Quality Calculation, Quality by Machine, Defect Pareto, Quality Trends
import { useState, useEffect } from 'react'
import { api } from '../services/api.js'

// Trend sparkline component
function TrendSparkline() {
  return (
    <svg width="180" height="20" viewBox="0 0 180 20" preserveAspectRatio="xMidYMid meet">
      <line x1="0" x2="180" y1="10" y2="10" stroke="#f59e0b35" strokeWidth="1" strokeDasharray="2 2" />
      <polyline points="0,10 7.8,10 15.7,10 23.5,10 31.3,10 39.1,10 47,10 54.8,10 62.6,10 70.4,10 78.3,10 86.1,10 93.9,10 101.7,10 109.6,10 117.4,10 125.2,10 133,10 140.9,10 148.7,10 156.5,10 164.3,10 172.2,10 180,10" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="180" cy="10" r="2.5" fill="#a78bfa" />
    </svg>
  )
}

export default function Quality() {
  const [machines, setMachines] = useState([])
  const [summary, setSummary] = useState({})

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const [machinesRes, summaryRes] = await Promise.all([api.getMachines(), api.getSummary()])
        if (cancelled) return
        setMachines(machinesRes.data || [])
        setSummary(summaryRes.data || {})
      } catch (err) {
        // silently fail
      }
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const machineQuality = machines.map(m => {
    const good = m.goodUnits || 0
    const total = m.totalUnits || 0
    const percent = total > 0 ? Math.round((good / total) * 100) : 0
    return { name: m.name, good, total, percent, hasTrend: true }
  })

  const goodUnits = machineQuality.reduce((a, m) => a + m.good, 0)
  const totalUnits = machineQuality.reduce((a, m) => a + m.total, 0)
  const scrap = machineQuality.reduce((a, m) => a + (m.total - m.good), 0)
  const fpy = totalUnits > 0 ? ((goodUnits / totalUnits) * 100).toFixed(1) : '0.0'
  const scrapRate = totalUnits > 0 ? ((scrap / totalUnits) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-3 max-w-[1440px] mx-auto">
      {/* Quality Calculation Section */}
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="mb-3 flex items-center gap-2">
          <div className="section-head">✅ Quality Calculation — ISO 22400</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">FORMULA</div>
            <div className="mt-1 font-mono text-xs text-violet-200">Quality = Good Count / Total Count × 100</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">Good Units</div>
            <div className="mt-1 font-mono font-bold text-lg text-emerald-200">{goodUnits.toLocaleString()}</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">Total Units</div>
            <div className="mt-1 font-mono font-bold text-lg text-slate-200">{totalUnits.toLocaleString()}</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">Scrap</div>
            <div className="mt-1 font-mono font-bold text-lg text-red-200">{scrap}</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">FPY</div>
            <div className="mt-1 font-mono font-bold text-2xl text-violet-200">{fpy}%</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div className="text-[10px] text-slate-400">Scrap Rate</div>
            <div className="mt-1 font-mono font-bold text-2xl text-orange-200">{scrapRate}%</div>
          </div>
        </div>
      </section>

      {/* Three Column Grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Quality by Machine */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">🎯 Quality by Machine</div>
          </div>
          <div className="space-y-3">
            {machineQuality.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm text-slate-300">{m.name}</div>
                  <div className="font-mono text-xs">
                    <span className="text-emerald-200">{m.good}</span>
                    <span className="text-slate-400">/{m.total}</span>
                    <span className="ml-2 font-bold text-violet-200">{m.percent}%</span>
                  </div>
                </div>
                <div style={{ background: 'var(--color-bg-panel)', borderRadius: '3px', height: '5px', width: '100%', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <div style={{ height: '100%', width: `${m.percent}%`, background: m.percent === 100 ? '#22c55e' : '#f59e0b', borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Scrap by Machine */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">❌ Scrap by Machine</div>
          </div>
          <div className="space-y-3">
            {machineQuality.map((m) => {
              const scrapCount = m.total - m.good
              const scrapPct = scrap > 0 ? ((scrapCount / scrap) * 100).toFixed(0) : 0
              return (
                <div key={m.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm text-slate-300">{m.name}</div>
                    <div className="font-mono text-xs text-slate-200">
                      {scrapCount} <span className="text-slate-400">({scrapPct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 rounded bg-bg-panel/60 border border-border">
                    <div className="h-2 rounded" style={{ width: `${scrapPct}%`, background: scrapCount > 5 ? '#ef4444' : '#f59e0b' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-xl bg-bg-panel/60 border border-border p-3">
            <div className="text-[10px] text-slate-400">TOTAL SCRAP</div>
            <div className="font-mono text-2xl font-bold text-red-300">{scrap}</div>
          </div>
        </section>

        {/* Quality Trends */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">📈 Quality Trends</div>
          </div>
          <div className="space-y-3">
            {machineQuality.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm text-slate-300">{m.name}</div>
                  <div className="font-mono text-xs text-violet-200">{m.percent}%</div>
                </div>
                {m.hasTrend && <TrendSparkline />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
