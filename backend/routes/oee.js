import { Router } from 'express'
import mongoose from 'mongoose'
import {
  Machine,
  OEESummary,
  Shift,
  Loss,
  Alert,
  Equipment,
  QualityData,
  Log,
  OEEHistory,
  ProductionEntry,
  DataEntry,
  DowntimeEvent,
  MachineStatusLog,
  QualityRecord,
  MaintenanceRecord,
  LayoutConfig,
  MaterialReceipt,
  MaterialWithdraw,
  SiloSetting,
  ProductType,
} from '../models/index.js'
import {
  getSummary as getMockSummary,
  getMachines as getMockMachines,
  getLosses as getMockLosses,
  getAlerts as getMockAlerts,
  clearAlerts as clearMockAlerts
} from '../services/mockDataService.js'
import { protect, allow } from '../middleware/auth.js'
import { fetchNodeRedDashboard } from '../services/nodeRedDashboardService.js'
import {
  getLoadcellInHistory,
  loadcellInReadingFromPayload,
  saveLoadcellInReading,
} from '../services/loadcellInHistoryService.js'

const router = Router()

const isDBConnected = () => mongoose.connection.readyState === 1

// Run a DB query if connected, otherwise return fallback immediately
const dbOrMock = async (queryFn, mockFn) => {
  if (!isDBConnected()) return mockFn()
  try {
    return await queryFn()
  } catch {
    return mockFn()
  }
}

// ── Helper to wrap async route handlers ──────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

const WRITE_ROLES = ['ADMIN', 'ENGINEER', 'OPERATOR']
const SETTINGS_ROLES = ['ADMIN', 'ENGINEER']
const MACHINE_STATUSES = ['running', 'breakdown', 'stopped', 'warning']
const SHIFT_STATUSES = ['waiting', 'running', 'done']
const DOWNTIME_CATEGORIES = ['Availability', 'Performance', 'Quality', 'Planned', 'Unplanned']
const MAINTENANCE_TYPES = ['Preventive', 'Corrective', 'Inspection', 'Calibration', 'Other']

const cleanUndefined = (value) => Object.fromEntries(
  Object.entries(value).filter(([, v]) => v !== undefined)
)

const machineMinutes = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}

const machineHoursFromMinutes = (minutes) =>
  Math.round((machineMinutes(minutes) / 60) * 100) / 100

const toPublicMachine = (machine = {}) => {
  const {
    currentProductKey,
    currentProductStartedAt,
    maintenanceWorkingMinutes,
    workingHours,
    ...publicMachine
  } = machine
  const workingTimeMinutes = machineMinutes(
    publicMachine.workingTimeMinutes,
    machineMinutes(publicMachine.runTime, 0)
  )
  const totalTime = machineMinutes(publicMachine.totalTime, 480)
  const stopTimeMinutes = machineMinutes(
    publicMachine.stopTimeMinutes,
    Math.max(0, totalTime - workingTimeMinutes)
  )

  return {
    ...publicMachine,
    status: publicMachine.status || 'stopped',
    workingTimeMinutes,
    stopTimeMinutes,
  }
}

const trimText = (value) => {
  if (value === undefined || value === null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

const parseDateValue = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const parseNumberValue = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const parseNonNegativeNumber = (value) => {
  const number = parseNumberValue(value)
  if (number === undefined) return undefined
  return number !== null && number >= 0 ? number : null
}

const parsePositiveNumber = (value) => {
  const number = parseNumberValue(value)
  if (number === undefined) return undefined
  return number !== null && number > 0 ? number : null
}

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message })

const verifyNodeRedIngestKey = (req, res) => {
  const expectedKey = process.env.NODE_RED_INGEST_API_KEY
  if (!expectedKey) return true

  const providedKey = req.get('x-api-key') || req.get('x-node-red-token')
  if (providedKey === expectedKey) return true

  res.status(401).json({ success: false, message: 'Invalid Node-RED ingest API key' })
  return false
}

const applyOptionalStrings = (target, body, fields) => {
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      target[field] = trimText(body[field]) || ''
    }
  })
}

const applyNonNegativeNumbers = (target, body, fields) => {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue
    const value = parseNonNegativeNumber(body[field])
    if (value === null) {
      return `${field} must be a non-negative number`
    }
    if (value !== undefined) target[field] = value
  }
  return null
}

const applyDateField = (target, body, field, required = false) => {
  if (!Object.prototype.hasOwnProperty.call(body, field)) {
    return required ? `${field} is required` : null
  }
  const date = parseDateValue(body[field])
  if (date === null || (required && date === undefined)) {
    return `${field} must be a valid date`
  }
  if (date !== undefined) target[field] = date
  return null
}

const applyObjectIdField = (target, body, field) => {
  if (!Object.prototype.hasOwnProperty.call(body, field)) return null
  const value = body[field]
  if (value === undefined || value === null || value === '') {
    target[field] = null
    return null
  }
  if (!mongoose.Types.ObjectId.isValid(value)) return `${field} is invalid`
  target[field] = value
  return null
}

const applyPercentNumbers = (target, body, fields) => {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue
    const value = parseNonNegativeNumber(body[field])
    if (value === null) return `${field} must be between 0 and 100`
    if (value !== undefined) {
      if (value > 100) return `${field} must be between 0 and 100`
      target[field] = value
    }
  }
  return null
}

const sanitizeMaterialReceipt = (body = {}) => {
  const payload = {}
  const product = trimText(body.product)
  const weight = parsePositiveNumber(body.weight)
  const dateError = applyDateField(payload, body, 'date', true)
  if (dateError) return { error: dateError }
  if (!product) return { error: 'product is required' }
  if (weight === null || weight === undefined) return { error: 'weight must be greater than 0' }

  payload.product = product
  payload.weight = weight
  applyOptionalStrings(payload, body, ['lot', 'notes', 'operator'])
  return { payload }
}

