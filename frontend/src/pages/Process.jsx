import { useState, useEffect } from 'react'
import { Link } from '../router.jsx'
import MachineControlModal from '../components/MachineControlModal'
import { api } from '../services/api.js'
import { getPublicRuntime } from '../utils/machineTime.js'

const statusDot = {
  RUNNING: { color: '#22c55e', glow: '0 0 5px #22c55e' },
  STOP: { color: '#ef4444', glow: 'none' },
  ALARM: { color: '#f59e0b', glow: '0 0 5px #f59e0b' },
}

function processStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase()
  if (['running', 'run'].includes(value)) return 'RUNNING'
  if (['alarm', 'breakdown', 'bre', 'fault', 'error'].includes(value)) return 'ALARM'
  return 'STOP'
}

function statusTextClass(status) {
  if (status === 'RUNNING') return 'text-emerald-300'
  if (status === 'ALARM') return 'text-amber-300'
  return 'text-red-300'
}

function oeeColorClass(oee) {
  const v = typeof oee === 'number' ? oee : parseFloat(oee)
  if (isNaN(v)) return 'text-red-300'
  if (v >= 80) return 'text-emerald-300'
  if (v >= 60) return 'text-amber-300'
  return 'text-red-300'
}

export default function Process() {
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [machines, setMachines] = useState([])
  const [losses, setLosses] = useState([])

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const [machinesRes, lossesRes] = await Promise.all([api.getMachines(), api.getLosses()])
        if (cancelled) return
        setMachines(machinesRes.data || [])
        setLosses(lossesRes.data || [])
      } catch (err) {
        // silently fail
      }
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const equipmentData = machines.map(m => ({
    name: m.name,
    line: m.line || 'A',
    oee: m.oee || 0,
    avail: m.availability || 0,
    perf: m.performance || 0,
    qual: m.quality || 0,
    good: m.goodUnits || 0,
    total: m.totalUnits || 0,
    rawStatus: m.status || 'stopped',
    status: processStatusLabel(m.status || 'stopped'),
    ...getPublicRuntime(m),
  }))

  const processItems = losses.map((l, i) => ({
    id: i + 1,
    name: l.name || l.category || `Loss ${i + 1}`,
    minutes: l.minutes || l.duration || 0,
    percentage: l.percentage || 0,
    color: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'][i % 5],
  }))

  const totalDowntime = processItems.reduce((a, b) => a + b.minutes, 0)
  const totalRunTime = equipmentData.reduce((a, m) => a + (m.workingTimeMinutes || 0), 0)

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Process Pareto */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <span className="section-head">📊 Process Pareto</span>
          </div>
          <div className="space-y-3">
            {processItems.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between">
                  <Link
                    to={`/process/${item.id}`}
                    className="text-sm text-slate-300 hover:text-sky-300 hover:underline transition-colors"
                  >
                    {item.name}
                  </Link>
                  <div className="font-mono text-sm text-slate-200">
                    {item.minutes}m <span className="text-slate-400">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="h-2 rounded bg-bg-panel/60 border border-border">
                  <div className="h-2 rounded" style={{ width: `${item.percentage}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-bg-panel/70 border border-border p-3">
              <div className="text-[10px] text-slate-400">TOTAL DOWNTIME</div>
              <div className="font-mono text-xl font-bold text-red-300">{totalDowntime}m</div>
              <div className="text-[11px] text-slate-400">14% of planned</div>
            </div>
            <div className="rounded-xl bg-bg-panel/70 border border-border p-3">
              <div className="text-[10px] text-slate-400">TOTAL WORKING TIME</div>
              <div className="font-mono text-xl font-bold text-emerald-300">{totalRunTime} min</div>
              <div className="text-[11px] text-slate-400">86% utilised</div>
            </div>
          </div>
        </section>

        {/* Equipment Live Table */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <span className="section-head">📋 Equipment Live Table</span>
            <span className="ml-auto text-[11px] text-slate-400">คลิก ⚙ เพื่อควบคุม</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] text-slate-400">
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Machine</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">L</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">OEE</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Avail</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Perf</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Qual</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Good</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Total</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Working</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Stop</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium">Status</th>
                  <th className="border-b border-border bg-bg-panel/40 px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {equipmentData.map((eq) => {
                  const dot = statusDot[eq.status] || statusDot.STOP
                  return (
                    <tr key={eq.name} className="border-b border-border/70 hover:bg-bg-panel/30">
                      <td className="px-2 py-2 font-semibold">
                        <button onClick={() => setSelectedMachine(eq)} className="hover:underline text-slate-300">{eq.name}</button>
                      </td>
                      <td className="px-2 py-2 text-slate-400">{eq.line}</td>
                      <td className={`px-2 py-2 font-mono font-bold ${oeeColorClass(eq.oee)}`}>{typeof eq.oee === 'number' ? eq.oee.toFixed(1) : eq.oee}%</td>
                      <td className="px-2 py-2 font-mono text-emerald-300">{typeof eq.avail === 'number' ? eq.avail.toFixed(0) : eq.avail}%</td>
                      <td className="px-2 py-2 font-mono text-amber-300">{typeof eq.perf === 'number' ? eq.perf.toFixed(0) : eq.perf}%</td>
                      <td className="px-2 py-2 font-mono text-violet-300">{typeof eq.qual === 'number' ? eq.qual.toFixed(0) : eq.qual}%</td>
                      <td className="px-2 py-2 font-mono text-emerald-200">{eq.good}</td>
                      <td className="px-2 py-2 font-mono text-slate-200">{eq.total}</td>
                      <td className="px-2 py-2 font-mono text-emerald-200">{eq.workingTimeMinutes} min</td>
                      <td className="px-2 py-2 font-mono text-rose-200">{eq.stopTimeMinutes} min</td>
                      <td className="px-2 py-2 text-slate-300">
                        <span className="inline-block w-[7px] h-[7px] rounded-full mr-1" style={{ background: dot.color, boxShadow: dot.glow }} />
                        <span className={`text-[11px] font-bold ${statusTextClass(eq.status)}`}>{eq.status}</span>
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => setSelectedMachine(eq)} className="rounded-md border border-border bg-bg-panel/50 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200">⚙</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {selectedMachine && <MachineControlModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} showRuntime />}
    </div>
  )
}
