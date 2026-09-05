const NODE_RED_DASHBOARD_URL = process.env.NODE_RED_DASHBOARD_URL || 'https://thaiha-oee-nodered.fostec-energy.net/api/dashboard'
const NODE_RED_DASHBOARD_TIMEOUT_MS = Number(process.env.NODE_RED_DASHBOARD_TIMEOUT_MS) || 5000
const PACKAGING_RUNNING_POWER_KW = Number(process.env.PACKAGING_RUNNING_POWER_KW) || 1

const metricNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

const hasStatusValue = (value) => (
  typeof value === 'boolean' || (value !== undefined && value !== null && String(value).trim() !== '')
)

const readMetric = (item = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      return metricNumber(item[key], fallback)
    }
  }

  const metrics = Array.isArray(item.metrics) ? item.metrics : []
  for (const key of keys) {
    const metric = metrics.find((entry) => entry && Object.prototype.hasOwnProperty.call(entry, key))
    if (metric) return metricNumber(metric[key], fallback)
  }

  return fallback
}

const readTimestamp = (item = {}) => (
  item.recorded_at ||
  item.recordedAt ||
  item.timestamp ||
  item.time ||
  item.datetime ||
  null
)

export const normalizeNodeRedStatus = (status) => {
  if (!hasStatusValue(status)) return { value: 'OFF', isOnline: false, hasStatus: false }
  if (status === true) return { value: 'Online', isOnline: true, hasStatus: true }
  if (status === false) return { value: 'Offline', isOnline: false, hasStatus: true }

  const value = String(status || '').trim()
  const upper = value.toUpperCase()
  if (['ON', 'ONLINE', 'RUN', 'RUNNING', 'TRUE'].includes(upper)) {
    return { value: value || 'Online', isOnline: true, hasStatus: true }
  }
  if (['OFF', 'OFFLINE', 'STOP', 'STOPPED', 'FALSE', 'ALARM', 'ERROR', 'FAULT'].includes(upper)) {
    return { value: value || 'Offline', isOnline: false, hasStatus: true }
  }
  return { value: value || 'OFF', isOnline: false, hasStatus: true }
}

const normalizePackagingStatus = (status, powerKw = 0) => {
  const power = metricNumber(powerKw)
  if (!hasStatusValue(status)) return { value: 'DISCONNECT', isOnline: false, state: 'disconnect', hasStatus: false }
  if (status === false) return { value: 'DISCONNECT', isOnline: false, state: 'disconnect', hasStatus: true }

  const value = String(status || '').trim()
  const upper = value.toUpperCase()
  if (['FALSE', 'OFF', 'OFFLINE', 'DISCONNECT', 'DISCONNECTED'].includes(upper)) {
    return { value: 'DISCONNECT', isOnline: false, state: 'disconnect', hasStatus: true }
  }

  if (status === true || ['TRUE', 'ON', 'ONLINE', 'RUN', 'RUNNING', 'STANDBY', 'STANBY'].includes(upper)) {
    return power > PACKAGING_RUNNING_POWER_KW
      ? { value: 'RUNNING', isOnline: true, state: 'running', hasStatus: true }
      : { value: 'STANDBY', isOnline: true, state: 'standby', hasStatus: true }
  }
  if (['ALARM', 'BREAKDOWN', 'BRE', 'FAULT', 'ERROR'].includes(upper)) {
    return { value: 'ALARM', isOnline: false, state: 'alarm', hasStatus: true }
  }
  if (['ALERT', 'WARNING', 'WARN'].includes(upper)) {
    return { value: 'ALERT', isOnline: true, state: 'alert', hasStatus: true }
  }

  return { value: 'DISCONNECT', isOnline: false, state: 'disconnect', hasStatus: true }
}

const normalizeLoadcell = (item = {}, direction = 'in') => {
  const status = normalizeNodeRedStatus(item.status)
  const isInput = direction === 'in'
  return {
    id: item.id || `lc-${direction}`,
    name: item.name || `Loadcell ${direction.toUpperCase()}`,
    status: status.value,
    isOnline: status.isOnline,
    hasStatus: status.hasStatus,
    current: metricNumber(item[isInput ? 'weight_input' : 'weight_output']),
    maximum: metricNumber(item[isInput ? 'input_maximum' : 'output_maximum']),
    total: metricNumber(item[isInput ? 'input_total' : 'output_total']),
    workingTimeMinutes: readMetric(item, ['working_time', 'woring_time']),
    stopTimeMinutes: readMetric(item, ['stop_time']),
    recordedAt: readTimestamp(item),
    raw: item,
  }
}