const sanitizeMaterialWithdraw = (body = {}) => {
  const payload = {}
  const product = trimText(body.product)
  const weight = parsePositiveNumber(body.weight)
  const dateError = applyDateField(payload, body, 'date', true)
  if (dateError) return { error: dateError }
  if (!product) return { error: 'product is required' }
  if (weight === null || weight === undefined) return { error: 'weight must be greater than 0' }

  payload.product = product
  payload.weight = weight
  applyOptionalStrings(payload, body, ['productionOrder', 'notes', 'operator'])
  return { payload }
}

const sanitizeSiloSetting = (body = {}) => {
  const payload = {}
  const product = trimText(body.product)
  const expectedWeight = parsePositiveNumber(body.expectedWeight)
  const dateError = applyDateField(payload, body, 'date', true)
  if (dateError) return { error: dateError }
  if (!product) return { error: 'product is required' }
  if (expectedWeight === null || expectedWeight === undefined) return { error: 'expectedWeight must be greater than 0' }
  if (body.status !== undefined && !SHIFT_STATUSES.includes(body.status)) {
    return { error: 'status is invalid' }
  }

  payload.product = product
  payload.expectedWeight = expectedWeight
  applyOptionalStrings(payload, body, ['startTime', 'endTime', 'notes'])
  if (body.status !== undefined) payload.status = body.status
  return { payload }
}

const sanitizeProductType = (body = {}) => {
  const name = trimText(body.name)
  if (!name) return { error: 'name is required' }
  return { payload: { name } }
}

const sanitizeAlert = (body = {}) => {
  const severity = trimText(body.severity)
  const title = trimText(body.title)
  const description = trimText(body.description)
  const timestamp = parseDateValue(body.timestamp)
  if (!['CRITICAL', 'WARNING', 'INFO'].includes(severity)) return { error: 'severity is invalid' }
  if (!title) return { error: 'title is required' }
  if (!description) return { error: 'description is required' }
  if (timestamp === null) return { error: 'timestamp must be a valid date' }
  return {
    payload: {
      severity,
      title,
      description,
      color: trimText(body.color) || 'border-sky-400',
      bg: trimText(body.bg) || 'bg-sky-950/10',
      text: trimText(body.text) || 'text-sky-200',
      equipment: trimText(body.equipment) || null,
      acknowledged: Boolean(body.acknowledged),
      timestamp: timestamp || new Date(),
    },
  }
}

const sanitizeMachineUpdate = (body = {}) => {
  const payload = {}
  if (body.status !== undefined) {
    if (!MACHINE_STATUSES.includes(body.status)) {
      return { error: 'status is invalid' }
    }
    payload.status = body.status
  }
  applyOptionalStrings(payload, body, ['line', 'borderColor', 'bgColor', 'shadow', 'oeeColor', 'currentProductKey'])
  const productStartError = applyDateField(payload, body, 'currentProductStartedAt', false)
  if (productStartError) return { error: productStartError }
  const numberError = applyNonNegativeNumbers(payload, body, [
    'oee', 'availability', 'performance', 'quality', 'goodUnits', 'totalUnits',
    'scrapUnits', 'runTime', 'totalTime', 'workingTimeMinutes', 'stopTimeMinutes',
    'maintenanceWorkingMinutes', 'workingHours',
  ])
  if (numberError) return { error: numberError }
  if (payload.workingTimeMinutes === undefined && payload.runTime !== undefined) {
    payload.workingTimeMinutes = payload.runTime
  }
  if (payload.stopTimeMinutes === undefined && payload.totalTime !== undefined && payload.workingTimeMinutes !== undefined) {
    payload.stopTimeMinutes = Math.max(0, machineMinutes(payload.totalTime) - machineMinutes(payload.workingTimeMinutes))
  }
  if (payload.workingHours === undefined && payload.maintenanceWorkingMinutes !== undefined) {
    payload.workingHours = machineHoursFromMinutes(payload.maintenanceWorkingMinutes)
  }
  if (payload.maintenanceWorkingMinutes === undefined && payload.workingHours !== undefined) {
    payload.maintenanceWorkingMinutes = machineMinutes(payload.workingHours * 60)
  }
  if (Array.isArray(body.segments)) {
    const segments = body.segments.map(Number)
    if (segments.some((value) => !Number.isFinite(value) || value < 0)) {
      return { error: 'segments must contain non-negative numbers' }
    }
    payload.segments = segments
  }
  return { payload }
}

const sanitizeShift = (body = {}, { partial = false } = {}) => {
  const payload = {}
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = trimText(body.name)
    if (!name) return { error: 'name is required' }
    payload.name = name
  }
  if (body.status !== undefined) {
    if (!SHIFT_STATUSES.includes(body.status)) return { error: 'status is invalid' }
    payload.status = body.status
  }
  if (body.isCurrent !== undefined) payload.isCurrent = Boolean(body.isCurrent)
  applyOptionalStrings(payload, body, ['type', 'time', 'color', 'product', 'cleaningTime'])
  const dateError = applyDateField(payload, body, 'productionDate', false)
  if (dateError) return { error: dateError }
  const numberError = applyNonNegativeNumbers(payload, body, [
    'received', 'target', 'bagSize', 'actualBags', 'order', 'availability', 'runtime', 'downtime',
  ])
  if (numberError) return { error: numberError }
  return { payload: cleanUndefined(payload) }
}

