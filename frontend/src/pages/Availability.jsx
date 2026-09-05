// Availability page from container - shows Availability by Machine and Shift Timeline
import { useState, useEffect } from 'react'
import { api } from '../services/api.js'
import { getStopTimeMinutes, getWorkingTimeMinutes } from '../utils/machineTime.js'

const statusDot = {
  running: { color: '#22c55e', glow: '0 0 5px #22c55e' },
  breakdown: { color: '#ef4444', glow: 'none' },
  stopped: { color: '#ef4444', glow: 'none' },
  warning: { color: '#f59e0b', glow: '0 0 5px #f59e0b' },
}

export default function Availability() {
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const res = await api.getMachines()
        if (cancelled) return
        setMachines(res.data || [])
      } catch (err) {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const machineAvailability = machines.map(m => ({
    name: m.name,
    percent: m.availability || 0,
    run: getWorkingTimeMinutes(m),
    stop: getStopTimeMinutes(m),
    total: getWorkingTimeMinutes(m) + getStopTimeMinutes(m),
    status: m.status || 'stopped',
  }))

  const shiftTimeline = machines.map(m => ({
    name: m.name,
    run: getWorkingTimeMinutes(m),
    stop: getStopTimeMinutes(m),
    segments: m.segments || [0, 0, 0, 0],
  }))

  const totalRun = machineAvailability.reduce((a, b) => a + b.run, 0)
  const totalDown = machineAvailability.reduce((a, b) => a + b.stop, 0)
  const factoryAvail = machineAvailability.length
    ? (machineAvailability.reduce((a, b) => a + b.percent, 0) / machineAvailability.length).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-3 max-w-[1440px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Availability by Machine */}
        <div className="xl:col-span-2">
          <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
            <div className="mb-3 flex items-center gap-2">
              <div className="section-head">⏱ Availability by Machine</div>
            </div>
            <div className="space-y-3">
              {machineAvailability.map((m) => {
                const dot = statusDot[m.status] || statusDot.stopped
                return (
                  <div key={m.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="inline-block w-[7px] h-[7px] rounded-full mr-1" style={{ background: dot.color, boxShadow: dot.glow }} />
                        <span>{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-300">{m.percent}%</span>
                        <span className="text-[11px] text-slate-400">Working {m.run} min / Stop {m.stop} min</span>
                      </div>
                    </div>
                    <div className="relative h-3 rounded bg-bg-panel/60 border border-border">
                      <div className="h-3 rounded bg-gradient-to-r from-emerald-700 to-emerald-400" style={{ width: `${m.percent}%` }} />
                      <div className="absolute -top-0.5 h-4 w-px bg-amber-400/60" style={{ left: '85%' }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">Yellow mark = 85% target</div>
          </section>
        </div>

        {/* Shift Timeline */}
        <div className="xl:col-span-1">
          <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
            <div className="mb-3 flex items-center gap-2">
              <div className="section-head">📋 Shift Timeline</div>
            </div>
            <div className="space-y-3">
              {shiftTimeline.map((s) => (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-slate-300">{s.name}</span>
                    <span className="font-mono text-emerald-300">{s.run} min work / {s.stop} min stop</span>
                  </div>
                  <div className="flex h-3 gap-1 overflow-hidden rounded">
                    <div className="rounded" style={{ flex: `${s.segments[0]} 1 0%`, background: '#165134' }} />
                    <div className="rounded" style={{ flex: `${s.segments[1]} 1 0%`, background: '#991b1b' }} />
                    <div className="rounded" style={{ flex: `${s.segments[2]} 1 0%`, background: '#165134' }} />
                    <div className="rounded" style={{ flex: `${s.segments[3]} 1 0%`, background: '#78350f' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded" style={{ background: '#165134' }} />
                Running
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded" style={{ background: '#991b1b' }} />
                Downtime
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded" style={{ background: '#78350f' }} />
                Idle
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-bg-panel/60 border border-border p-3">
              <div>
                <div className="text-[10px] text-slate-400">FACTORY AVAIL</div>
                <div className="font-mono text-lg font-bold text-sky-300">{factoryAvail}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">WORKING TIME</div>
                <div className="font-mono text-lg font-bold text-emerald-300">{totalRun} min</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">STOP TIME</div>
                <div className="font-mono text-lg font-bold text-red-300">{totalDown} min</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