const normalizePackagingItem = (item = {}, index = 0) => {
  const powerKw = readMetric(item, ['power_kw'])
  const status = normalizePackagingStatus(item.status, powerKw)
  return {
    id: item.id || `pkg-${index + 1}`,
    name: item.name || `Packaging ${index + 1}`,
    status: status.value,
    state: status.state,
    rawStatus: item.status,
    isOnline: status.isOnline,
    hasStatus: status.hasStatus,
    powerKw,
    powerKwh: readMetric(item, ['power_kwh']),
    runningPowerThresholdKw: PACKAGING_RUNNING_POWER_KW,
    workingTimeMinutes: readMetric(item, ['working_time', 'woring_time']),
    stopTimeMinutes: readMetric(item, ['stop_time']),
    metrics: Array.isArray(item.metrics) ? item.metrics : [],
    recordedAt: readTimestamp(item),
    raw: item,
  }
}

const normalizeInputStockMachineGroup = (item = {}) => {
  const groupId = String(item.id || '').trim().toUpperCase()
  const fieldPrefix = groupId.toLowerCase()
  const displayPrefix = groupId === 'RM' ? 'R' : groupId === 'TM' ? 'T' : ''
  if (!fieldPrefix || !displayPrefix) return []

  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1
    const rawStatus = item[`${fieldPrefix}${number}_status`]
    const status = normalizeNodeRedStatus(rawStatus)
    return {
      id: `${displayPrefix}${number}`,
      name: `${displayPrefix}${number}`,
      status: status.value,
      rawStatus,
      isOnline: status.isOnline,
      hasStatus: status.hasStatus,
      powerKw: readMetric(item, [`${fieldPrefix}${number}_power_kw`]),
      recordedAt: readTimestamp(item),
      raw: item,
    }
  })
}

export const normalizeNodeRedDashboard = (raw = {}) => {
  const loadcellInItems = Array.isArray(raw.loadcell?.in) ? raw.loadcell.in : raw.loadcell_in
  const loadcellOutItems = Array.isArray(raw.loadcell?.out) ? raw.loadcell.out : raw.loadcell_out
  const loadcellIn = Array.isArray(loadcellInItems) ? loadcellInItems[0] : null
  const loadcellOut = Array.isArray(loadcellOutItems) ? loadcellOutItems[0] : null
  const packaging = Array.isArray(raw.packaging) ? raw.packaging : []
  const machines = Array.isArray(raw.machines) ? raw.machines : raw.input_stock
  const machineGroups = Array.isArray(machines) ? machines : []

  return {
    updatedAt: new Date().toISOString(),
    source: NODE_RED_DASHBOARD_URL,
    loadcell: {
      in: loadcellIn ? normalizeLoadcell(loadcellIn, 'in') : null,
      out: loadcellOut ? normalizeLoadcell(loadcellOut, 'out') : null,
    },
    machines: machineGroups.flatMap(normalizeInputStockMachineGroup),
    packaging: packaging.map(normalizePackagingItem),
    raw,
  }
}

export const fetchNodeRedDashboard = async () => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), NODE_RED_DASHBOARD_TIMEOUT_MS)

  try {
    const upstream = await fetch(NODE_RED_DASHBOARD_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!upstream.ok) {
      const err = new Error(`Node-RED dashboard error: ${upstream.status} ${upstream.statusText}`)
      err.status = 502
      throw err
    }

    const raw = await upstream.json()
    return normalizeNodeRedDashboard(raw)
  } catch (err) {
    const isTimeout = err.name === 'AbortError'
    const wrapped = new Error(isTimeout
      ? 'Node-RED dashboard request timed out'
      : `Node-RED dashboard request failed: ${err.message}`)
    wrapped.status = 502
    throw wrapped
  } finally {
    clearTimeout(timeout)
  }
}