const sanitizeProductionEntry = (body = {}, { partial = false } = {}) => {
  const payload = {}
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'date')) {
    const dateError = applyDateField(payload, body, 'date', true)
    if (dateError) return { error: dateError }
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'product')) {
    const product = trimText(body.product)
    if (!product) return { error: 'product is required' }
    payload.product = product
  }
  if (body.shiftId !== undefined) {
    payload.shiftId = body.shiftId && mongoose.Types.ObjectId.isValid(body.shiftId) ? body.shiftId : null
  }
  applyOptionalStrings(payload, body, ['shift', 'line', 'timeRange', 'cleaningTime', 'operator', 'notes'])
  const numberError = applyNonNegativeNumbers(payload, body, [
    'received', 'siloOutput', 'target', 'actualBags', 'bagSize', 'startMinutes', 'endMinutes',
  ])
  if (numberError) return { error: numberError }
  if (payload.startMinutes !== undefined && payload.startMinutes > 24 * 60) {
    return { error: 'startMinutes is invalid' }
  }
  if (payload.endMinutes !== undefined && payload.endMinutes > 24 * 60) {
    return { error: 'endMinutes is invalid' }
  }
  const startMinutes = payload.startMinutes ?? body.startMinutes
  const endMinutes = payload.endMinutes ?? body.endMinutes
  if (startMinutes !== undefined && endMinutes !== undefined && Number(endMinutes) <= Number(startMinutes)) {
    return { error: 'endMinutes must be greater than startMinutes' }
  }
  return { payload: cleanUndefined(payload) }
}

const sanitizeOEEHistory = (body = {}) => {
  const payload = {}
  const machine = trimText(body.machine)
  if (!machine) return { error: 'machine is required' }
  payload.machine = machine
  applyOptionalStrings(payload, body, ['line', 'shift', 'recordedBy'])
  const objectIdError = applyObjectIdField(payload, body, 'machineId')
  if (objectIdError) return { error: objectIdError }
  const dateError = applyDateField(payload, body, 'timestamp', false)
  if (dateError) return { error: dateError }
  const percentError = applyPercentNumbers(payload, body, ['oee', 'availability', 'performance', 'quality'])
  if (percentError) return { error: percentError }
  const numberError = applyNonNegativeNumbers(payload, body, ['goodUnits', 'totalUnits', 'scrapUnits'])
  if (numberError) return { error: numberError }
  if (body.status !== undefined) {
    if (!MACHINE_STATUSES.includes(body.status)) return { error: 'status is invalid' }
    payload.status = body.status
  }
  if (payload.goodUnits !== undefined && payload.totalUnits !== undefined && payload.goodUnits > payload.totalUnits) {
    return { error: 'goodUnits cannot be greater than totalUnits' }
  }
  if (payload.scrapUnits !== undefined && payload.totalUnits !== undefined && payload.scrapUnits > payload.totalUnits) {
    return { error: 'scrapUnits cannot be greater than totalUnits' }
  }
  return { payload: cleanUndefined(payload) }
}

const sanitizeDataEntry = (body = {}) => {
  const payload = {}
  const shift = trimText(body.shift)
  const line = trimText(body.line)
  if (!shift) return { error: 'shift is required' }
  if (!line) return { error: 'line is required' }
  payload.shift = shift
  payload.line = line
  applyOptionalStrings(payload, body, ['notes', 'operator'])
  const dateError = applyDateField(payload, body, 'enteredAt', false)
  if (dateError) return { error: dateError }
  const numberError = applyNonNegativeNumbers(payload, body, ['productionCount', 'defectCount', 'downtimeMinutes'])
  if (numberError) return { error: numberError }
  if (payload.defectCount !== undefined && payload.productionCount !== undefined && payload.defectCount > payload.productionCount) {
    return { error: 'defectCount cannot be greater than productionCount' }
  }
  return { payload: cleanUndefined(payload) }
}

const sanitizeDowntimeEvent = (body = {}) => {
  const payload = {}
  const machine = trimText(body.machine)
  if (!machine) return { error: 'machine is required' }
  payload.machine = machine
  applyOptionalStrings(payload, body, ['line', 'reason', 'reasonCode', 'description', 'reportedBy'])
  const objectIdError = applyObjectIdField(payload, body, 'machineId')
  if (objectIdError) return { error: objectIdError }
  const startError = applyDateField(payload, body, 'startTime', true)
  if (startError) return { error: startError }
  const endError = applyDateField(payload, body, 'endTime', false)
  if (endError) return { error: endError }
  if (payload.endTime && payload.startTime && payload.endTime < payload.startTime) {
    return { error: 'endTime cannot be before startTime' }
  }
  if (body.category !== undefined) {
    if (!DOWNTIME_CATEGORIES.includes(body.category)) return { error: 'category is invalid' }
    payload.category = body.category
  }
  if (body.resolved !== undefined) payload.resolved = Boolean(body.resolved)
  const numberError = applyNonNegativeNumbers(payload, body, ['durationMinutes'])
  if (numberError) return { error: numberError }
  return { payload: cleanUndefined(payload) }
}

const sanitizeDowntimeResolve = (body = {}, event = {}) => {
  const payload = {}
  const endError = applyDateField(payload, body, 'endTime', false)
  if (endError) return { error: endError }
  const endTime = payload.endTime || new Date()
  if (event.startTime && endTime < new Date(event.startTime)) {
    return { error: 'endTime cannot be before startTime' }
  }
  const durationMinutes = event.startTime
    ? Math.max(0, Math.round((endTime - new Date(event.startTime)) / 60000))
    : 0
  return { payload: { endTime, durationMinutes, resolved: true } }
}

const sanitizeMachineStatusLog = (body = {}) => {
  const payload = {}
  const machine = trimText(body.machine)
  if (!machine) return { error: 'machine is required' }
  payload.machine = machine
  applyOptionalStrings(payload, body, ['line', 'changedBy', 'reason'])
  const objectIdError = applyObjectIdField(payload, body, 'machineId')
  if (objectIdError) return { error: objectIdError }
  if (body.oldStatus !== undefined) {
    if (!MACHINE_STATUSES.includes(body.oldStatus)) return { error: 'oldStatus is invalid' }
    payload.oldStatus = body.oldStatus
  }
  if (!body.newStatus || !MACHINE_STATUSES.includes(body.newStatus)) {
    return { error: 'newStatus is invalid' }
  }
  payload.newStatus = body.newStatus
  const dateError = applyDateField(payload, body, 'changedAt', false)
  if (dateError) return { error: dateError }
  return { payload: cleanUndefined(payload) }
}

