export const PROCESS_RUNTIME_STORAGE_KEY = 'processMachineRuntimeCycles'
export const RUNTIME_TRIGGER_MACHINE_ID = 'ccp-magnet-1'

export const ZERO_RUNTIME = {
  workingTimeMinutes: 0,
  stopTimeMinutes: 0,
}

const MAX_STORED_CYCLES = 12

function readStorageJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorageJson(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function nonNegativeMinutes(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}

function machineRuntimeKey(machine = {}) {
  return String(machine.id || machine.name || '').trim()
}

export function statusIsRuntimeRunning(status) {
  if (status === true) return true
  if (status === false) return false
  return ['RUNNING', 'RUN', 'ON', 'ONLINE', 'TRUE'].includes(String(status || '').trim().toUpperCase())
}

export function getRuntimeMachineUnits(containers = []) {
  return containers.flatMap((container) => {
    const subMachines = Array.isArray(container.subMachines) ? container.subMachines : []
    if (subMachines.length > 0) return subMachines
    return [container]
  }).filter((machine) => machineRuntimeKey(machine))
}

export function findRuntimeTriggerUnit(containersByProcess = {}) {
  const allContainers = Object.values(containersByProcess).flat()
  return getRuntimeMachineUnits(allContainers).find((machine) => (
    machineRuntimeKey(machine) === RUNTIME_TRIGGER_MACHINE_ID
  )) || null
}

function getEntryDate(entry = {}) {
  const date = new Date(entry.date || entry.day || entry.createdAt || Date.now())
  return Number.isNaN(date.getTime()) ? null : date
}

function getEntryRange(entry = {}) {
  const day = getEntryDate(entry)
  if (!day) return null
  const startMinutes = nonNegativeMinutes(entry.startMinutes, 0)
  const rawEndMinutes = Number(entry.endMinutes)
  const endMinutes = Number.isFinite(rawEndMinutes) && rawEndMinutes > startMinutes
    ? Math.min(Math.round(rawEndMinutes), 24 * 60)
    : Math.min(startMinutes + 60, 24 * 60)
  const startAt = new Date(day)
  const endAt = new Date(day)
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  return { startAt, endAt, startMinutes, endMinutes }
}

export function getCurrentProductionCycle(entries = [], now = new Date()) {
  const active = entries
    .map((entry, index) => {
      const range = getEntryRange(entry)
      if (!range || now < range.startAt || now >= range.endAt) return null
      const product = String(entry.product || entry.name || '').trim()
      if (!product) return null
      const id = entry._id || entry.backendId || entry.id || entry.entryId
      const dateKey = range.startAt.toISOString().slice(0, 10)
      return {
        entry,
        product,
        key: id
          ? `entry:${id}`
          : `entry:${dateKey}:${range.startMinutes}:${range.endMinutes}:${product}:${index}`,
        startedAt: range.startAt,
        endsAt: range.endAt,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.startedAt - b.startedAt)

  return active[0] || null
}

function sanitizeStore(store = {}) {
  return {
    cycles: store.cycles && typeof store.cycles === 'object' ? store.cycles : {},
    maintenanceTotals: store.maintenanceTotals && typeof store.maintenanceTotals === 'object'
      ? store.maintenanceTotals
      : {},
  }
}

export function readProcessRuntimeStore() {
  return sanitizeStore(readStorageJson(PROCESS_RUNTIME_STORAGE_KEY, {}))
}

function pruneCycles(cycles = {}) {
  const entries = Object.entries(cycles)
    .sort(([, a], [, b]) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
  return Object.fromEntries(entries.slice(0, MAX_STORED_CYCLES))
}

export function updateProcessRuntimeStore(store, units, cycle, triggerRunning, at = new Date()) {
  const next = sanitizeStore(store)
  if (!cycle) {
    return next
  }

  const existingCycle = next.cycles[cycle.key]
  if (!existingCycle && !triggerRunning) {
    return next
  }

  const startedAt = new Date(cycle.startedAt)
  const lastUpdatedAt = existingCycle?.lastUpdatedAt
    ? new Date(existingCycle.lastUpdatedAt)
    : startedAt
  const safeLastUpdatedAt = Number.isNaN(lastUpdatedAt.getTime()) ? startedAt : lastUpdatedAt
  const deltaMinutes = Math.max(0, Math.floor((at.getTime() - safeLastUpdatedAt.getTime()) / 60000))

  const cycleState = {
    product: cycle.product,
    startedAt: startedAt.toISOString(),
    endsAt: cycle.endsAt?.toISOString?.() || existingCycle?.endsAt || '',
    lastUpdatedAt: at.toISOString(),
    machines: { ...(existingCycle?.machines || {}) },
  }
  const maintenanceTotals = { ...next.maintenanceTotals }

  units.forEach((machine) => {
    const key = machineRuntimeKey(machine)
    if (!key) return

    const current = cycleState.machines[key] || { ...ZERO_RUNTIME }
    const isRunning = statusIsRuntimeRunning(machine.status)
    const workingTimeMinutes = nonNegativeMinutes(current.workingTimeMinutes, 0)
    const stopTimeMinutes = nonNegativeMinutes(current.stopTimeMinutes, 0)
    const machineState = {
      workingTimeMinutes: isRunning ? workingTimeMinutes + deltaMinutes : workingTimeMinutes,
      stopTimeMinutes: isRunning ? stopTimeMinutes : stopTimeMinutes + deltaMinutes,
      lastStatus: isRunning ? 'RUNNING' : 'STOP',
      lastUpdatedAt: at.toISOString(),
    }
    cycleState.machines[key] = machineState

    if (isRunning && deltaMinutes > 0) {
      const maintenance = maintenanceTotals[key] || { workingMinutes: 0, workingHours: 0 }
      const workingMinutes = nonNegativeMinutes(maintenance.workingMinutes, 0) + deltaMinutes
      maintenanceTotals[key] = {
        workingMinutes,
        workingHours: Math.round((workingMinutes / 60) * 100) / 100,
        updatedAt: at.toISOString(),
      }
    }
  })

  return {
    cycles: pruneCycles({ ...next.cycles, [cycle.key]: cycleState }),
    maintenanceTotals,
  }
}

export function saveProcessRuntimeStore(store) {
  writeStorageJson(PROCESS_RUNTIME_STORAGE_KEY, sanitizeStore(store))
}

export function getRuntimeByMachineId(store, cycleKey) {
  const cycle = cycleKey ? sanitizeStore(store).cycles[cycleKey] : null
  if (!cycle?.machines) return {}

  return Object.fromEntries(Object.entries(cycle.machines).map(([key, runtime]) => ([
    key,
    {
      workingTimeMinutes: nonNegativeMinutes(runtime.workingTimeMinutes, 0),
      stopTimeMinutes: nonNegativeMinutes(runtime.stopTimeMinutes, 0),
    },
  ])))
}

export function getLatestRuntimeByMachineId(store) {
  const cycles = sanitizeStore(store).cycles
  const latestCycleKey = Object.entries(cycles)
    .sort(([, a], [, b]) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
    .map(([key]) => key)[0]

  return getRuntimeByMachineId(store, latestCycleKey)
}
