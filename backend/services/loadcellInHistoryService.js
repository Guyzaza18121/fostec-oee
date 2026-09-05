import { queryPostgres } from '../config/postgres.js'

const MAX_HISTORY_LIMIT = 5000
const DEFAULT_HISTORY_LIMIT = 500

const toNumberOrNull = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const toRecordedAt = (value, fallback = new Date()) => {
  if (!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

const normalizeStoredStatus = (status, isOnline = false) => {
  const value = String(status || '').trim().toUpperCase()
  if (['ON', 'ONLINE', 'RUN', 'RUNNING', 'TRUE'].includes(value)) return 'RUNNING'
  if (['STOP', 'STOPPED'].includes(value)) return 'STOP'
  if (['ALARM', 'ERROR', 'FAULT'].includes(value)) return 'ALARM'
  return isOnline ? 'RUNNING' : 'OFF'
}

export const loadcellInReadingFromPayload = (payload = {}) => ({
  current: payload.valueKg ?? payload.value_kg ?? payload.weight_input ?? payload.current,
  maximum: payload.inputMaximumKg ?? payload.input_maximum_kg ?? payload.input_maximum ?? payload.maximum,
  total: payload.inputTotalKg ?? payload.input_total_kg ?? payload.input_total ?? payload.total,
  status: payload.status,
  isOnline: payload.isOnline ?? payload.is_online,
  recordedAt: payload.recordedAt ?? payload.recorded_at ?? payload.timestamp ?? payload.time,
})

export const saveLoadcellInReading = async (reading, fallbackRecordedAt = new Date()) => {
  if (!reading) return { saved: false, reason: 'missing_reading' }

  const valueKg = toNumberOrNull(reading.current)
  if (valueKg === null) return { saved: false, reason: 'invalid_value_kg' }

  const result = await queryPostgres(
      `INSERT INTO loadcell_in.measurements
      (process_id, machine_code, value_kg, input_maximum_kg, input_total_kg, status, source, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, recorded_at`,
    [
      2,
      'loadcell_in',
      valueKg,
      toNumberOrNull(reading.maximum),
      toNumberOrNull(reading.total),
      normalizeStoredStatus(reading.status, reading.isOnline),
      'node-red',
      toRecordedAt(reading.recordedAt, toRecordedAt(fallbackRecordedAt)),
    ]
  )

  return { saved: true, row: result.rows[0] }
}

export const getLoadcellInHistory = async ({ from, to, limit } = {}) => {
  const safeLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || DEFAULT_HISTORY_LIMIT, 1),
    MAX_HISTORY_LIMIT
  )
  const toDate = toRecordedAt(to, new Date())
  const fromDate = from
    ? toRecordedAt(from, new Date(toDate.getTime() - 60 * 60 * 1000))
    : new Date(toDate.getTime() - 60 * 60 * 1000)

  const result = await queryPostgres(
    `SELECT
       id,
       process_id,
       machine_code,
       value_kg,
       input_maximum_kg,
       input_total_kg,
       status,
       source,
       recorded_at,
       received_at
     FROM loadcell_in.measurements
     WHERE recorded_at >= $1 AND recorded_at <= $2
     ORDER BY recorded_at ASC
     LIMIT $3`,
    [fromDate, toDate, safeLimit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    processId: row.process_id,
    machineCode: row.machine_code,
    valueKg: Number(row.value_kg),
    inputMaximumKg: row.input_maximum_kg === null ? null : Number(row.input_maximum_kg),
    inputTotalKg: row.input_total_kg === null ? null : Number(row.input_total_kg),
    status: row.status,
    source: row.source,
    recordedAt: row.recorded_at,
    receivedAt: row.received_at,
  }))
}