const sanitizeQualityRecord = (body = {}) => {
  const payload = {}
  applyOptionalStrings(payload, body, ['shift', 'line', 'product', 'inspectedBy'])
  const dateError = applyDateField(payload, body, 'inspectedAt', false)
  if (dateError) return { error: dateError }
  const numberError = applyNonNegativeNumbers(payload, body, ['produced', 'good', 'defect', 'rework'])
  if (numberError) return { error: numberError }
  const percentError = applyPercentNumbers(payload, body, ['quality'])
  if (percentError) return { error: percentError }
  if (payload.good !== undefined && payload.produced !== undefined && payload.good > payload.produced) {
    return { error: 'good cannot be greater than produced' }
  }
  if (payload.defect !== undefined && payload.produced !== undefined && payload.defect > payload.produced) {
    return { error: 'defect cannot be greater than produced' }
  }
  if (body.defectBreakdown !== undefined) {
    if (!Array.isArray(body.defectBreakdown)) return { error: 'defectBreakdown must be an array' }
    const defectBreakdown = []
    for (const item of body.defectBreakdown) {
      const type = trimText(item?.type)
      const count = parseNonNegativeNumber(item?.count)
      const percentage = parseNonNegativeNumber(item?.percentage)
      if (!type) return { error: 'defectBreakdown.type is required' }
      if (count === null) return { error: 'defectBreakdown.count must be a non-negative number' }
      if (percentage === null || (percentage !== undefined && percentage > 100)) {
        return { error: 'defectBreakdown.percentage must be between 0 and 100' }
      }
      defectBreakdown.push({ type, count: count ?? 0, percentage: percentage ?? 0 })
    }
    payload.defectBreakdown = defectBreakdown
  }
  return { payload: cleanUndefined(payload) }
}

const sanitizeMaintenanceRecord = (body = {}, { partial = false } = {}) => {
  const payload = {}
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'equipment')) {
    const equipment = trimText(body.equipment)
    if (!equipment) return { error: 'equipment is required' }
    payload.equipment = equipment
  }
  const objectIdError = applyObjectIdField(payload, body, 'equipmentId')
  if (objectIdError) return { error: objectIdError }
  if (body.type !== undefined) {
    if (!MAINTENANCE_TYPES.includes(body.type)) return { error: 'type is invalid' }
    payload.type = body.type
  }
  const dateError = applyDateField(payload, body, 'date', false)
  if (dateError) return { error: dateError }
  const nextError = applyDateField(payload, body, 'nextSchedule', false)
  if (nextError) return { error: nextError }
  const numberError = applyNonNegativeNumbers(payload, body, ['durationHours', 'cost'])
  if (numberError) return { error: numberError }
  applyOptionalStrings(payload, body, ['technician', 'description'])
  if (body.parts !== undefined) {
    if (!Array.isArray(body.parts)) return { error: 'parts must be an array' }
    payload.parts = body.parts.map((part) => trimText(part)).filter(Boolean)
  }
  if (body.completed !== undefined) payload.completed = Boolean(body.completed)
  return { payload: cleanUndefined(payload) }
}

const clampLimit = (value, fallback = 100, max = 1000) => {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

const runInTransaction = async (work) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

const asObjectId = (value) => (
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value
)

async function getAvailableStockForProduction(product, productionEntryId, session) {
  const entryId = productionEntryId ? asObjectId(productionEntryId) : null
  const linkedWithdrawFilter = entryId
    ? {
        $or: [
          { productionEntryId: { $exists: false } },
          { productionEntryId: null },
          { productionEntryId: { $ne: entryId } },
        ],
      }
    : {}

  const [receiptAgg, withdrawAgg] = await Promise.all([
    MaterialReceipt.aggregate([
      { $match: { product } },
      { $group: { _id: null, total: { $sum: '$weight' } } },
    ]).session(session),
    MaterialWithdraw.aggregate([
      { $match: { product, ...linkedWithdrawFilter } },
      { $group: { _id: null, total: { $sum: '$weight' } } },
    ]).session(session),
  ])

  return (receiptAgg[0]?.total || 0) - (withdrawAgg[0]?.total || 0)
}

async function attachLegacyProductionWithdraw(productionEntryId, legacyEntry, session) {
  const product = trimText(legacyEntry?.product)
  const weight = Number(legacyEntry?.received) || 0
  const date = legacyEntry?.date ? new Date(legacyEntry.date) : null
  if (!product || weight <= 0 || !date || Number.isNaN(date.getTime())) return

  const existing = await MaterialWithdraw.findOne({ productionEntryId }).session(session).lean()
  if (existing) return

  const legacy = await MaterialWithdraw.findOneAndUpdate(
    {
      product,
      weight,
      date,
      operator: 'system',
      $or: [
        { productionEntryId: { $exists: false } },
        { productionEntryId: null },
      ],
    },
    { $set: { productionEntryId } },
    { new: true, session }
  ).lean()

  return legacy
}

async function syncProductionEntryWithdraw(entry, session, legacyEntry = null) {
  const productionEntryId = entry?._id
  if (!productionEntryId) return

  if (legacyEntry) {
    await attachLegacyProductionWithdraw(productionEntryId, legacyEntry, session)
  }

  const product = trimText(entry.product)
  const weight = Number(entry.received) || 0
  if (!product || weight <= 0) {
    await MaterialWithdraw.deleteMany({ productionEntryId }).session(session)
    return
  }

  const available = await getAvailableStockForProduction(product, productionEntryId, session)
  if (weight > available) {
    const error = new Error(`stock is insufficient for ${product}`)
    error.status = 400
    throw error
  }

  await MaterialWithdraw.findOneAndUpdate(
    { productionEntryId },
    {
      $set: {
        productionEntryId,
        date: entry.date || new Date(),
        product,
        weight,
        productionOrder: entry.shift || entry.timeRange || '',
        operator: entry.operator || 'system',
        notes: `Auto silo transfer for production entry ${productionEntryId}`,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, session }
  )
}

// ── Summary ──────────────────────────────────────────────────────
router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await dbOrMock(
    () => OEESummary.findOne().sort({ lastUpdated: -1 }).lean(),
    () => null
  )
  const hasValidData = summary && summary.oee > 0 && summary.availability > 0 && summary.performance > 0 && summary.quality > 0
  res.json({ success: true, data: hasValidData ? summary : getMockSummary() })
}))

