import { useEffect, useMemo, useState } from 'react'
import { Settings } from 'lucide-react'
import MachineControlModal from '../components/MachineControlModal'
import useNodeRedDashboard from '../hooks/useNodeRedDashboard'
import { api } from '../services/api.js'
import { getWorkingTimeMinutes } from '../utils/machineTime.js'
import {
  getLatestRuntimeByMachineId,
  getRuntimeMachineUnits,
  readProcessRuntimeStore,
} from '../utils/processRuntime.js'
import {
  getEffectiveProcessMachineContainers,
  processMachineContainerBoards,
} from './ProcessDetail.jsx'

const ICT_MINUTES_PER_UNIT = 0.5

const processMatchers = [
  { processId: 1, keywords: ['inbound', 'storage', 'input stock'] },
  { processId: 2, keywords: ['feeding', 'material', 'loadcell in'] },
  { processId: 3, keywords: ['sorting', 'cleaning'] },
  { processId: 4, keywords: ['loadcell out', 'outbound'] },
  { processId: 5, keywords: ['packaging', 'packing'] },
  { processId: 6, keywords: ['qc', 'dispatch', 'stock'] },
]

function numberOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function round1(value) {
  return Math.round(numberOr(value) * 10) / 10
}

function formatPercent(value) {
  return round1(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase()
}

function machineRuntimeKey(machine = {}) {
  return String(machine.id || machine.name || '').trim()
}

function resolveProcessId(machine = {}, index = 0) {
  const explicit = Number(machine.processId || machine.process || machine.processNo)
  if (Number.isFinite(explicit) && explicit > 0) return explicit

  const name = normalizeSearchText(machine.name || machine.machine || machine.label)
  const matched = processMatchers.find((item) => (
    item.keywords.some((keyword) => name.includes(keyword))
  ))

  return matched?.processId || index + 1
}

function statusIsRunning(status) {
  return ['running', 'run', 'on', 'online'].includes(normalizeSearchText(status))
}

function statusIsProblem(status) {
  return ['alert', 'alarm', 'warning', 'warn', 'breakdown', 'bre', 'fault', 'error'].includes(normalizeSearchText(status))
}

function getAggregateStatus(units = [], fallback = 'stopped') {
  if (units.some((unit) => statusIsProblem(unit.status))) return 'breakdown'
  if (units.some((unit) => statusIsRunning(unit.status))) return 'running'
  return units.length > 0 ? 'stopped' : fallback
}

function getProcessContainers(processId, nodeRedDashboard = null) {
  const containers = processMachineContainerBoards[processId] || []
  return getEffectiveProcessMachineContainers(processId, containers, nodeRedDashboard)
}

function getUnitRuntime(unit = {}, runtimeByMachineId = {}) {
  const key = machineRuntimeKey(unit)
  const storedRuntime = key ? runtimeByMachineId[key] : null

  if (storedRuntime) {
    return {
      workingTimeMinutes: numberOr(storedRuntime.workingTimeMinutes),
      stopTimeMinutes: numberOr(storedRuntime.stopTimeMinutes),
      hasRuntime: true,
    }
  }

  const hasWorking = unit.workingTimeMinutes !== undefined || unit.runTime !== undefined
  const hasStop = unit.stopTimeMinutes !== undefined

  return {
    workingTimeMinutes: numberOr(unit.workingTimeMinutes ?? unit.runTime),
    stopTimeMinutes: numberOr(unit.stopTimeMinutes),
    hasRuntime: hasWorking || hasStop,
  }
}

function getProcessRuntime(processId, runtimeByMachineId, nodeRedDashboard) {
  const containers = getProcessContainers(processId, nodeRedDashboard)
  const units = getRuntimeMachineUnits(containers)

  return units.reduce((summary, unit) => {
    const runtime = getUnitRuntime(unit, runtimeByMachineId)
    return {
      units,
      machineCount: units.length,
      status: summary.status,
      workingTimeMinutes: summary.workingTimeMinutes + runtime.workingTimeMinutes,
      stopTimeMinutes: summary.stopTimeMinutes + runtime.stopTimeMinutes,
      hasRuntime: summary.hasRuntime || runtime.hasRuntime,
    }
  }, {
    units,
    machineCount: units.length,
    status: getAggregateStatus(units),
    workingTimeMinutes: 0,
    stopTimeMinutes: 0,
    hasRuntime: false,
  })
}

function buildProcessPerformanceCard(machine, index, runtimeByMachineId, nodeRedDashboard) {
  const processId = resolveProcessId(machine, index)
  const processRuntime = getProcessRuntime(processId, runtimeByMachineId, nodeRedDashboard)
  const fallbackWorkingTime = getWorkingTimeMinutes(machine)
  const workingTimeMinutes = processRuntime.hasRuntime
    ? processRuntime.workingTimeMinutes
    : fallbackWorkingTime
  const count = numberOr(machine.totalUnits ?? machine.total ?? machine.outputUnits)
  const calculatedPerformance = workingTimeMinutes > 0
    ? (ICT_MINUTES_PER_UNIT * count) / workingTimeMinutes * 100
    : 0
  const performance = workingTimeMinutes > 0 || processRuntime.hasRuntime
    ? calculatedPerformance
    : numberOr(machine.performance)

  return {
    ...machine,
    processId,
    processMachineCount: processRuntime.machineCount,
    sourceUnits: processRuntime.units,
    name: machine.name || `Process ${processId}`,
    line: machine.line || '',
    status: getAggregateStatus(processRuntime.units, machine.status),
    count,
    workingTimeMinutes,
    stopTimeMinutes: processRuntime.hasRuntime
      ? processRuntime.stopTimeMinutes
      : numberOr(machine.stopTimeMinutes),
    performance,
    calculatedPerformance,
    oee: numberOr(machine.oee),
  }
}

function PerformanceGauge({ value, target = 85 }) {
  const r = 30
  const c = 2 * Math.PI * r
  const gaugeValue = Math.min(100, Math.max(0, numberOr(value)))
  const dashVal = (gaugeValue / 100) * c * 0.75
  const dashEmpty = c * 0.75 - dashVal
  const valueAngle = -225 + (gaugeValue / 100) * 270

  return (
    <svg width="78" height="78" viewBox="0 0 78 78">
      <circle cx="39" cy="39" r={r} fill="none" stroke="var(--color-border)" strokeWidth="7" strokeDasharray={`${c * 0.75} ${c * 0.25}`} strokeLinecap="round" transform="rotate(-225 39 39)" />
      <circle cx="39" cy="39" r={r} fill="none" stroke="#f59e0b" strokeWidth="7" strokeDasharray={`${dashVal} ${dashEmpty}`} strokeLinecap="round" transform="rotate(-225 39 39)" style={{ transition: 'stroke-dasharray 0.7s' }} />
      <line x1="39" y1="20" x2="39" y2="14" stroke="#f59e0b70" strokeWidth="2" strokeLinecap="round" transform={`rotate(${valueAngle + 225} 39 39)`} />
      <text x="39" y="44" textAnchor="middle" fill="var(--color-text-primary)" fontSize="12" fontWeight="700" fontFamily="monospace">{formatPercent(value)}%</text>
      <text x="39" y="55" textAnchor="middle" fill="rgba(148,163,184,0.7)" fontSize="7" fontFamily="sans-serif">TGT {target}%</text>
    </svg>
  )
}

function Sparkline() {
  return (
    <svg width="90" height="26" viewBox="0 0 90 26" preserveAspectRatio="xMidYMid meet">
      <polyline points="0,13 3.9,13 7.8,13 11.7,13 15.7,13 19.6,13 23.5,13 27.4,13 31.3,13 35.2,13 39.1,13 43,13 47,13 50.9,13 54.8,13 58.7,13 62.6,13 66.5,13 70.4,13 74.3,13 78.3,13 82.2,13 86.1,13 90,13" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="90" cy="13" r="2.5" fill="#f59e0b" />
    </svg>
  )
}

export default function Performance() {
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [machines, setMachines] = useState([])
  const [summary, setSummary] = useState({})
  const [runtimeStore, setRuntimeStore] = useState(() => readProcessRuntimeStore())
  const { dashboard: nodeRedDashboard } = useNodeRedDashboard()

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const [machinesRes, summaryRes] = await Promise.all([api.getMachines(), api.getSummary()])
        if (cancelled) return
        setMachines(machinesRes.data || [])
        setSummary(summaryRes.data || {})
      } catch (err) {
        // Keep the last known dashboard values if the API is temporarily unavailable.
      }
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  useEffect(() => {
    const syncRuntimeStore = () => setRuntimeStore(readProcessRuntimeStore())
    syncRuntimeStore()
    const timer = setInterval(syncRuntimeStore, 5000)
    window.addEventListener('storage', syncRuntimeStore)
    return () => {
      clearInterval(timer)
      window.removeEventListener('storage', syncRuntimeStore)
    }
  }, [])

  const runtimeByMachineId = useMemo(
    () => getLatestRuntimeByMachineId(runtimeStore),
    [runtimeStore]
  )
  const processCards = useMemo(
    () => machines.map((machine, index) => (
      buildProcessPerformanceCard(machine, index, runtimeByMachineId, nodeRedDashboard)
    )),
    [machines, runtimeByMachineId, nodeRedDashboard]
  )

  const totalCount = processCards.reduce((a, m) => a + m.count, 0)
  const totalRunTime = processCards.reduce((a, m) => a + m.workingTimeMinutes, 0)
  const overallPerformance = totalRunTime > 0
    ? (ICT_MINUTES_PER_UNIT * totalCount) / totalRunTime * 100
    : numberOr(summary.performance)
  const overallOEE = numberOr(summary.oee)

  return (
    <div className="space-y-3 max-w-[1440px] mx-auto">
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="mb-3 flex items-center gap-2">
          <div className="section-head">Performance Calculation - ISO 22400</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">FORMULA</div>
            <div className="mt-1 font-mono text-xs text-amber-200">Perf = (ICT x Count) / Working time x 100</div>
            <div className="mt-1 text-[11px] text-slate-400">ICT = Ideal Cycle Time = 0.5 min/unit</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">Ideal CT</div>
            <div className="mt-1 font-mono font-bold text-lg text-sky-200">{ICT_MINUTES_PER_UNIT} min/unit</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">Total Count</div>
            <div className="mt-1 font-mono font-bold text-lg text-amber-200">{totalCount.toLocaleString()}</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">Working time</div>
            <div className="mt-1 font-mono font-bold text-lg text-emerald-200">{totalRunTime.toLocaleString()} min</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">Performance</div>
            <div className="mt-1 font-mono font-bold text-2xl text-amber-200">{formatPercent(overallPerformance)}%</div>
          </div>
          <div className="w-full sm:min-w-[140px] flex-1 rounded-xl bg-bg-panel/70 border border-border p-3">
            <div className="text-[10px] text-slate-400">OEE</div>
            <div className="mt-1 font-mono font-bold text-2xl text-sky-200">{formatPercent(overallOEE)}%</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {processCards.map((m) => (
          <section key={`${m.processId}-${m.name}`} className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
            <div className="mb-3 flex items-center gap-2">
              <div className="section-head">{m.name} - Line {m.line}</div>
            </div>
            <div className="flex items-center gap-3">
              <PerformanceGauge value={m.performance} />
              <div>
                <div className="text-[11px] text-slate-400">Performance</div>
                <div className="font-mono text-2xl font-extrabold text-amber-300">{formatPercent(m.performance)}%</div>
                <Sparkline />
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-bg-panel/70 border border-border p-3 font-mono text-xs text-slate-300">
              <div className="text-[10px] text-slate-400">CALCULATION</div>
              <div className="mt-2 space-y-1">
                <div>ICT x Count = <span className="text-amber-200">{ICT_MINUTES_PER_UNIT} x {m.count.toLocaleString()} = {(ICT_MINUTES_PER_UNIT * m.count).toFixed(0)} min</span></div>
                <div>/ Working time = <span className="text-emerald-200">{m.workingTimeMinutes.toLocaleString()} min</span></div>
                <div className="mt-2 border-t border-border pt-2">= <span className="text-sm font-bold text-amber-200">{formatPercent(m.calculatedPerformance)}%</span></div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Output</span>
                <span className="font-mono text-slate-200">{m.count.toLocaleString()} units</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Working time</span>
                <span className="font-mono text-emerald-200">{m.workingTimeMinutes.toLocaleString()} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">OEE</span>
                <span className="font-mono text-sky-200">{formatPercent(m.oee)}%</span>
              </div>
            </div>
            <button onClick={() => setSelectedMachine(m)} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/20">
              <Settings size={13} strokeWidth={2.4} />
              Control Panel
            </button>
          </section>
        ))}
      </div>
      {selectedMachine && (
        <MachineControlModal
          machine={selectedMachine}
          onClose={() => setSelectedMachine(null)}
          showRuntime
        />
      )}
    </div>
  )
}
