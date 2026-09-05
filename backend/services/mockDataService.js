// ── In-Memory Live Mock Data Generator ──────────────────────────

const machines = [
  { name: 'Inbound & Storage', line: 'A', oee: 78.1, availability: 99, performance: 79, quality: 100, goodUnits: 750, totalUnits: 751, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, workingHours: 0, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
  { name: 'Feeding / Material Handling', line: 'A', oee: 64.9, availability: 86, performance: 76, quality: 100, goodUnits: 623, totalUnits: 625, scrapUnits: 2, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, workingHours: 0, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
  { name: 'Sorting & Cleaning', line: 'B', oee: 39.2, availability: 52, performance: 81, quality: 93, goodUnits: 377, totalUnits: 405, scrapUnits: 28, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, workingHours: 0, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
  { name: 'Packaging', line: 'B', oee: 81.1, availability: 99, performance: 82, quality: 100, goodUnits: 778, totalUnits: 779, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, workingHours: 0, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
  { name: 'QC & Dispatch', line: 'C', oee: 60.2, availability: 93, performance: 65, quality: 100, goodUnits: 578, totalUnits: 579, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, workingHours: 0, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' }
]

const losses = [
  { name: 'Breakdowns', category: 'Availability', value: 5.4, color: '#ef4444', width: 16.2 },
  { name: 'Changeover', category: 'Availability', value: 3.7, color: '#f97316', width: 11.1 },
  { name: 'Small Stops', category: 'Performance', value: 12.9, color: '#f59e0b', width: 38.7 },
  { name: 'Reduced Speed', category: 'Performance', value: 10.5, color: '#eab308', width: 31.5 },
  { name: 'Startup Rejects', category: 'Quality', value: 0.8, color: '#a78bfa', width: 2.4 },
  { name: 'Prod. Rejects', category: 'Quality', value: 0.7, color: '#8b5cf6', width: 2.1 }
]

const alerts = [
  { severity: 'CRITICAL', color: 'border-red-500', bg: 'bg-red-950/20', text: 'text-red-200', title: '🚨 Sorting & Cleaning — Breakdown', desc: 'OEE:39.2% Avail:52%' },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ Feeding / Material Handling — Low OEE (64.9%)', desc: 'Avail:86% Perf:76% Qual:100%' },
  { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Inbound & Storage — Status Update', desc: 'Status:stopped OEE:78.1% Good:750/751' },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ QC & Dispatch — Low OEE (60.2%)', desc: 'Avail:93% Perf:65% Qual:100%' },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '🧪 Sorting & Cleaning — Quality below 95% (93%)', desc: 'Scrap:28 units' },
  { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Packaging — Status Update', desc: 'Status:stopped OEE:81.1% Good:778/779' }
]

let lastRuntimeTickAt = Date.now()

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function jitter(base, range = 2) {
  return clamp(base + (Math.random() - 0.5) * range * 2, 0, 100)
}

function toStoppedMachine(machine) {
  const totalTime = Math.max(0, Math.round(machine.totalTime ?? machine.workingTimeMinutes ?? machine.runTime ?? 0))
  return {
    ...machine,
    status: 'stopped',
    runTime: 0,
    workingTimeMinutes: 0,
    stopTimeMinutes: totalTime,
    borderColor: 'rgba(239,68,68,0.5)',
    bgColor: 'rgba(239,68,68,0.25)',
    shadow: 'rgba(239,68,68,0.3)',
  }
}

function updateSummaryFromMachines() {
  const totalGood = machines.reduce((s, m) => s + m.goodUnits, 0)
  const totalUnits = machines.reduce((s, m) => s + m.totalUnits, 0)
  const totalScrap = machines.reduce((s, m) => s + m.scrapUnits, 0)

  const avgAvail = machines.reduce((s, m) => s + m.availability, 0) / machines.length
  const avgPerf = machines.reduce((s, m) => s + m.performance, 0) / machines.length
  const avgQual = machines.reduce((s, m) => s + m.quality, 0) / machines.length
  const oee = clamp((avgAvail * avgPerf * avgQual) / 10000, 0, 100)

  return {
    oee: Math.round(oee * 10) / 10,
    availability: Math.round(avgAvail * 10) / 10,
    performance: Math.round(avgPerf * 10) / 10,
    quality: Math.round(avgQual * 10) / 10,
    totalProduction: totalUnits,
    downtime: Math.round((100 - avgAvail) * 24),
    targetOee: 85.0,
    goodUnits: totalGood,
    scrapUnits: totalScrap,
    lastUpdated: new Date().toISOString()
  }
}

function tick() {
  const tickedAt = Date.now()
  const elapsedMinutes = Math.max(0, Math.floor((tickedAt - lastRuntimeTickAt) / 60000))

  // Randomly mutate each machine
  machines.forEach(m => {
    if (m.status === 'breakdown') {
      // Slow recovery
      m.availability = clamp(m.availability + (Math.random() - 0.3), 0, 100)
      if (m.availability > 80) {
        m.status = 'running'
        m.borderColor = 'rgba(34,197,94,0.5)'
        m.bgColor = 'rgba(34,197,94,0.25)'
        m.shadow = 'rgba(34,197,94,0.3)'
      }
    } else {
      m.availability = jitter(m.availability, 1.5)
      m.performance = jitter(m.performance, 1.5)
      m.quality = clamp(jitter(m.quality, 0.5), 85, 100)

      // Occasional breakdown
      if (m.availability < 55 && Math.random() > 0.7) {
        m.status = 'breakdown'
        m.borderColor = 'rgba(239,68,68,0.5)'
        m.bgColor = 'rgba(239,68,68,0.25)'
        m.shadow = 'rgba(239,68,68,0.3)'
      }
    }

    // Recalculate OEE
    m.oee = Math.round((m.availability * m.performance * m.quality) / 10000 * 10) / 10

    // Recalculate units (very rough mock)
    m.goodUnits = Math.round(m.goodUnits * (0.99 + Math.random() * 0.02))
    m.totalUnits = Math.round(m.goodUnits / (m.quality / 100)) || m.goodUnits + 1
    m.scrapUnits = m.totalUnits - m.goodUnits
    m.workingTimeMinutes = Math.max(0, Math.round(m.workingTimeMinutes ?? m.runTime ?? 0))
    m.stopTimeMinutes = Math.max(0, Math.round(m.stopTimeMinutes ?? ((m.totalTime ?? 480) - m.workingTimeMinutes)))
    m.runTime = m.workingTimeMinutes
    m.totalTime = m.workingTimeMinutes + m.stopTimeMinutes
    m.maintenanceWorkingMinutes = Math.max(0, Math.round(m.maintenanceWorkingMinutes ?? ((m.workingHours ?? 0) * 60)))
    if (m.status === 'running' && elapsedMinutes > 0) {
      m.maintenanceWorkingMinutes += elapsedMinutes
    }
    m.workingHours = Math.round((m.maintenanceWorkingMinutes / 60) * 100) / 100
  })
  lastRuntimeTickAt = tickedAt

  // Update losses slightly
  losses.forEach(l => {
    l.value = clamp(l.value + (Math.random() - 0.5) * 0.5, 0, 30)
    l.width = l.value * 3
  })
}

let intervalId = null

export function startMocking(intervalMs = 3000) {
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(tick, intervalMs)
  console.log(`[MockData] Live generator started (${intervalMs}ms)`)
}

export function stopMocking() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function getMachines() {
  return machines.map(m => toStoppedMachine(m))
}

export function getLosses() {
  return losses.map(l => ({ ...l }))
}

export function getAlerts() {
  return alerts.map(a => ({ ...a }))
}

export function clearAlerts() {
  const deletedCount = alerts.length
  alerts.length = 0
  return deletedCount
}

export function getSummary() {
  return updateSummaryFromMachines()
}