// ── Availability ─────────────────────────────────────────────────
router.get('/availability', asyncHandler(async (req, res) => {
  const machines = await dbOrMock(() => Machine.find().lean(), () => [])
  const shifts = await dbOrMock(() => Shift.find().lean(), () => [])
  const summary = await dbOrMock(() => OEESummary.findOne().sort({ lastUpdated: -1 }).lean(), () => null)
  const mockSummary = getMockSummary()

  const availabilityData = {
    current: summary?.availability || mockSummary.availability,
    plannedDowntime: 12,
    unplannedDowntime: summary?.downtime || mockSummary.downtime,
    shiftData: shifts.length ? shifts.map(s => ({
      shift: s.name,
      availability: s.availability,
      runtime: s.runtime,
      downtime: s.downtime
    })) : [{ shift: 'A', availability: 85, runtime: 400, downtime: 60 }],
    equipmentBreakdown: machines.length ? machines.map(m => ({
      equipment: m.name,
      uptime: m.availability,
      downtime: 100 - m.availability
    })) : getMockMachines().map(m => ({
      equipment: m.name,
      uptime: m.availability,
      downtime: 100 - m.availability
    }))
  }
  res.json({ success: true, data: availabilityData })
}))

// ── Quality ──────────────────────────────────────────────────────
router.get('/quality', asyncHandler(async (req, res) => {
  res.json({ success: true, data: {
    overallQuality: 97.5,
    fpy: 96.2,
    goodUnits: 3106,
    scrapUnits: 33,
    totalUnits: 3139
  }})
}))

// ── Equipment ────────────────────────────────────────────────────
router.get('/equipment', asyncHandler(async (req, res) => {
  const equipment = await dbOrMock(() => Equipment.find().lean(), () => [])
  res.json({ success: true, data: { equipment } })
}))

// ── Alerts ───────────────────────────────────────────────────────
router.get('/alerts', asyncHandler(async (req, res) => {
  if (!isDBConnected()) {
    return res.json({ success: true, data: getMockAlerts() })
  }

  try {
    const alerts = await Alert.find().sort({ timestamp: -1 }).lean()
    res.json({ success: true, data: alerts })
  } catch {
    res.json({ success: true, data: getMockAlerts() })
  }
}))

// ── Machines (for Overview / Availability pages) ─────────────────
router.get('/machines', asyncHandler(async (req, res) => {
  const machines = await dbOrMock(() => Machine.find().lean(), () => [])
  const data = machines.length ? machines : getMockMachines()
  res.json({ success: true, data: data.map(toPublicMachine) })
}))

router.get('/node-red-dashboard', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store')

  try {
    const dashboard = await fetchNodeRedDashboard()
    res.json({ success: true, data: dashboard })
  } catch (err) {
    res.status(err.status || 502).json({
      success: false,
      message: err.message,
    })
  }
}))

router.get('/loadcell-in/history', asyncHandler(async (req, res) => {
  try {
    const data = await getLoadcellInHistory({
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    })
    res.json({ success: true, data })
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
    })
  }
}))

router.post('/ingest/loadcell-in', asyncHandler(async (req, res) => {
  if (!verifyNodeRedIngestKey(req, res)) return

  const result = await saveLoadcellInReading(loadcellInReadingFromPayload(req.body), new Date())
  if (!result.saved) {
    return badRequest(res, `Loadcell IN payload rejected: ${result.reason}`)
  }

  res.status(201).json({ success: true, data: result.row })
}))

// ── Losses (Six Big Losses) ──────────────────────────────────────
router.get('/losses', asyncHandler(async (req, res) => {
  const losses = await dbOrMock(() => Loss.find().lean(), () => [])
  res.json({ success: true, data: losses.length ? losses : getMockLosses() })
}))

// ── Shifts / Timeline ────────────────────────────────────────────
router.get('/shifts', asyncHandler(async (req, res) => {
  const shifts = await dbOrMock(() => Shift.find().sort({ order: 1, createdAt: -1 }).lean(), () => [])
  res.json({ success: true, data: shifts })
}))

// ── Work Shifts / Product Settings ───────────────────────────────
router.post('/shifts', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeShift(req.body)
  if (error) return badRequest(res, error)
  const last = await Shift.findOne().sort({ order: -1 }).lean()
  const order = payload.order ?? (last?.order ?? 0) + 1
  const shift = await Shift.create({ ...payload, order })
  res.status(201).json({ success: true, data: shift })
}))

router.put('/shifts/:id', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeShift(req.body, { partial: true })
  if (error) return badRequest(res, error)
  const shift = await Shift.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean()
  if (!shift) {
    return res.status(404).json({ success: false, message: 'Shift not found' })
  }
  res.json({ success: true, data: shift })
}))

router.delete('/shifts/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const shift = await Shift.findByIdAndDelete(req.params.id).lean()
  if (!shift) {
    return res.status(404).json({ success: false, message: 'Shift not found' })
  }
  res.json({ success: true, message: 'Shift deleted' })
}))

// ── Data Entry ───────────────────────────────────────────────────
router.post('/data-entry', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const entry = req.body
  console.log('Data entry received:', entry)
  res.json({
    success: true,
    message: 'Data entry recorded successfully',
    data: { id: Date.now(), ...entry, timestamp: new Date().toISOString() }
  })
}))

// ── Update Machine Status ────────────────────────────────────────
router.patch('/machines/:name', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { name } = req.params
  const { payload, error } = sanitizeMachineUpdate(req.body)
  if (error) return badRequest(res, error)
  const machine = await Machine.findOneAndUpdate(
    { name },
    { $set: payload },
    { new: true, upsert: false, runValidators: true }
  ).lean()
  if (!machine) {
    return res.status(404).json({ success: false, message: 'Machine not found' })
  }
  res.json({ success: true, data: toPublicMachine(machine) })
}))

// ── Create Alert ─────────────────────────────────────────────────
router.post('/alerts', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeAlert(req.body)
  if (error) return badRequest(res, error)
  const alert = await Alert.create(payload)
  res.status(201).json({ success: true, data: alert })
}))

// ── Acknowledge Alert ────────────────────────────────────────────
router.delete('/alerts', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  if (!isDBConnected()) {
    const deletedCount = clearMockAlerts()
    return res.json({ success: true, deletedCount })
  }

  const result = await Alert.deleteMany({})
  res.json({ success: true, deletedCount: result.deletedCount || 0 })
}))

router.patch('/alerts/:id/acknowledge', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { acknowledged: true },
    { new: true }
  ).lean()
  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found' })
  }
  res.json({ success: true, data: alert })
}))

// ── Activity Logs ────────────────────────────────────────────────
router.get('/logs', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
  const logs = await dbOrMock(
    () => Log.find().sort({ createdAt: -1 }).limit(limit).lean(),
    () => []
  )
  res.json({ success: true, data: logs })
}))

router.post('/logs', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { type = 'DATA', action, detail = '' } = req.body
  const log = await Log.create({
    type,
    action,
    detail,
    user: req.user?._id || null,
    username: req.user?.name || req.user?.un || null,
  })
  res.status(201).json({ success: true, data: log })
}))

// ── OEE History (time-series) ──────────────────────────────────
router.get('/history', asyncHandler(async (req, res) => {
  const { machine, line, start, end, limit = 100 } = req.query
  const filter = {}
  if (machine) filter.machine = machine
  if (line) filter.line = line
  if (start || end) {
    filter.timestamp = {}
    if (start) filter.timestamp.$gte = new Date(start)
    if (end) filter.timestamp.$lte = new Date(end)
  }
  const data = await dbOrMock(
    () => OEEHistory.find(filter).sort({ timestamp: -1 }).limit(clampLimit(limit, 100, 1000)).lean(),
    () => []
  )
  res.json({ success: true, data })
}))

router.post('/history', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeOEEHistory(req.body)
  if (error) return badRequest(res, error)
  const record = await OEEHistory.create(payload)
  res.status(201).json({ success: true, data: record })
}))

router.get('/history/summary', asyncHandler(async (req, res) => {
  const { start, end, line } = req.query
  const match = {}
  if (line) match.line = line
  if (start || end) {
    match.timestamp = {}
    if (start) match.timestamp.$gte = new Date(start)
    if (end) match.timestamp.$lte = new Date(end)
  }
  const [agg] = await dbOrMock(
    () => OEEHistory.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          oee: { $avg: '$oee' },
          availability: { $avg: '$availability' },
          performance: { $avg: '$performance' },
          quality: { $avg: '$quality' },
          totalProduction: { $sum: '$totalUnits' },
          goodUnits: { $sum: '$goodUnits' },
          scrapUnits: { $sum: '$scrapUnits' },
          downtime: { $sum: { $subtract: ['$totalUnits', '$goodUnits'] } }
        }
      }
    ]),
    () => []
  )
  const summary = agg || {
    oee: 0, availability: 0, performance: 0, quality: 0,
    totalProduction: 0, goodUnits: 0, scrapUnits: 0, downtime: 0
  }
  summary.oee = Math.round(summary.oee * 10) / 10
  summary.availability = Math.round(summary.availability * 10) / 10
  summary.performance = Math.round(summary.performance * 10) / 10
  summary.quality = Math.round(summary.quality * 10) / 10
  res.json({ success: true, data: summary })
}))

// ── Production Entries ───────────────────────────────────────────
router.get('/production-entries', asyncHandler(async (req, res) => {
  const { line, start, end, limit } = req.query
  const filter = {}
  if (line) filter.line = line
  if (start || end) {
    filter.date = {}
    if (start) filter.date.$gte = new Date(start)
    if (end) filter.date.$lte = new Date(end)
  }
  const data = await dbOrMock(
    () => ProductionEntry.find(filter).sort({ date: -1 }).limit(clampLimit(limit, 1000, 5000)).lean(),
    () => []
  )
  res.json({ success: true, data })
}))

router.post('/production-entries', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeProductionEntry(req.body)
  if (error) return badRequest(res, error)
  const entry = await runInTransaction(async (session) => {
    const [created] = await ProductionEntry.create([payload], { session })
    await syncProductionEntryWithdraw(created.toObject(), session)
    return created.toObject()
  })
  res.status(201).json({ success: true, data: entry })
}))

router.put('/production-entries/:id', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeProductionEntry(req.body, { partial: true })
  if (error) return badRequest(res, error)
  const entry = await runInTransaction(async (session) => {
    const previous = await ProductionEntry.findById(req.params.id).session(session).lean()
    if (!previous) return null
    const updated = await ProductionEntry.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true, session }
    ).lean()
    if (!updated) return null
    await syncProductionEntryWithdraw(updated, session, previous)
    return updated
  })
  if (!entry) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, data: entry })
}))

router.delete('/production-entries/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const entry = await runInTransaction(async (session) => {
    const deleted = await ProductionEntry.findByIdAndDelete(req.params.id, { session }).lean()
    if (!deleted) return null
    await MaterialWithdraw.deleteMany({ productionEntryId: deleted._id }).session(session)
    return deleted
  })
  if (!entry) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Data Entry (operator submissions) ────────────────────────────
router.get('/data-entries', protect, asyncHandler(async (req, res) => {
  const { line, start, end } = req.query
  const filter = {}
  if (line) filter.line = line
  if (start || end) {
    filter.enteredAt = {}
    if (start) filter.enteredAt.$gte = new Date(start)
    if (end) filter.enteredAt.$lte = new Date(end)
  }
  const data = await DataEntry.find(filter).sort({ enteredAt: -1 }).lean()
  res.json({ success: true, data })
}))

router.post('/data-entries', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeDataEntry(req.body)
  if (error) return badRequest(res, error)
  const entry = await DataEntry.create(payload)
  res.status(201).json({ success: true, data: entry })
}))

// ── Downtime Events ──────────────────────────────────────────────
router.get('/downtime', asyncHandler(async (req, res) => {
  const { machine, line, resolved } = req.query
  const filter = {}
  if (machine) filter.machine = machine
  if (line) filter.line = line
  if (resolved !== undefined) filter.resolved = resolved === 'true'
  const data = await dbOrMock(() => DowntimeEvent.find(filter).sort({ startTime: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/downtime', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeDowntimeEvent(req.body)
  if (error) return badRequest(res, error)
  const event = await DowntimeEvent.create(payload)
  res.status(201).json({ success: true, data: event })
}))

router.patch('/downtime/:id/resolve', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const event = await DowntimeEvent.findById(req.params.id).lean()
  if (!event) return res.status(404).json({ success: false, message: 'Not found' })
  const { payload, error } = sanitizeDowntimeResolve(req.body, event)
  if (error) return badRequest(res, error)
  const updated = await DowntimeEvent.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean()
  res.json({ success: true, data: updated })
}))

// ── Machine Status Log ───────────────────────────────────────────
router.get('/machine-status-logs', asyncHandler(async (req, res) => {
  const { machine, line } = req.query
  const filter = {}
  if (machine) filter.machine = machine
  if (line) filter.line = line
  const data = await dbOrMock(() => MachineStatusLog.find(filter).sort({ changedAt: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/machine-status-logs', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeMachineStatusLog(req.body)
  if (error) return badRequest(res, error)
  const log = await MachineStatusLog.create(payload)
  res.status(201).json({ success: true, data: log })
}))

// ── Quality Records ──────────────────────────────────────────────
router.get('/quality-records', asyncHandler(async (req, res) => {
  const { line, product, start, end } = req.query
  const filter = {}
  if (line) filter.line = line
  if (product) filter.product = product
  if (start || end) {
    filter.inspectedAt = {}
    if (start) filter.inspectedAt.$gte = new Date(start)
    if (end) filter.inspectedAt.$lte = new Date(end)
  }
  const data = await dbOrMock(() => QualityRecord.find(filter).sort({ inspectedAt: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/quality-records', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeQualityRecord(req.body)
  if (error) return badRequest(res, error)
  const record = await QualityRecord.create(payload)
  res.status(201).json({ success: true, data: record })
}))

// ── Maintenance Records ────────────────────────────────────────────
router.get('/maintenance', asyncHandler(async (req, res) => {
  const { equipment, type } = req.query
  const filter = {}
  if (equipment) filter.equipment = equipment
  if (type) filter.type = type
  const data = await dbOrMock(() => MaintenanceRecord.find(filter).sort({ date: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/maintenance', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeMaintenanceRecord(req.body)
  if (error) return badRequest(res, error)
  const record = await MaintenanceRecord.create(payload)
  res.status(201).json({ success: true, data: record })
}))

router.put('/maintenance/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeMaintenanceRecord(req.body, { partial: true })
  if (error) return badRequest(res, error)
  const record = await MaintenanceRecord.findByIdAndUpdate(
    req.params.id,
    { $set: payload },
    { new: true, runValidators: true }
  ).lean()
  if (!record) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, data: record })
}))

router.delete('/maintenance/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const record = await MaintenanceRecord.findByIdAndDelete(req.params.id).lean()
  if (!record) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Shared Overview Layout ───────────────────────────────────────
router.get('/layout', protect, asyncHandler(async (req, res) => {
  const config = await dbOrMock(() => LayoutConfig.findOne().lean(), () => null)
  res.json({ success: true, data: config })
}))

router.post('/layout', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const { collapsed, expanded, tablet, tabletCollapsed, tabletExpanded } = req.body || {}
  const update = {}
  const profiles = { collapsed, expanded, tablet, tabletCollapsed, tabletExpanded }
  Object.entries(profiles).forEach(([key, value]) => {
    if (value) {
      update[key] = {
        ...value,
        savedAt: value.savedAt || new Date(),
      }
    }
  })

  const config = await LayoutConfig.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()

  res.json({ success: true, data: config })
}))

// ── Product Types (dynamic product list) ────────────────────────
router.get('/product-types', asyncHandler(async (req, res) => {
  const types = await dbOrMock(() => ProductType.find().sort({ name: 1 }).lean(), () => [])
  res.json({ success: true, data: types })
}))

router.post('/product-types', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeProductType(req.body)
  if (error) return badRequest(res, error)
  const existing = await ProductType.findOne({ name: payload.name }).lean().catch(() => null)
  if (existing) return res.json({ success: true, data: existing })
  const pt = await ProductType.create(payload)
  res.status(201).json({ success: true, data: pt })
}))

router.delete('/product-types/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const pt = await ProductType.findByIdAndDelete(req.params.id).lean()
  if (!pt) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Material Receipts (รับวัตถุดิบ) ─────────────────────────────
router.get('/material-receipts', asyncHandler(async (req, res) => {
  const { product, start, end } = req.query
  const filter = {}
  if (product) filter.product = product
  if (start || end) {
    filter.date = {}
    if (start) filter.date.$gte = new Date(start)
    if (end) filter.date.$lte = new Date(end)
  }
  const data = await dbOrMock(() => MaterialReceipt.find(filter).sort({ date: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/material-receipts', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeMaterialReceipt(req.body)
  if (error) return badRequest(res, error)
  const entry = await MaterialReceipt.create(payload)
  // Auto-register product type if new
  if (payload.product) {
    ProductType.findOneAndUpdate(
      { name: payload.product },
      { $setOnInsert: { name: payload.product } },
      { upsert: true, new: true }
    ).catch(() => {})
  }
  res.status(201).json({ success: true, data: entry })
}))

router.delete('/material-receipts/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const entry = await MaterialReceipt.findByIdAndDelete(req.params.id).lean()
  if (!entry) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Material Withdraws (เบิกวัตถุดิบ) ────────────────────────────
router.get('/material-withdraws', asyncHandler(async (req, res) => {
  const { product, start, end } = req.query
  const filter = {}
  if (product) filter.product = product
  if (start || end) {
    filter.date = {}
    if (start) filter.date.$gte = new Date(start)
    if (end) filter.date.$lte = new Date(end)
  }
  const data = await dbOrMock(() => MaterialWithdraw.find(filter).sort({ date: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/material-withdraws', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeMaterialWithdraw(req.body)
  if (error) return badRequest(res, error)
  const entry = await MaterialWithdraw.create(payload)
  // Auto-register product type if new
  if (payload.product) {
    ProductType.findOneAndUpdate(
      { name: payload.product },
      { $setOnInsert: { name: payload.product } },
      { upsert: true, new: true }
    ).catch(() => {})
  }
  res.status(201).json({ success: true, data: entry })
}))

router.delete('/material-withdraws/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const entry = await MaterialWithdraw.findByIdAndDelete(req.params.id).lean()
  if (!entry) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Silo Settings (จัดเก็บในไซโล) ───────────────────────────────
router.get('/silo-settings', asyncHandler(async (req, res) => {
  const { start, end } = req.query
  const filter = {}
  if (start || end) {
    filter.date = {}
    if (start) filter.date.$gte = new Date(start)
    if (end) filter.date.$lte = new Date(end)
  }
  const data = await dbOrMock(() => SiloSetting.find(filter).sort({ date: -1 }).lean(), () => [])
  res.json({ success: true, data })
}))

router.post('/silo-settings', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { payload, error } = sanitizeSiloSetting(req.body)
  if (error) return badRequest(res, error)
  const entry = await SiloSetting.create(payload)
  // Auto-register product type if new
  if (payload.product) {
    ProductType.findOneAndUpdate(
      { name: payload.product },
      { $setOnInsert: { name: payload.product } },
      { upsert: true, new: true }
    ).catch(() => {})
    // Also create a Shift so it appears in Product Setting calendar
    const last = await Shift.findOne().sort({ order: -1 }).lean().catch(() => null)
    const order = (last?.order ?? 0) + 1
    Shift.create({
      name: `Silo - ${payload.product}`,
      type: 'Silo',
      time: `${payload.startTime || ''} - ${payload.endTime || ''}`,
      status: 'waiting',
      isCurrent: false,
      color: '#0891b2',
      productionDate: payload.date || new Date().toISOString(),
      product: payload.product,
      received: 0,
      target: Number(payload.expectedWeight) || 0,
      cleaningTime: '00:00',
      order,
    }).catch(() => {})
  }
  res.status(201).json({ success: true, data: entry })
}))

router.delete('/silo-settings/:id', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const entry = await SiloSetting.findByIdAndDelete(req.params.id).lean()
  if (!entry) return res.status(404).json({ success: false, message: 'Not found' })
  res.json({ success: true, message: 'Deleted' })
}))

// ── Bulk clear stock data (admin only) ───────────────────────────
router.delete('/clear-stock-data', protect, allow('ADMIN'), asyncHandler(async (req, res) => {
  await MaterialReceipt.deleteMany({})
  await MaterialWithdraw.deleteMany({})
  await SiloSetting.deleteMany({})
  await ProductType.deleteMany({})
  res.json({ success: true, message: 'Stock data cleared' })
}))

// ── Stock Summary (คงเหลือรวม แยกตามสินค้า) ─────────────────────
router.get('/material-stock', asyncHandler(async (req, res) => {
  const receipts = await dbOrMock(() => MaterialReceipt.find().lean(), () => [])
  const withdraws = await dbOrMock(() => MaterialWithdraw.find().lean(), () => [])
  const productions = await dbOrMock(() => ProductionEntry.find().lean(), () => [])
  const stockMap = {}
  const ensure = (product) => {
    if (!stockMap[product]) stockMap[product] = { product, received: 0, withdrawn: 0, remaining: 0, siloOutput: 0, silo: 0 }
    return stockMap[product]
  }
  receipts.forEach((r) => { ensure(r.product).received += r.weight || 0 })
  withdraws.forEach((w) => { ensure(w.product).withdrawn += w.weight || 0 })
  productions.forEach((p) => {
    if (!p.product) return
    ensure(p.product).siloOutput += p.siloOutput || 0
  })
  Object.values(stockMap).forEach((s) => {
    s.remaining = Math.round((s.received - s.withdrawn) * 100) / 100
    s.silo = Math.round((s.withdrawn - s.siloOutput) * 100) / 100
  })
  res.json({ success: true, data: Object.values(stockMap) })
}))

export default router
