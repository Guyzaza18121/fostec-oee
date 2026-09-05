import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { getLayout, saveLayout } from '../services/layoutApi'
import MachineControlModal from '../components/MachineControlModal'
import ProductionEntryModal from '../components/ProductionEntryModal'
import useOEEData from '../hooks/useOEEData'
import useDeviceType from '../hooks/useDeviceType'
import useNodeRedDashboard from '../hooks/useNodeRedDashboard'
import { useSidebar } from '../context/SidebarContext'
import { api } from '../services/api.js'
import { Minus } from 'lucide-react'

// ── Static Panels (percentage-based for responsive) ─────────────
const DEFAULT_POSITIONS_DESKTOP = {
  1:  { left: 8.9,  top: 2.8  },
  2:  { left: 25.9, top: 6.9  },
  3:  { left: 39.9, top: 6.6  },
  4:  { left: 51.7, top: 0.5  },
  5:  { left: 66.1, top: 9.1  },
  6:  { left: 78.1, top: 9.1  },
  7:  { left: 13.1, top: 78.8 },
  8:  { left: 28.1, top: 76.4 },
  9:  { left: 45.0, top: 78.5 },
  10: { left: 65.0, top: 76.2 }
}

const DEFAULT_POSITIONS_COLLAPSED = DEFAULT_POSITIONS_DESKTOP
const DEFAULT_POSITIONS_EXPANDED = DEFAULT_POSITIONS_DESKTOP

// Separate default layout for iPad / tablet viewports (768–1279px).
// Seeded from the expanded desktop layout; users can fine-tune with the
// "จัดหน้า" edit mode on iPad and it will be saved to its own profile.
const DEFAULT_POSITIONS_TABLET = {
  1:  { left: 10.4,  top: 4.9  },
  2:  { left: 25.8,  top: 4.0  },
  3:  { left: 39.4,  top: 1.7  },
  4:  { left: 50.7,  top: -2.9 },
  5:  { left: 65.1,  top: 6.7  },
  6:  { left: 77.1,  top: 9.0  },
  7:  { left: 11.3,  top: 88.7 },
  8:  { left: 28.3,  top: 85.8 },
  9:  { left: 45.1,  top: 84.9 },
  10: { left: 63.7,  top: 85.4 }
}

const LAYOUT_CACHE_VERSION = 4
const SHOW_OVERVIEW_MACHINE_INFO_PANELS = true
// Hidden for now. Ask Codex with: "เปิดกรอบสี Overview" to turn these
// process-colored container frames back on.
const SHOW_OVERVIEW_CONTAINER_COLOR_FRAMES = false
const OVERVIEW_CONTAINER_FRAME_CLASSES = SHOW_OVERVIEW_CONTAINER_COLOR_FRAMES
  ? {
    control: 'border-2 border-emerald-500/85',
    process: 'border-2 border-rose-500/80',
    oee: 'border-2 border-sky-500/85',
    metrics: 'border-2 border-cyan-500/70',
    alarm: 'border-2 border-amber-400/85',
  }
  : {
    control: 'border border-border',
    process: 'border border-border',
    oee: 'border border-border',
    metrics: 'border border-border',
    alarm: 'border border-border',
  }
const PROCESS_CANVAS_WIDTH = 1220
const PROCESS_CANVAS_HEIGHT = 620
const PROCESS_IMAGE_BASE_WIDTH = 1050
const PROCESS_IMAGE_BASE_TOP = 48
const PROCESS_IMAGE_ASPECT_RATIO = 980 / 2000
const PROCESS_PANEL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const DESKTOP_LAYOUT_PROFILE_KEYS = ['collapsed', 'expanded']
const TABLET_LAYOUT_PROFILE_KEYS = ['tabletCollapsed', 'tabletExpanded']
const PANEL_WIDTH_CLASSES = {
  1: 'w-[11.5rem]',
  2: 'w-[10.5rem]',
  3: 'w-[9.5rem]',
  4: 'w-[13rem]',
  5: 'w-[10.25rem]',
  6: 'w-[10.25rem]',
  7: 'w-[13rem]',
  8: 'w-[10.5rem]',
  9: 'w-[9.5rem]',
  10: 'w-[13rem]'
}

const clampProcessValue = (value, min, max) => Math.min(max, Math.max(min, value))
const finiteOr = (value, fallback) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}
const PRODUCTION_ENTRIES_STORAGE_KEY = 'productionEntries'
const PRODUCTION_ENTRIES_SYNC_KEY = 'productionEntriesUpdatedAt'
const PRODUCTION_ENTRIES_CHANGED_EVENT = 'production-entries:changed'
const PRODUCT_OEE_TREND_STORAGE_KEY = 'overviewProductOEETrendHistory'
const MOCK_PRODUCT_OEE_TREND_HISTORY = [
  {
    key: 'mock-previous-product|2026-08-01|mock',
    product: 'Mock Product ก่อนหน้า',
    oee: 58.4,
    updatedAt: '2026-08-01T00:00:00.000Z',
    mock: true,
  },
]
const SHIFTS_SYNC_KEY = 'shiftsUpdatedAt'
const SHIFTS_CHANGED_EVENT = 'shifts:changed'

function formatProductionHourLabel(hour) {
  const h = hour % 12 || 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h} ${suffix}`
}

function TrendArrowIcon({ direction = 'up', size = 24 }) {
  const path = direction === 'down'
    ? 'M8 16 L24 36 L36 27 L56 51 M41 51 H56 V36'
    : 'M8 48 L24 28 L36 37 L56 13 M41 13 H56 V28'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function mapBackendProductionEntry(entry) {
  const startMinutes = entry.startMinutes ?? 0
  const endMinutes = entry.endMinutes ?? Math.max(startMinutes + 60, 1)
  const [cleaningHours = '00', cleaningMinutes = '00'] = String(entry.cleaningTime || '00:00').split(':')
  return {
    id: entry._id || entry.id || `entry-${Date.now()}-${Math.random()}`,
    backendId: entry._id || entry.id || null,
    shiftId: entry.shiftId || null,
    shift: entry.shift || '',
    name: entry.product || 'ไม่ระบุสินค้า',
    product: entry.product || '',
    day: new Date(entry.date || entry.day || Date.now()),
    time: entry.timeRange || `${formatProductionHourLabel(Math.floor(startMinutes / 60))} - ${formatProductionHourLabel(Math.floor(endMinutes / 60))}`,
    startMinutes,
    endMinutes,
    status: 'running',
    color: '#22d3ee',
    data: {
      inputWeight: entry.received ?? '',
      outputWeight: entry.siloOutput ?? '',
      standardWeight: entry.target ?? '',
      cleaningHours,
      cleaningMinutes,
    },
  }
}

function mapOverviewEntryToBackend(entry) {
  return {
    shiftId: entry.shiftId || null,
    date: entry.day instanceof Date ? entry.day.toISOString() : entry.day,
    product: entry.product || entry.name,
    timeRange: entry.time,
    received: Number(entry.data?.inputWeight) || 0,
    siloOutput: Number(entry.data?.outputWeight) || 0,
    target: Number(entry.data?.standardWeight) || 0,
    cleaningTime: `${entry.data?.cleaningHours || '00'}:${entry.data?.cleaningMinutes || '00'}`,
    startMinutes: entry.startMinutes,
    endMinutes: entry.endMinutes,
    shift: entry.shift || '',
    line: entry.line || '',
    actualBags: entry.actualBags || 0,
    bagSize: entry.bagSize || 0,
    operator: entry.operator || '',
    notes: entry.notes || '',
  }
}

function normalizeShift(shift, index = 0) {
  return {
    ...shift,
    id: shift._id || shift.id,
    order: shift.order ?? index,
    status: ['waiting', 'running', 'done'].includes(shift.status) ? shift.status : 'waiting',
  }
}

function minutesToTimeInput(minutes) {
  const clamped = Math.max(0, Math.min(24 * 60, Number(minutes) || 0))
  const hours = Math.floor(clamped / 60) % 24
  const mins = clamped % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

function getEntryDayStart(entry) {
  const day = new Date(entry?.day || entry?.date || Date.now())
  if (Number.isNaN(day.getTime())) return null
  day.setHours(0, 0, 0, 0)
  return day
}

function getEntryScheduleRange(entry) {
  const day = getEntryDayStart(entry)
  if (!day) return null

  const startMinutes = Number(entry?.startMinutes) || 0
  const rawEndMinutes = Number(entry?.endMinutes)
  const endMinutes = Number.isFinite(rawEndMinutes) && rawEndMinutes > startMinutes
    ? rawEndMinutes
    : Math.min(startMinutes + 60, 24 * 60)
  const startAt = new Date(day)
  const endAt = new Date(day)
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  return { day, startAt, endAt, startMinutes, endMinutes }
}

function formatScheduleEntryLabel(entry) {
  if (!entry) return '—'
  const name = entry.name || entry.product || '—'
  return entry.time ? `${name} ${entry.time}` : name
}

function getEntryCleaningSeconds(entry) {
  return (
    (Number(entry?.data?.cleaningHours || 0) * 60)
    + Number(entry?.data?.cleaningMinutes || 0)
  ) * 60
}

function buildShiftPayloadFromEntry(entry, existingShifts = []) {
  const shiftNumber = existingShifts.length + 1
  const shiftName = `Shift ${shiftNumber}`
  const cleaningHours = entry.data?.cleaningHours || '00'
  const cleaningMinutes = entry.data?.cleaningMinutes || '00'
  return {
    type: shiftName,
    name: shiftName,
    time: `${minutesToTimeInput(entry.startMinutes)} \u2013 ${minutesToTimeInput(entry.endMinutes)}`,
    status: 'waiting',
    isCurrent: false,
    color: entry.color || '#22d3ee',
    productionDate: entry.day instanceof Date ? entry.day.toISOString() : entry.day,
    product: entry.product || entry.name || '',
    received: Number(entry.data?.inputWeight) || 0,
    siloOutput: Number(entry.data?.outputWeight) || 0,
    target: Number(entry.data?.standardWeight) || 0,
    bagSize: Number(entry.bagSize) || 0,
    actualBags: Number(entry.actualBags) || 0,
    cleaningTime: `${cleaningHours}:${cleaningMinutes}`,
  }
}

function notifyProductionEntriesChanged() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PRODUCTION_ENTRIES_SYNC_KEY, String(Date.now()))
  } catch {}
  window.dispatchEvent(new CustomEvent(PRODUCTION_ENTRIES_CHANGED_EVENT))
}

function notifyShiftsChanged() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHIFTS_SYNC_KEY, String(Date.now()))
  } catch {}
  window.dispatchEvent(new CustomEvent(SHIFTS_CHANGED_EVENT))
}

const StatusValue = ({ status }) => {
  const color = status === 'RUNNING' ? 'text-emerald-400' : status === 'STOP' ? 'text-red-400' : 'text-yellow-400'
  return <span className={`text-[10px] font-bold ${color}`}>{status}</span>
}

const PANEL_DATA = {
  1: [
    <div key="1"><span className="text-[9px] text-white">ความชื้น(Target &lt;14%) :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12.5 %</span></div>,
    <div key="2"><span className="text-[9px] text-white">ปริมาณรับเข้า :</span> <span className="font-mono text-[12px] font-bold text-cyan-300"> 24,800 kg</span></div>
  ],
  2: [
    <div key="1"><span className="text-[9px] text-white">ปริมาณข้าวสาร :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">148.25 kg</span></div>
  ],
  3: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">8 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12.5 Hr</span></div>
  ],
  4: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">8 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12.5 Hr</span></div>,
    <div key="1"><span className="text-[9px] text-white">น้ำหนักข้าวสารขาเข้า :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">1,250.5 kg</span></div>,
    <div key="2"><span className="text-[9px] text-white">ผลรวมต่อวัน:</span> <span className="font-mono text-[12px] font-bold text-cyan-300">48,250 kg</span></div>
  ],
  5: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">10.2 Hr</span></div>
  ],
  6: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">15 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">11.0 Hr</span></div>
  ],
  7: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">8 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12.5 Hr</span></div>,
    <div key="1"><span className="text-[9px] text-white">น้ำหนักข้าวสารขาออก :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">5,600.0 kg</span></div>,
    <div key="2"><span className="text-[9px] text-white">ผลรวมต่อวัน:</span> <span className="font-mono text-[12px] font-bold text-cyan-300">125,400 kg</span></div>
  ],
  8: [
    <div key="1"><span className="text-[9px] text-white">ปริมาณข้าวสาร :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">48,000 kg</span></div>
  ],
  9: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">6 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">9.5 Hr</span></div>
  ],
  10: [
    <div key="0"><span className="text-[9px] text-white">Status :</span> <StatusValue status="STOP" /></div>,
    <div key="4"><span className="text-[9px] text-white">Power :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">8 kW</span></div>,
    <div key="5"><span className="text-[9px] text-white">Working :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">12.5 Hr</span></div>,
    <div key="1"><span className="text-[9px] text-white">จำนวนสินค้า 1 :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">2,450 ถุง</span></div>,
    <div key="2"><span className="text-[9px] text-white">จำนวนสินค้า 2 :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">1,850 ถุง</span></div>,
    <div key="3"><span className="text-[9px] text-white">น้ำหนักรวมของสินค้า :</span> <span className="font-mono text-[12px] font-bold text-cyan-300">4,300 ถุง</span></div>
  ]
}

function formatPanelNumber(value, digits = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function panelOnline(status, fallback = false) {
  if (typeof fallback === 'boolean' && fallback) return true
  const value = String(status || '').trim().toUpperCase()
  return ['ON', 'ONLINE', 'RUN', 'RUNNING', 'STANDBY', 'STANBY', 'TRUE'].includes(value)
}

function packagingPanelState(item = {}) {
  const value = String(item.state || item.status || '').trim().toUpperCase()
  if (['RUNNING', 'RUN', 'ON'].includes(value)) return 'running'
  if (['STANDBY', 'STANBY', 'IDLE', 'WAITING'].includes(value)) return 'standby'
  if (['DISCONNECT', 'DISCONNECTED', 'OFF', 'OFFLINE', 'FALSE'].includes(value)) return 'disconnect'
  if (['ALERT', 'WARNING', 'WARN'].includes(value)) return 'alert'
  if (['ALARM', 'BREAKDOWN', 'BRE', 'FAULT', 'ERROR'].includes(value)) return 'alarm'
  if (item.isOnline || panelOnline(item.status)) return 'standby'
  return 'disconnect'
}

function PanelMetricRow({ label, value, unit = '', valueClass = 'text-cyan-300' }) {
  return (
    <div>
      <span className="text-[9px] text-white">{label} :</span>{' '}
      <span className={`font-mono text-[12px] font-bold ${valueClass}`}>
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

function getPackagingSummary(packaging = []) {
  return packaging.reduce((summary, item) => ({
    ...summary,
    total: summary.total + 1,
    [packagingPanelState(item)]: summary[packagingPanelState(item)] + 1,
    online: summary.online + (item.isOnline || panelOnline(item.status) ? 1 : 0),
    powerKw: summary.powerKw + (Number(item.powerKw) || 0),
    powerKwh: summary.powerKwh + (Number(item.powerKwh) || 0),
    workingTimeMinutes: summary.workingTimeMinutes + (Number(item.workingTimeMinutes) || 0),
    stopTimeMinutes: summary.stopTimeMinutes + (Number(item.stopTimeMinutes) || 0),
  }), {
    total: 0,
    online: 0,
    running: 0,
    standby: 0,
    disconnect: 0,
    alert: 0,
    alarm: 0,
    powerKw: 0,
    powerKwh: 0,
    workingTimeMinutes: 0,
    stopTimeMinutes: 0,
  })
}

function buildOverviewPanelData(dashboard) {
  if (!dashboard) return PANEL_DATA

  const panelData = { ...PANEL_DATA }
  const loadcellIn = dashboard.loadcell?.in
  const loadcellOut = dashboard.loadcell?.out
  const packaging = Array.isArray(dashboard.packaging) ? dashboard.packaging : []

  if (loadcellIn) {
    const statusOnline = loadcellIn.isOnline || panelOnline(loadcellIn.status)
    panelData[4] = [
      <PanelMetricRow key="status" label="Status" value={loadcellIn.status} valueClass={statusOnline ? 'text-emerald-300' : 'text-red-300'} />,
      <PanelMetricRow key="current" label="Weight IN" value={formatPanelNumber(loadcellIn.current, 2)} unit="kg" />,
      <PanelMetricRow key="maximum" label="Input max" value={formatPanelNumber(loadcellIn.maximum, 2)} unit="kg" />,
      <PanelMetricRow key="total" label="Input total" value={formatPanelNumber(loadcellIn.total, 2)} unit="kg" />,
    ]
  }

  if (loadcellOut) {
    const statusOnline = loadcellOut.isOnline || panelOnline(loadcellOut.status)
    panelData[7] = [
      <PanelMetricRow key="status" label="Status" value={loadcellOut.status} valueClass={statusOnline ? 'text-emerald-300' : 'text-red-300'} />,
      <PanelMetricRow key="current" label="Weight OUT" value={formatPanelNumber(loadcellOut.current, 2)} unit="kg" />,
      <PanelMetricRow key="maximum" label="Output max" value={formatPanelNumber(loadcellOut.maximum, 2)} unit="kg" />,
      <PanelMetricRow key="total" label="Output total" value={formatPanelNumber(loadcellOut.total, 2)} unit="kg" />,
    ]
  }

  if (packaging.length > 0) {
    const summary = getPackagingSummary(packaging)
    const issueCount = summary.alert + summary.alarm
    const statusTone = summary.disconnect > 0 || summary.alarm > 0
      ? 'text-red-300'
      : summary.standby > 0 || summary.alert > 0
        ? 'text-amber-300'
        : 'text-emerald-300'
    panelData[10] = [
      <PanelMetricRow key="status" label="Run/Std/Off/Issue" value={`${summary.running}/${summary.standby}/${summary.disconnect}/${issueCount}`} valueClass={statusTone} />,
      <PanelMetricRow key="power" label="Power" value={formatPanelNumber(summary.powerKw, 2)} unit="kW" />,
      <PanelMetricRow key="energy" label="Energy" value={formatPanelNumber(summary.powerKwh, 2)} unit="kWh" />,
      <PanelMetricRow key="working" label="Working" value={formatPanelNumber(summary.workingTimeMinutes)} unit="min" />,
      <PanelMetricRow key="stop" label="Stop" value={formatPanelNumber(summary.stopTimeMinutes)} unit="min" valueClass={summary.stopTimeMinutes > 0 ? 'text-red-300' : 'text-cyan-300'} />,
    ]
  }

  return panelData
}

function StaticPanels({ isPanel1Missing, dashboard }) {
  const { collapsed } = useSidebar()
  const { isTablet } = useDeviceType()
  const panelData = useMemo(() => buildOverviewPanelData(dashboard), [dashboard])
  const stateKey = isTablet
    ? (collapsed ? 'tabletCollapsed' : 'tabletExpanded')
    : (collapsed ? 'collapsed' : 'expanded')
  const isTabletLayout = stateKey === 'tabletCollapsed' || stateKey === 'tabletExpanded'
  const defaultPositions =
    isTabletLayout
      ? DEFAULT_POSITIONS_TABLET
      : stateKey === 'collapsed'
        ? DEFAULT_POSITIONS_COLLAPSED
        : DEFAULT_POSITIONS_EXPANDED
  const storageKey =
    isTabletLayout
      ? (collapsed ? 'overviewLayoutTabletCollapsed' : 'overviewLayoutTabletExpanded')
      : stateKey === 'collapsed'
        ? 'overviewLayoutCollapsed'
        : 'overviewLayoutExpanded'
  const mirroredProfileKeys = isTabletLayout ? TABLET_LAYOUT_PROFILE_KEYS : DESKTOP_LAYOUT_PROFILE_KEYS
  const desktopSourceKey = collapsed ? 'collapsed' : 'expanded'
  const fallbackDesktopKey = collapsed ? 'expanded' : 'collapsed'
  const defaultLayout = useMemo(() => ({
    imageOffset: { x: 0, y: 0 },
    imageScale: 1,
    imageWidthScale: 1,
    panels: Object.fromEntries(PROCESS_PANEL_IDS.map((id) => [
      id,
      { ...defaultPositions[id], scale: 1 }
    ]))
  }), [defaultPositions])
  const requireCurrentLayoutVersion = true

  const [layout, setLayout] = useState(defaultLayout)
  const [editMode, setEditMode] = useState(false)
  const [layoutSaving, setLayoutSaving] = useState(false)
  const [stageSize, setStageSize] = useState({ scaleX: 1, scaleY: 1, width: PROCESS_CANVAS_WIDTH, height: PROCESS_CANVAS_HEIGHT })
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const layoutRef = useRef(layout)
  const editModeRef = useRef(editMode)
  layoutRef.current = layout
  editModeRef.current = editMode

  const getStorageKeyForProfile = (key) => {
    if (key === 'collapsed') return 'overviewLayoutCollapsed'
    if (key === 'expanded') return 'overviewLayoutExpanded'
    if (key === 'tabletCollapsed') return 'overviewLayoutTabletCollapsed'
    if (key === 'tabletExpanded') return 'overviewLayoutTabletExpanded'
    return storageKey
  }

  const normalizeLayout = (data = defaultLayout, keepSavedAt = true) => {
    const panels = {}
    PROCESS_PANEL_IDS.forEach((id) => {
      const saved = data?.panels?.[id] || data?.panels?.[String(id)]
      if (!saved) return
      panels[id] = {
        left: Number(clampProcessValue(finiteOr(saved.left, defaultPositions[id].left), -5, 99).toFixed(1)),
        top: Number(clampProcessValue(finiteOr(saved.top, defaultPositions[id].top), -5, 99).toFixed(1)),
        scale: Number(clampProcessValue(finiteOr(saved.scale, 1), 0.6, 1.8).toFixed(2))
      }
    })

    return {
      ...defaultLayout,
      ...data,
      layoutCacheVersion: LAYOUT_CACHE_VERSION,
      imageOffset: {
        x: Math.round(clampProcessValue(finiteOr(data?.imageOffset?.x, 0), -900, 900)),
        y: Math.round(clampProcessValue(finiteOr(data?.imageOffset?.y, 0), -360, 520))
      },
      imageScale: Number(clampProcessValue(finiteOr(data?.imageScale, 1), 0.8, 1.35).toFixed(2)),
      imageWidthScale: Number(clampProcessValue(finiteOr(data?.imageWidthScale, 1), 0.8, 1.6).toFixed(2)),
      panels,
      savedAt: keepSavedAt && data?.savedAt ? data.savedAt : new Date().toISOString()
    }
  }

  const isSavedLayout = (data, requireCurrentVersion = false) => {
    if (!data || typeof data !== 'object') return false
    if (requireCurrentVersion && data.layoutCacheVersion !== LAYOUT_CACHE_VERSION) return false
    if (data.savedAt) return true
    if (data.panels && Object.keys(data.panels).length > 0) return true
    if (typeof data.imageScale === 'number' && data.imageScale !== 1) return true
    if (typeof data.imageWidthScale === 'number' && data.imageWidthScale !== 1) return true
    const x = Number(data.imageOffset?.x || 0)
    const y = Number(data.imageOffset?.y || 0)
    return x !== 0 || y !== 0
  }

  const savedTime = (data) => {
    const time = data?.savedAt ? new Date(data.savedAt).getTime() : 0
    return Number.isFinite(time) ? time : 0
  }

  const newestSavedLayout = (...items) => {
    const candidates = items
      .filter(Boolean)
      .map((data) => normalizeLayout(data))
    if (candidates.length === 0) return null
    return candidates.sort((a, b) => savedTime(b) - savedTime(a))[0]
  }

  const readSavedLocal = (key, requireCurrentVersion = false) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return isSavedLayout(parsed, requireCurrentVersion) ? normalizeLayout(parsed) : null
    } catch {
      return null
    }
  }

  const cacheLocal = (data, key = stateKey) => {
    try {
      localStorage.setItem(getStorageKeyForProfile(key), JSON.stringify(normalizeLayout(data)))
    } catch {}
  }

  const persistBackend = async (data, keys = stateKey) => {
    const normalized = normalizeLayout(data)
    const profileKeys = Array.isArray(keys) ? keys : [keys]
    return saveLayout(Object.fromEntries(profileKeys.map((key) => [key, normalized])))
  }

  const persistLayout = async (data, keys = stateKey) => {
    const normalized = normalizeLayout(data)
    const profileKeys = Array.isArray(keys) ? keys : [keys]
    try {
      profileKeys.forEach((key) => {
        localStorage.setItem(getStorageKeyForProfile(key), JSON.stringify(normalized))
      })
    } catch {}
    try {
      await persistBackend(normalized, profileKeys)
    } catch (err) {
      console.error('Persist overview layout failed:', err)
    }
    return normalized
  }

  const getPanelState = (id, source = layout) => {
    const base = defaultPositions[id]
    const saved = source.panels?.[id] || source.panels?.[String(id)] || {}
    return {
      left: Number(clampProcessValue(finiteOr(saved.left, base.left), -5, 99).toFixed(1)),
      top: Number(clampProcessValue(finiteOr(saved.top, base.top), -5, 99).toFixed(1)),
      scale: Number(clampProcessValue(finiteOr(saved.scale, 1), 0.6, 1.8).toFixed(2))
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      let backend = null
      try {
        backend = await getLayout()
      } catch {
        backend = null
      }
      if (cancelled) return

      const backendSaved = isSavedLayout(backend?.[stateKey], requireCurrentLayoutVersion) ? backend[stateKey] : null
      const localSaved = readSavedLocal(storageKey, requireCurrentLayoutVersion)
      const currentSaved = newestSavedLayout(backendSaved, localSaved)
      if (currentSaved) {
        cacheLocal(currentSaved, stateKey)
        if (editModeRef.current) return
        setLayout(currentSaved)
        return
      }

      // Migrate from the paired desktop profile once, but do not auto-save it
      // back over the current profile. This keeps panel positions from changing
      // just because the sidebar collapsed/expanded.
      const backendFallback = !isTabletLayout && isSavedLayout(backend?.[fallbackDesktopKey], requireCurrentLayoutVersion)
        ? backend[fallbackDesktopKey]
        : null
      const localFallback = !isTabletLayout
        ? readSavedLocal(getStorageKeyForProfile(fallbackDesktopKey), requireCurrentLayoutVersion)
        : null
      const fallbackSaved = newestSavedLayout(backendFallback, localFallback)
      if (fallbackSaved) {
        cacheLocal(fallbackSaved, stateKey)
        if (editModeRef.current) return
        setLayout(fallbackSaved)
        return
      }

      if (isTabletLayout) {
        const desktop = newestSavedLayout(
          isSavedLayout(backend?.[desktopSourceKey], requireCurrentLayoutVersion) ? backend[desktopSourceKey] : null,
          isSavedLayout(backend?.[fallbackDesktopKey], requireCurrentLayoutVersion) ? backend[fallbackDesktopKey] : null,
          readSavedLocal(`overviewLayout${desktopSourceKey === 'expanded' ? 'Expanded' : 'Collapsed'}`, requireCurrentLayoutVersion),
          readSavedLocal(`overviewLayout${fallbackDesktopKey === 'expanded' ? 'Expanded' : 'Collapsed'}`, requireCurrentLayoutVersion),
        )
        if (desktop) {
          const next = normalizeLayout(desktop, false)
          cacheLocal(next, stateKey)
          if (editModeRef.current) return
          setLayout(next)
          return
        }
      }

      if (editModeRef.current) return
      const next = normalizeLayout(defaultLayout, false)
      cacheLocal(next, stateKey)
      setLayout(next)
    }
    load()
    return () => { cancelled = true }
  }, [defaultLayout, desktopSourceKey, fallbackDesktopKey, isTabletLayout, stateKey, storageKey])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const update = () => {
      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const next = {
        scaleX: Math.max(0.1, rect.width / PROCESS_CANVAS_WIDTH),
        scaleY: Math.max(0.1, rect.height / PROCESS_CANVAS_HEIGHT),
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      }
      setStageSize((prev) => (
        Math.abs(prev.width - next.width) > 1 || Math.abs(prev.height - next.height) > 1
          ? next
          : prev
      ))
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(root)
    return () => resizeObserver.disconnect()
  }, [])

  const updateLayout = (updater) => {
    setLayout((prev) => {
      const next = normalizeLayout(typeof updater === 'function' ? updater(prev) : updater)
      layoutRef.current = next
      return next
    })
  }

  const commitLayout = (data = layoutRef.current) => persistLayout(data, mirroredProfileKeys)

  const finishEditing = async () => {
    setLayoutSaving(true)
    await commitLayout()
    setLayoutSaving(false)
    setEditMode(false)
  }

  const handleImagePointerDown = (event) => {
    if (!editMode || !stageRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const rect = stageRef.current.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const startOffset = layoutRef.current.imageOffset

    const handleMove = (moveEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * PROCESS_CANVAS_WIDTH
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * PROCESS_CANVAS_HEIGHT
      updateLayout((prev) => ({
        ...prev,
        imageOffset: {
          x: Math.round(clampProcessValue(startOffset.x + deltaX, -900, 900)),
          y: Math.round(clampProcessValue(startOffset.y + deltaY, -360, 520))
        }
      }))
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      commitLayout()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const handlePanelPointerDown = (event, id) => {
    if (!editMode || !stageRef.current) return
    event.preventDefault()
    const rect = stageRef.current.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = getPanelState(id, layoutRef.current)

    const handleMove = (moveEvent) => {
      const deltaLeft = ((moveEvent.clientX - startX) / rect.width) * 100
      const deltaTop = ((moveEvent.clientY - startY) / rect.height) * 100
      updateLayout((prev) => ({
        ...prev,
        panels: {
          ...prev.panels,
          [id]: {
            ...getPanelState(id, prev),
            left: Number(clampProcessValue(startPosition.left + deltaLeft, -5, 99).toFixed(1)),
            top: Number(clampProcessValue(startPosition.top + deltaTop, -5, 99).toFixed(1))
          }
        }
      }))
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      commitLayout()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const handlePanelResizePointerDown = (event, id) => {
    if (!editMode) return
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const startScale = getPanelState(id, layoutRef.current).scale

    const handleMove = (moveEvent) => {
      const deltaScale = (moveEvent.clientX - startX + moveEvent.clientY - startY) / 260
      const nextScale = Number(clampProcessValue(startScale + deltaScale, 0.6, 1.8).toFixed(2))
      updateLayout((prev) => ({
        ...prev,
        panels: {
          ...prev.panels,
          [id]: {
            ...getPanelState(id, prev),
            scale: nextScale
          }
        }
      }))
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      commitLayout()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  const handleImageScale = (value) => {
    const next = normalizeLayout({
      ...layoutRef.current,
      imageScale: Number(clampProcessValue(finiteOr(value, 1), 0.8, 1.35).toFixed(2))
    })
    setLayout(next)
    layoutRef.current = next
    mirroredProfileKeys.forEach((key) => cacheLocal(next, key))
  }

  const handleImageWidthScale = (value) => {
    const next = normalizeLayout({
      ...layoutRef.current,
      imageWidthScale: Number(clampProcessValue(finiteOr(value, 1), 0.8, 1.6).toFixed(2))
    })
    setLayout(next)
    layoutRef.current = next
    mirroredProfileKeys.forEach((key) => cacheLocal(next, key))
  }

  const resetLayout = async () => {
    const next = normalizeLayout(defaultLayout, false)
    setLayout(next)
    layoutRef.current = next
    try {
      mirroredProfileKeys.forEach((key) => localStorage.removeItem(getStorageKeyForProfile(key)))
    } catch {}
    await persistBackend(next, mirroredProfileKeys)
  }

  const syncFromDesktop = async () => {
    try {
      const backend = await getLayout()
      const desktop = backend?.[desktopSourceKey] || backend?.[fallbackDesktopKey] || null
      if (desktop) {
        const next = normalizeLayout(desktop, false)
        setLayout(next)
        layoutRef.current = next
        cacheLocal(next)
        await persistBackend(next)
        return
      }
      const desktopLocal = localStorage.getItem(`overviewLayout${desktopSourceKey === 'expanded' ? 'Expanded' : 'Collapsed'}`)
        || localStorage.getItem(`overviewLayout${fallbackDesktopKey === 'expanded' ? 'Expanded' : 'Collapsed'}`)
      if (desktopLocal) {
        const next = normalizeLayout(JSON.parse(desktopLocal), false)
        setLayout(next)
        layoutRef.current = next
        cacheLocal(next)
        await persistBackend(next)
      }
    } catch {}
  }

  const normalizedLayout = normalizeLayout(layout)
  const imageWidth = Math.round(PROCESS_IMAGE_BASE_WIDTH * normalizedLayout.imageScale * normalizedLayout.imageWidthScale)
  const imageHeight = Math.round(PROCESS_IMAGE_BASE_WIDTH * PROCESS_IMAGE_ASPECT_RATIO * normalizedLayout.imageScale)
  const imageLeft = (PROCESS_CANVAS_WIDTH - imageWidth) / 2 + normalizedLayout.imageOffset.x
  const imageTop = PROCESS_IMAGE_BASE_TOP + normalizedLayout.imageOffset.y

  return (
    <div ref={rootRef} className={`relative h-full min-h-0 overflow-hidden rounded-xl ${OVERVIEW_CONTAINER_FRAME_CLASSES.process} bg-bg-card/40 shadow-[0_18px_54px_rgba(0,0,0,0.38)] select-none`}>
      {SHOW_OVERVIEW_MACHINE_INFO_PANELS && (
        <div className="absolute right-2 top-2 z-30 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (editMode) {
                finishEditing()
                return
              }
              setEditMode(true)
            }}
            disabled={layoutSaving}
            className={`rounded border px-2 py-1 text-[10px] font-bold ${editMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}
          >
            {layoutSaving ? 'กำลังบันทึก...' : editMode ? 'เสร็จสิ้น' : 'จัดหน้า'}
          </button>
          {editMode && (
            <button
              onClick={resetLayout}
              type="button"
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300"
            >
              คืนค่าเริ่มต้น
            </button>
          )}
          {editMode && isTablet && (
            <button
              onClick={syncFromDesktop}
              type="button"
              className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-300"
            >
              คัดลอกจาก PC
            </button>
          )}
          {editMode && (
            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
              <span>รูป</span>
              <input
                type="range"
                min="0.8"
                max="1.35"
                step="0.01"
                value={normalizedLayout.imageScale}
                onChange={(event) => handleImageScale(event.target.value)}
                onPointerUp={() => commitLayout()}
                onKeyUp={() => commitLayout()}
                onBlur={() => commitLayout()}
                className="h-1 w-20 cursor-pointer appearance-none rounded bg-slate-600 accent-sky-400"
                aria-label="ปรับขนาดรูป"
              />
              <span className="w-9 text-right font-mono">{normalizedLayout.imageScale.toFixed(2)}x</span>
            </label>
          )}
          {editMode && (
            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
              <span>กว้าง</span>
              <input
                type="range"
                min="0.8"
                max="1.6"
                step="0.01"
                value={normalizedLayout.imageWidthScale}
                onChange={(event) => handleImageWidthScale(event.target.value)}
                onPointerUp={() => commitLayout()}
                onKeyUp={() => commitLayout()}
                onBlur={() => commitLayout()}
                className="h-1 w-20 cursor-pointer appearance-none rounded bg-slate-600 accent-sky-400"
                aria-label="ปรับความกว้างรูป"
              />
              <span className="w-9 text-right font-mono">{normalizedLayout.imageWidthScale.toFixed(2)}x</span>
            </label>
          )}
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden">
        <div
          ref={stageRef}
          className="absolute left-0 top-0 overflow-visible"
          style={{
            width: `${PROCESS_CANVAS_WIDTH}px`,
            height: `${PROCESS_CANVAS_HEIGHT}px`,
            transform: `scale(${stageSize.scaleX}, ${stageSize.scaleY})`,
            transformOrigin: 'top left'
          }}
        >
          <img
            src="/OEE ThaiHa2.png"
            alt="OEE Dashboard"
            onPointerDown={handleImagePointerDown}
            className={`absolute z-0 select-none rounded-lg ${editMode ? 'cursor-move' : ''}`}
            style={{
              left: `${imageLeft}px`,
              top: `${imageTop}px`,
              width: `${imageWidth}px`,
              height: `${imageHeight}px`,
              touchAction: editMode ? 'none' : undefined
            }}
            draggable={false}
          />

          {SHOW_OVERVIEW_MACHINE_INFO_PANELS && Object.entries(panelData).map(([idStr, children]) => {
            const id = Number(idStr)
            const state = getPanelState(id, normalizedLayout)
            const isMissing = id === 1 && isPanel1Missing
            return (
              <div
                key={id}
                onPointerDown={(event) => handlePanelPointerDown(event, id)}
                className={`overview-machine-panel absolute z-10 ${PANEL_WIDTH_CLASSES[id] || 'w-40'} rounded-md border ${isMissing ? 'animate-blink-yellow-border border-yellow-500/70' : 'border-slate-600/50'} bg-[#0B1221]/92 px-1.5 py-1.5 text-white shadow-lg ${editMode ? 'cursor-move ring-1 ring-sky-500/50' : ''}`}
                style={{
                  left: `${state.left}%`,
                  top: `${state.top}%`,
                  transform: `scale(${state.scale})`,
                  transformOrigin: 'top left',
                  touchAction: editMode ? 'none' : undefined
                }}
              >
                {isMissing && (
                  <div className="mb-1.5 flex items-center gap-1 rounded border border-yellow-500/50 bg-yellow-500/15 px-1 py-0.5 text-[8px] font-bold text-yellow-300">
                    <span className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-black">!</span>
                    <span>กรุณากรอกข้อมูล</span>
                  </div>
                )}
                <div className="overview-machine-panel-rows">
                  {children}
                </div>
                {editMode && (
                  <button
                    type="button"
                    onPointerDown={(event) => handlePanelResizePointerDown(event, id)}
                    aria-label="Resize panel"
                    className="absolute -bottom-1.5 -right-1.5 z-20 h-3 w-3 cursor-se-resize rounded-full border border-sky-200 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Data from container ──────────────────────────────────────────
export default function Overview() {
  const [selectedMachine, setSelectedMachine] = useState(null)
  const { topMetrics, machines, losses, alerts, loading } = useOEEData()
  const { dashboard: nodeRedDashboard } = useNodeRedDashboard()
  const { isTablet, isLandscape } = useDeviceType()
  // iPad landscape (incl. iPad Pro 12.9" ≤1366px) uses the same two-column
  // monitor pattern as desktop (control + Alarm on the right), but with
  // natural height so it scrolls instead of being clipped.
  // iPad portrait stays stacked (too narrow for two columns).
  const tabletWide = isTablet && isLandscape
  const monitorGap = tabletWide ? 'gap-2' : 'gap-3'
  const pagePad = tabletWide ? 'px-2' : 'px-4'
  const desk = tabletWide
    ? 'h-full overflow-hidden'
    : isTablet
      ? ''
      : 'xl:h-[calc(100vh-6rem)] xl:overflow-hidden'
  const mainGrid = tabletWide
    ? 'h-full grid-cols-[minmax(0,1fr)_minmax(292px,320px)]'
    : `grid-cols-1 ${isTablet ? '' : 'xl:h-full xl:grid-cols-[minmax(630px,1fr)_minmax(300px,336px)]'}`
  // After OEE/Control swap: left column top = Control (auto height),
  // right column top = OEE (auto height); both bottom rows fill remaining space.
  const deskRowsLeft = tabletWide
    ? 'grid-rows-[auto_minmax(0,1fr)]'
    : isTablet
      ? ''
      : 'xl:grid-rows-[auto_minmax(0,1fr)]'
  const deskControl = isTablet ? '' : 'xl:overflow-hidden'
  const rightColumn = tabletWide
    ? 'h-full overflow-hidden'
    : isTablet
      ? ''
      : 'xl:h-full xl:overflow-hidden'
  const deskTop = isTablet ? '' : 'xl:w-full'
  const oeePanelHeight = tabletWide ? 'h-[220px]' : isTablet ? '' : 'xl:h-[220px]'
  const metricsGaugePanelHeight = tabletWide ? 'h-[118px]' : isTablet ? '' : 'xl:h-[124px]'
  const alarmPanelHeight = tabletWide ? 'flex-1' : isTablet ? '' : 'xl:flex-1'
  // iPad gets a much tighter control panel so the green frame takes less height.
  const cPad = isTablet ? 'p-1' : 'p-2'
  const cTitleMb = isTablet ? 'mb-0' : 'mb-1'
  const cGap = isTablet ? 'mt-0' : 'mt-1'
  const cBoxPad = isTablet ? 'p-0.5' : 'p-1.5'
  const cBoxInner = isTablet ? 'mt-0' : 'mt-0.5'
  const cBtnPy = isTablet ? 'py-0.5' : 'py-1'
  const cBoxWrap = isTablet ? 'grid grid-cols-2 gap-2' : ''
  const oeePad = tabletWide ? 'p-1.5' : 'p-2'
  const alarmPad = tabletWide ? 'p-2' : 'p-3'

  const [savedShifts, setSavedShifts] = useState([])
  const [stockProducts, setStockProducts] = useState([])
  const [stockData, setStockData] = useState([])
  const [productionEntries, setProductionEntries] = useState([])
  const [productOEEHistory, setProductOEEHistory] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_OEE_TREND_STORAGE_KEY) || '[]')
      return Array.isArray(parsed) ? parsed.slice(-30) : []
    } catch {
      return []
    }
  })
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [entrySuccessOpen, setEntrySuccessOpen] = useState(false)
  const [todayEntriesOpen, setTodayEntriesOpen] = useState(false)
  const [autoRunningEntry, setAutoRunningEntry] = useState(null)
  const [lineStatus, setLineStatus] = useState('idle') // 'idle' | 'running' | 'cleaning'
  const [runningTick, setRunningTick] = useState(0) // increments every second while running
  const [cleaningSeconds, setCleaningSeconds] = useState(0)
  const [restored, setRestored] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ show: false, action: null }) // action: 'start' | 'stop'
  const [nowMinutes, setNowMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  const MOCK_PROCESS_DURATION = 5 // seconds per process (mock)

  const isRunning = lineStatus === 'running'
  const shiftQueue = [...savedShifts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const currentShift = shiftQueue.find((s) => s.status === 'running') || shiftQueue.find((s) => s.status === 'waiting')
  const nextShift = shiftQueue.find((s) => s.status === 'waiting' && s.id !== currentShift?.id)

  const products = useMemo(() => {
    const list = stockProducts
      .filter((value, index, self) => self.indexOf(value) === index)
    return list.length > 0 ? list : []
  }, [stockProducts])

  const buildEntry = (form, day) => {
    const startHour = Number(form.startHour)
    const endHour = Number(form.endHour)
    const startMinutes = startHour * 60
    const endMinutes = Math.max(endHour, startHour + 1) * 60
    return {
      id: `entry-${Date.now()}`,
      name: form.product || 'ไม่ระบุสินค้า',
      product: form.product,
      day,
      time: `${formatProductionHourLabel(startHour)} - ${formatProductionHourLabel(Math.floor(endMinutes / 60))}`,
      startMinutes,
      endMinutes,
      status: 'running',
      color: '#22d3ee',
      data: { ...form },
    }
  }

  const createShiftFromProductionEntry = async (entry) => {
    const payload = buildShiftPayloadFromEntry(entry, savedShifts)
    const res = await api.createShift(payload)
    const createdShift = normalizeShift(res.data, savedShifts.length)
    setSavedShifts((prev) => [...prev, createdShift].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    notifyShiftsChanged()
    return createdShift
  }

  const saveProductionEntry = async (form) => {
    const day = form.day ? new Date(form.day) : new Date()
    day.setHours(0, 0, 0, 0)
    const entry = buildEntry(form, day)
    try {
      const res = await api.createProductionEntry(mapOverviewEntryToBackend(entry))
      const savedEntry = mapBackendProductionEntry(res.data || entry)
      let finalEntry = savedEntry
      try {
        const createdShift = await createShiftFromProductionEntry(savedEntry)
        if (createdShift?.id && savedEntry.backendId) {
          const linked = await api.updateProductionEntry(savedEntry.backendId, {
            shiftId: createdShift.id,
            shift: createdShift.name,
          })
          finalEntry = mapBackendProductionEntry(linked.data || {
            ...savedEntry,
            shiftId: createdShift.id,
            shift: createdShift.name,
          })
        } else if (createdShift?.id) {
          finalEntry = { ...savedEntry, shiftId: createdShift.id, shift: createdShift.name }
        }
      } catch (shiftErr) {
        console.error('Create shift from overview entry failed:', shiftErr)
      }
      const updated = [...productionEntries, finalEntry]
      setProductionEntries(updated)
      localStorage.setItem(PRODUCTION_ENTRIES_STORAGE_KEY, JSON.stringify(updated))
      notifyProductionEntriesChanged()
      setEntrySuccessOpen(true)
    } catch (err) {
      console.error('Save production entry failed:', err)
      alert('บันทึกแผนผลิตไม่สำเร็จ: ' + (err.message || 'Unknown error'))
      return
    }
    setEntryModalOpen(false)
  }

  const currentProcess = Math.min(5, Math.floor(runningTick / MOCK_PROCESS_DURATION) + 1)
  const processSeconds = Math.max(0, MOCK_PROCESS_DURATION - (runningTick % MOCK_PROCESS_DURATION))

  const currentShiftRef = useRef(currentShift)
  currentShiftRef.current = currentShift
  const shiftQueueRef = useRef(shiftQueue)
  shiftQueueRef.current = shiftQueue

  useEffect(() => {
    let cancelled = false
    const loadProductionEntries = async () => {
      try {
        const res = await api.getProductionEntries({ limit: 1000 })
        if (cancelled) return
        const entries = (res.data || []).map(mapBackendProductionEntry)
        setProductionEntries(entries)
        localStorage.setItem(PRODUCTION_ENTRIES_STORAGE_KEY, JSON.stringify(entries))
        return
      } catch (err) {
        console.error('Load production entries failed:', err)
      }

      try {
        const saved = localStorage.getItem(PRODUCTION_ENTRIES_STORAGE_KEY)
        if (saved && !cancelled) {
          const parsed = JSON.parse(saved)
          setProductionEntries(parsed.map((e) => ({ ...e, day: new Date(e.day) })))
        }
      } catch {
        if (!cancelled) setProductionEntries([])
      }
    }
    loadProductionEntries()
    const handleProductionEntriesChanged = () => loadProductionEntries()
    const handleStorage = (event) => {
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY) loadProductionEntries()
    }
    window.addEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchShifts = async () => {
      try {
        const json = await api.getShifts()
        if (cancelled) return
        if (json.success && Array.isArray(json.data)) {
          const shifts = json.data.map((s, index) => normalizeShift(s, index))
          setSavedShifts(shifts)
        }
      } catch {
        if (!cancelled) setSavedShifts([])
      }
    }
    const fetchStockProducts = async () => {
      try {
        const res = await api.getMaterialStock()
        if (cancelled) return
        const items = (res.data || []).filter((s) => (s.received || 0) > 0)
        setStockData(items)
        setStockProducts(items.map((s) => s.product))
      } catch {
        if (!cancelled) {
          setStockData([])
          setStockProducts([])
        }
      }
    }
    fetchShifts()
    fetchStockProducts()
    const handleShiftsChanged = () => fetchShifts()
    const handleStorage = (event) => {
      if (event.key === SHIFTS_SYNC_KEY) fetchShifts()
    }
    window.addEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      cancelled = true
      window.removeEventListener(SHIFTS_CHANGED_EVENT, handleShiftsChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Restore running/cleaning state from localStorage after navigation away
  useEffect(() => {
    if (restored) return
    const saved = localStorage.getItem('overviewState')
    if (!saved) {
      setRestored(true)
      return
    }
    try {
      const parsed = JSON.parse(saved)
      const elapsed = Math.floor((Date.now() - (parsed.lastUpdated || Date.now())) / 1000)
      if (parsed.lineStatus === 'cleaning') {
        const remaining = Math.max(0, parsed.cleaningSeconds - elapsed)
        if (remaining > 0) {
          setLineStatus('cleaning')
          setCleaningSeconds(remaining)
          setRunningTick(5 * MOCK_PROCESS_DURATION)
        } else {
          // Cleaning expired while away — do not auto-start the next product.
          // Wait for the user to press Start manually.
          setLineStatus('idle')
          setRunningTick(0)
          setCleaningSeconds(0)
        }
      } else if (parsed.lineStatus === 'running') {
        const restoredShift = shiftQueue.find((s) => s.id === parsed.currentShiftId)
        if (!restoredShift) {
          setLineStatus('idle')
          setRunningTick(0)
          setCleaningSeconds(0)
          setAutoRunningEntry(null)
          return
        }
        const savedTick = parsed.runningTick || 0
        const effectiveTick = savedTick + elapsed
        if (effectiveTick >= 5 * MOCK_PROCESS_DURATION && restoredShift) {
          // P5 finished while away; move to cleaning and consume remaining time
          const overshoot = effectiveTick - 5 * MOCK_PROCESS_DURATION
          const cleaningDuration = getCleaningSeconds(restoredShift)
          const remaining = Math.max(0, cleaningDuration - overshoot)
          updateShift(restoredShift.id, { status: 'done', order: Math.max(...shiftQueue.map((s) => s.order ?? 0), 0) + 1 })
          if (remaining > 0) {
            setLineStatus('cleaning')
            setCleaningSeconds(remaining)
            setRunningTick(0)
          } else {
            // Both production and cleaning finished while away — do not auto-start
            // the next product. Wait for the user to press Start manually.
            setLineStatus('idle')
            setRunningTick(0)
            setCleaningSeconds(0)
          }
        } else {
          setLineStatus('running')
          setRunningTick(effectiveTick)
          setCleaningSeconds(0)
          if (restoredShift && restoredShift.status !== 'running') {
            updateShift(restoredShift.id, { status: 'running' })
          }
        }
      }
    } catch (err) {
      console.error('Restore overview state failed:', err)
    } finally {
      setRestored(true)
    }
  }, [savedShifts])

  // Persist running/cleaning state so it survives page navigation
  useEffect(() => {
    if (!restored) return
    localStorage.setItem('overviewState', JSON.stringify({
      lineStatus,
      runningTick,
      cleaningSeconds,
      currentShiftId: currentShift?.id || null,
      autoRunningEntryId: autoRunningEntry?.id || null,
      lastUpdated: Date.now()
    }))
  }, [lineStatus, runningTick, cleaningSeconds, currentShift?.id, autoRunningEntry?.id, restored])

  const scheduleNow = useMemo(() => new Date(), [nowMinutes])
  const scheduledEntries = useMemo(() => (
    productionEntries
      .map((entry, index) => {
        const range = getEntryScheduleRange(entry)
        if (!range || !(entry.product || entry.name)) return null
        return { entry, index, ...range }
      })
      .filter(Boolean)
      .sort((a, b) => a.startAt - b.startAt || a.index - b.index)
  ), [productionEntries])
  const currentScheduleItem = scheduledEntries.find((item) => scheduleNow >= item.startAt && scheduleNow < item.endAt) || null
  const nextScheduleItem = scheduledEntries.find((item) => scheduleNow < item.startAt) || null
  const primaryScheduleItem = currentScheduleItem || nextScheduleItem
  const displayScheduleItem = lineStatus === 'cleaning' ? nextScheduleItem : primaryScheduleItem
  const followingScheduleItem = displayScheduleItem
    ? scheduledEntries.find((item) => item.index !== displayScheduleItem.index && item.startAt > displayScheduleItem.startAt) || null
    : null
  const primaryCalendarEntry = lineStatus === 'cleaning'
    ? displayScheduleItem?.entry || null
    : autoRunningEntry || displayScheduleItem?.entry || null
  const nextCalendarEntry = followingScheduleItem?.entry || null

  // Production quantity: weights come from user-entered calendar entries
  const activeEntrySource = primaryCalendarEntry || (scheduledEntries.length === 0 ? currentShift : null)
  const currentEntry = activeEntrySource?.data
    ? activeEntrySource
    : activeEntrySource
      ? productionEntries
        .filter((e) => e.product === activeEntrySource.product || e.name === activeEntrySource.product || e.id === activeEntrySource.id)
        .sort((a, b) => new Date(b.day) - new Date(a.day))[0]
      : null
  const standardWeight = currentEntry ? parseFloat(currentEntry.data?.standardWeight) || 0 : 0
  const receivedWeight = currentEntry ? parseFloat(currentEntry.data?.inputWeight) || 0 : 0
  const isSuccess = receivedWeight >= standardWeight && standardWeight > 0
  // Panel 1 (humidity + received quantity) warns when input data is missing.
  const isPanel1Missing = !receivedWeight

  // Quality / FPY — mock value for now, no formula
  const shiftQuality = 98.5
  const topMetricsAdjusted = topMetrics.map((m) =>
    m.title === 'Quality / FPY'
      ? { ...m, value: Math.round(shiftQuality * 10) / 10, label: 'Good 3,106 · Scrap 33' }
      : m
  )

  // Calculate Overall OEE = Availability × Performance × Quality / 10000
  const a = topMetricsAdjusted.find(m => m.title === 'Availability')?.value ?? 0
  const p = topMetricsAdjusted.find(m => m.title === 'Performance')?.value ?? 0
  const q = topMetricsAdjusted.find(m => m.title === 'Quality / FPY')?.value ?? 0
  const overallOEE = topMetricsAdjusted.length > 0 ? ((a * p * q) / 10000).toFixed(1) : 0
  const formatGaugeValue = (value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.round(numeric).toString() : '0'
  }
  const overallOEEText = formatGaugeValue(overallOEE)
  const mainGaugeValueClass = tabletWide ? 'text-[30px]' : 'text-[32px] sm:text-[34px]'
  const semiGaugeValueClass = tabletWide ? 'text-[16px]' : 'text-[18px]'
  const trendProductSource = currentEntry || activeEntrySource || primaryCalendarEntry || currentShift || null
  const trendProductName = trendProductSource?.product || trendProductSource?.name || ''
  const trendProductDay = trendProductSource?.day || trendProductSource?.productionDate || trendProductSource?.date || ''
  const trendProductDayDate = trendProductDay ? new Date(trendProductDay) : null
  const trendProductDayKey = trendProductDayDate && !Number.isNaN(trendProductDayDate.getTime())
    ? trendProductDayDate.toISOString().slice(0, 10)
    : ''
  const trendProductKey = trendProductName
    ? [
      trendProductSource?.id || trendProductSource?.backendId || trendProductSource?.shiftId || trendProductName,
      trendProductDayKey,
      trendProductSource?.startMinutes ?? '',
      trendProductSource?.endMinutes ?? '',
    ].join('|')
    : ''
  const trendHistoryForComparison = useMemo(() => {
    if (!trendProductKey) return productOEEHistory
    const hasRealPrevious = productOEEHistory.some((item) => item?.key && item.key !== trendProductKey)
    return hasRealPrevious ? productOEEHistory : [...MOCK_PRODUCT_OEE_TREND_HISTORY, ...productOEEHistory]
  }, [productOEEHistory, trendProductKey])
  const previousProductTrend = useMemo(() => {
    if (!trendProductKey) return null
    const currentIndex = trendHistoryForComparison.findIndex((item) => item.key === trendProductKey)
    const searchEnd = currentIndex >= 0 ? currentIndex : trendHistoryForComparison.length
    for (let i = searchEnd - 1; i >= 0; i -= 1) {
      const item = trendHistoryForComparison[i]
      if (item?.key && item.key !== trendProductKey) return item
    }
    return null
  }, [trendHistoryForComparison, trendProductKey])
  const trendDiffValue = previousProductTrend
    ? Math.round((Number(overallOEE) - Number(previousProductTrend.oee)) * 10) / 10
    : null
  const oeeTrend = previousProductTrend && Number.isFinite(trendDiffValue)
    ? {
      direction: trendDiffValue > 0.05 ? 'up' : trendDiffValue < -0.05 ? 'down' : 'flat',
      diff: Math.abs(trendDiffValue),
      previous: previousProductTrend,
    }
    : null
  const oeeTrendClass = oeeTrend?.direction === 'up'
    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
    : oeeTrend?.direction === 'down'
      ? 'border-amber-400/35 bg-amber-400/10 text-amber-200'
      : 'border-slate-400/25 bg-slate-400/10 text-slate-300'

  useEffect(() => {
    const nextOEE = Number(overallOEE)
    if (!trendProductKey || !trendProductName || !Number.isFinite(nextOEE)) return

    setProductOEEHistory((prev) => {
      const roundedOEE = Math.round(nextOEE * 10) / 10
      const existingIndex = prev.findIndex((item) => item.key === trendProductKey)
      const updatedAt = new Date().toISOString()
      let next

      if (existingIndex >= 0) {
        const existing = prev[existingIndex]
        if (existing.product === trendProductName && Number(existing.oee) === roundedOEE) return prev
        next = [...prev]
        next[existingIndex] = { ...existing, product: trendProductName, oee: roundedOEE, updatedAt }
      } else {
        next = [...prev, { key: trendProductKey, product: trendProductName, oee: roundedOEE, updatedAt }]
      }

      const trimmed = next.slice(-30)
      try {
        localStorage.setItem(PRODUCT_OEE_TREND_STORAGE_KEY, JSON.stringify(trimmed))
      } catch {
        // ignore trend cache write errors
      }
      return trimmed
    })
  }, [overallOEE, trendProductKey, trendProductName])

  const todayEntries = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return productionEntries
      .filter((e) => {
        const entryDay = new Date(e.day)
        entryDay.setHours(0, 0, 0, 0)
        return entryDay.getTime() === today.getTime()
      })
      .sort((a, b) => a.startMinutes - b.startMinutes)
  }, [productionEntries])

  const currentMinutesNow = nowMinutes
  const nextTodayEntry = todayEntries.find((e) => currentMinutesNow < e.endMinutes) || null
  const todayProductionDone = todayEntries.length > 0 && !nextTodayEntry && lineStatus === 'idle'
  const getTodayEntryStatus = (entry) => {
    if (currentMinutesNow >= entry.endMinutes) {
      return {
        label: 'เสร็จ',
        className: 'bg-emerald-500/20 text-emerald-300',
      }
    }
    if (currentMinutesNow >= entry.startMinutes && currentMinutesNow < entry.endMinutes) {
      return {
        label: 'กำลังผลิต',
        className: 'bg-sky-500/20 text-sky-300',
      }
    }
    return {
      label: 'รอ',
      className: 'bg-slate-500/20 text-slate-400',
    }
  }
  const entryModalSlot = useMemo(() => ({ day: new Date(), hour: new Date().getHours() }), [entryModalOpen])

  // Update current time every minute so "next entry" stays accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(new Date().getHours() * 60 + new Date().getMinutes())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const formatCleaningTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getCleaningSeconds = (shift) => {
    const [h, m] = (shift?.cleaningTime || '00:00').split(':').map(Number)
    return ((h || 0) * 60 + (m || 0)) * 60
  }

  const updateShift = async (id, updates) => {
    try {
      await api.updateShift(id, updates)
      setSavedShifts((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s))
      notifyShiftsChanged()
    } catch (err) {
      console.error('Update shift failed:', err)
    }
  }

  const doStart = () => {
    const scheduledEntryToStart = lineStatus === 'cleaning'
      ? nextScheduleItem?.entry
      : currentScheduleItem?.entry || nextScheduleItem?.entry || autoRunningEntry

    if (scheduledEntryToStart) {
      setAutoRunningEntry(scheduledEntryToStart)
      setRunningTick(0)
      setLineStatus('running')
      setCleaningSeconds(0)
      return
    }

    if (!currentShift) return
    updateShift(currentShift.id, { status: 'running' })
    setRunningTick(0)
    setLineStatus('running')
    setCleaningSeconds(0)
  }

  const doStop = () => {
    if (currentShift) updateShift(currentShift.id, { status: 'waiting' })
    setAutoRunningEntry(null)
    setLineStatus('idle')
    setRunningTick(0)
    setCleaningSeconds(0)
  }

  const handleStartClick = () => {
    if (lineStatus === 'cleaning') {
      setConfirmDialog({ show: true, action: 'start' })
      return
    }
    doStart()
  }

  const handleStopClick = () => {
    if (lineStatus === 'cleaning') {
      setConfirmDialog({ show: true, action: 'stop' })
      return
    }
    doStop()
  }

  const handleConfirmDialog = () => {
    if (confirmDialog.action === 'start') doStart()
    else if (confirmDialog.action === 'stop') doStop()
    setConfirmDialog({ show: false, action: null })
  }

  const startNextShift = () => {
    if (nextScheduleItem?.entry) {
      setAutoRunningEntry(nextScheduleItem.entry)
      setRunningTick(0)
      setLineStatus('running')
      setCleaningSeconds(0)
      return
    }

    const next = shiftQueue.find((s) => s.status === 'waiting')
    if (next) {
      updateShift(next.id, { status: 'running' })
      setRunningTick(0)
      setLineStatus('running')
    } else {
      setLineStatus('idle')
      setRunningTick(0)
    }
  }

  // Auto-start from production entries when current time is within scheduled range
  useEffect(() => {
    if (lineStatus !== 'idle' || !restored) return
    const currentMinutes = nowMinutes
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const matched = productionEntries.find((e) => {
      const entryDay = getEntryDayStart(e)
      if (!entryDay || entryDay.getTime() !== today.getTime()) return false
      return currentMinutes >= e.startMinutes && currentMinutes < e.endMinutes
    })
    if (matched) {
      setAutoRunningEntry(matched)
      setRunningTick(0)
      setLineStatus('running')
      setCleaningSeconds(0)
    }
  }, [lineStatus, nowMinutes, restored, productionEntries])

  useEffect(() => {
    if (!restored || lineStatus !== 'running' || !autoRunningEntry) return

    const entryDay = getEntryDayStart(autoRunningEntry)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (!entryDay || entryDay.getTime() > today.getTime()) return

    const isPastDay = entryDay.getTime() < today.getTime()
    const endMinutes = Number(autoRunningEntry.endMinutes) || 0
    const isPastEndTime = nowMinutes >= endMinutes
    if (!isPastDay && !isPastEndTime) return

    const elapsedAfterEnd = isPastDay
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, (nowMinutes - endMinutes) * 60)
    const remainingCleaningSeconds = Math.max(0, getEntryCleaningSeconds(autoRunningEntry) - elapsedAfterEnd)

    setRunningTick(5 * MOCK_PROCESS_DURATION)
    if (remainingCleaningSeconds > 0) {
      setLineStatus('cleaning')
      setCleaningSeconds(remainingCleaningSeconds)
    } else {
      setLineStatus('idle')
      setCleaningSeconds(0)
      setAutoRunningEntry(null)
    }
  }, [autoRunningEntry, lineStatus, nowMinutes, restored])

  // Clear auto-running entry when line goes back to idle
  useEffect(() => {
    if (lineStatus === 'idle') setAutoRunningEntry(null)
  }, [lineStatus])

  // Auto-advance mock production sequence: P1 → P2 → P3 → P4 → P5 → cleaning → next shift
  useEffect(() => {
    if (lineStatus !== 'running') return
    const timer = setInterval(() => setRunningTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [lineStatus])

  useEffect(() => {
    if (lineStatus !== 'running') return
    const currentShift = currentShiftRef.current
    if (!currentShift && !autoRunningEntry) return
    if (runningTick < 5 * MOCK_PROCESS_DURATION) return
    // P5 done: mark current shift done, move to end of queue, start cleaning
    if (autoRunningEntry) {
      const cleaningMinutes = Number(autoRunningEntry.data?.cleaningHours || 0) * 60 + Number(autoRunningEntry.data?.cleaningMinutes || 0)
      setCleaningSeconds(cleaningMinutes * 60)
    } else if (currentShift) {
      const shiftQueue = shiftQueueRef.current
      const maxOrder = Math.max(...shiftQueue.map((s) => s.order ?? 0), 0)
      updateShift(currentShift.id, { status: 'done', order: maxOrder + 1 })
      setCleaningSeconds(getCleaningSeconds(currentShift))
    }
    setLineStatus('cleaning')
    setRunningTick(5 * MOCK_PROCESS_DURATION)
  }, [lineStatus, runningTick, autoRunningEntry])

  useEffect(() => {
    if (lineStatus !== 'cleaning' || cleaningSeconds <= 0) return
    const timer = setInterval(() => setCleaningSeconds((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [lineStatus, cleaningSeconds])

  useEffect(() => {
    if (lineStatus === 'cleaning' && cleaningSeconds <= 0) {
      startNextShift()
    }
  }, [cleaningSeconds, lineStatus])

  const hasCalendarPlan = scheduledEntries.length > 0
  const fallbackCurrentShiftLabel = !hasCalendarPlan && currentShift
    ? `${currentShift.product || '—'} กะ${currentShift.name}`
    : null
  const fallbackNextShiftLabel = !hasCalendarPlan && nextShift
    ? `${nextShift.product || '—'} กะ${nextShift.name}`
    : null
  const primaryProductLabel = primaryCalendarEntry
    ? formatScheduleEntryLabel(primaryCalendarEntry)
    : fallbackCurrentShiftLabel
      || (todayProductionDone ? 'วันนี้ผลิตครบแล้ว' : 'ดูสินค้าที่จะผลิตในวันนี้')
  const nextProductLabel = nextCalendarEntry
    ? formatScheduleEntryLabel(nextCalendarEntry)
    : fallbackNextShiftLabel || '—'
  const hasPrimaryProduct = Boolean(primaryCalendarEntry || fallbackCurrentShiftLabel)
  const canStart = lineStatus !== 'running' && Boolean(
    lineStatus === 'cleaning'
      ? nextScheduleItem?.entry || (!hasCalendarPlan && currentShift)
      : currentScheduleItem?.entry
        || nextScheduleItem?.entry
        || autoRunningEntry
        || (!hasCalendarPlan && currentShift)
  )

  return (
    <Fragment>
      <div className={`mx-auto ${pagePad} ${desk}`}>
        {/* Main monitor zones: OEE + product + image on the left, alarms on the right */}
      <div className={`grid ${monitorGap} ${mainGrid}`}>
        <div className={`grid min-h-0 grid-cols-1 ${monitorGap} ${deskRowsLeft}`}>
            <section className={`rounded-xl ${OVERVIEW_CONTAINER_FRAME_CLASSES.control} bg-bg-card/90 ${cPad} panel ${deskControl}`}>
          <div className={`${cTitleMb} flex items-center justify-between gap-3`}>
            <div>
              <div className="section-head">ควบคุมการทำงาน</div>
              <div className={`font-mono text-xs font-bold ${isRunning ? 'text-emerald-300' : lineStatus === 'cleaning' ? 'text-amber-300' : 'text-rose-400'}`}>
                {lineStatus === 'running' && currentProcess > 0
                  ? `PROCESS ${currentProcess} RUNNING`
                  : lineStatus === 'cleaning'
                    ? `CLEANING ${formatCleaningTime(cleaningSeconds)}`
                    : 'STOPPED'}
              </div>
            </div>
            <div className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${isSuccess ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
              {isSuccess ? 'Quality OK' : 'Below Target'}
            </div>
          </div>

          <div className={cBoxWrap}>
            <div
              onClick={() => {
                if (!hasPrimaryProduct) setTodayEntriesOpen(true)
              }}
              className={`rounded-lg border ${cBoxPad} ${lineStatus === 'running' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-bg-panel/45'} ${!hasPrimaryProduct ? 'cursor-pointer hover:border-sky-500/40 hover:bg-sky-500/10' : ''}`}
            >
              <div className="text-[9px] leading-none text-slate-400">
                {lineStatus === 'running' ? 'กำลังดำเนินการ' : lineStatus === 'cleaning' ? 'สินค้าที่จะเริ่มผลิต (หลัง cleaning)' : 'สินค้าที่จะเริ่มผลิต'}
              </div>
              <div className={`${cBoxInner} truncate text-xs font-bold text-slate-100`}>
                {primaryProductLabel}
              </div>
            </div>

            <div className={`${isTablet ? '' : cGap} rounded-lg border border-border bg-bg-panel/35 ${cBoxPad}`}>
              <div className="text-[9px] leading-none text-slate-400">คิวต่อไป</div>
              <div className={`${cBoxInner} truncate text-xs font-bold text-slate-200`}>
                {nextProductLabel}
              </div>
            </div>
          </div>

          <div className={`${cGap} grid grid-cols-2 gap-2`}>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <button
                onClick={handleStartClick}
                disabled={!canStart}
                className={`rounded-lg bg-emerald-500 px-3 ${cBtnPy} text-xs font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Start
              </button>
              <button
                onClick={handleStopClick}
                disabled={lineStatus === 'idle'}
                className={`rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 ${cBtnPy} text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50`}
              >
                Stop
              </button>
            </div>
            <button
              onClick={() => setEntryModalOpen(true)}
              className={`min-w-0 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 ${cBtnPy} text-[10px] font-bold text-sky-300 hover:bg-sky-500/20`}
            >
              + เพิ่มสินค้า
            </button>
          </div>

          <div className={`${cGap} text-[9px] ${isRunning ? 'text-emerald-300' : lineStatus === 'cleaning' ? 'text-amber-300' : 'text-rose-400'}`}>
            {isRunning && currentProcess > 0
              ? `● PROCESS ${currentProcess} RUNNING: ${primaryCalendarEntry?.name || (!hasCalendarPlan ? currentShift?.product : '') || ''}`
                : lineStatus === 'cleaning'
                  ? `● CLEANING: ${formatCleaningTime(cleaningSeconds)}`
                : hasPrimaryProduct
                  ? '● รอเริ่มทำงาน'
                  : todayProductionDone
                    ? '● วันนี้ผลิตครบแล้ว'
                    : '● ดูสินค้าที่จะผลิตในวันนี้'}
          </div>

          <div className="hidden">
            <div className="rounded-lg bg-bg-panel/45 px-2 py-2 text-center">
              <div className="font-mono text-xs font-bold text-sky-400">{receivedWeight.toLocaleString()}</div>
              <div className="text-[8px] text-slate-400">รับเข้า</div>
            </div>
            <div className="rounded-lg bg-bg-panel/45 px-2 py-2 text-center">
              <div className="font-mono text-xs font-bold text-amber-400">{standardWeight.toLocaleString()}</div>
              <div className="text-[8px] text-slate-400">มาตรฐาน</div>
            </div>
            <div className="rounded-lg bg-bg-panel/45 px-2 py-2 text-center">
              <div className="font-mono text-xs font-bold text-emerald-400">{receivedWeight.toLocaleString()}</div>
              <div className="text-[8px] text-slate-400">ได้จริง</div>
            </div>
          </div>
            </section>

          {/* Image / machine layout zone */}
          <StaticPanels isPanel1Missing={isPanel1Missing} dashboard={nodeRedDashboard} />
        </div>

        <div className={`flex min-h-0 flex-col ${monitorGap} ${rightColumn}`}>
            <section className={`rounded-xl ${OVERVIEW_CONTAINER_FRAME_CLASSES.oee} bg-bg-card/90 ${oeePad} ${oeePanelHeight} panel ${deskTop}`}>
          {loading ? (
            <div className="flex h-full animate-pulse flex-col gap-2">
              <div className="h-full rounded-lg bg-border" />
            </div>
          ) : topMetricsAdjusted[0] ? (
            <div className="flex h-full flex-col">
              <div className="relative flex h-full items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-panel/35 py-3">
                <div className="absolute left-3 top-2 text-[10px] font-semibold uppercase text-slate-400">OEE</div>
                {oeeTrend ? (
                  <div
                    className={`absolute right-3 top-2 inline-flex max-w-[150px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${oeeTrendClass}`}
                    title={`เทียบกับ ${oeeTrend.previous.mock ? 'mock product ก่อนหน้า' : 'product ก่อนหน้า'}: ${oeeTrend.previous.product} (${Number(oeeTrend.previous.oee).toFixed(1)}%)`}
                  >
                    {oeeTrend.direction === 'flat' ? (
                      <Minus size={13} strokeWidth={2.4} />
                    ) : (
                      <TrendArrowIcon direction={oeeTrend.direction} size={18} />
                    )}
                    <span className="font-mono tabular-nums">
                      {oeeTrend.direction === 'up' ? '+' : oeeTrend.direction === 'down' ? '-' : ''}
                      {oeeTrend.diff.toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <div
                    className="absolute right-3 top-2 inline-flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-1 text-[10px] font-semibold text-slate-400"
                    title="ยังไม่มี product ก่อนหน้าให้เทียบ"
                  >
                    <Minus size={13} strokeWidth={2.4} />
                    <span>Trend</span>
                  </div>
                )}
                <div className="relative h-[160px] w-[160px]">
                  <svg className="h-full w-full" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="62" fill="none" stroke="var(--color-border)" strokeWidth="12"
                      strokeDasharray={`${2 * Math.PI * 62 * 0.75} ${2 * Math.PI * 62 * 0.25}`}
                      strokeLinecap="round" transform="rotate(-225 80 80)" />
                    <circle cx="80" cy="80" r="62" fill="none" stroke={topMetricsAdjusted[0].color} strokeWidth="12"
                      strokeDasharray={`${(Number(overallOEE) / 100) * 2 * Math.PI * 62 * 0.75} ${2 * Math.PI * 62 * 0.75 - (Number(overallOEE) / 100) * 2 * Math.PI * 62 * 0.75}`}
                      strokeLinecap="round" transform="rotate(-225 80 80)" style={{ transition: 'stroke-dasharray 0.7s' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`max-w-[108px] truncate text-center font-mono ${mainGaugeValueClass} font-extrabold leading-none text-text-primary tabular-nums`}>
                      {overallOEEText}%
                    </div>
                    <div className="mt-1 text-[11px] font-medium leading-none text-slate-400">Overall OEE</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No OEE data</div>
          )}
            </section>

        <section className={`rounded-xl ${OVERVIEW_CONTAINER_FRAME_CLASSES.metrics} bg-bg-card/90 ${oeePad} ${metricsGaugePanelHeight} panel`}>
          {loading ? (
            <div className="grid h-full grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-full animate-pulse rounded-lg bg-border" />
              ))}
            </div>
          ) : topMetricsAdjusted.length > 1 ? (
            <div className="flex h-full flex-col gap-1.5">
              <div className="section-head">Metrics Gauge</div>
              <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
                {topMetricsAdjusted.slice(1).map((m) => {
                  const metricValue = Math.max(0, Math.min(100, Number(m.value) || 0))
                  const metricLabel = m.title === 'Availability' ? 'Availability' : m.title === 'Performance' ? 'Performance' : 'Quality / FPY'
                  return (
                    <div key={m.title} className="flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-border bg-bg-panel/45 px-1.5 py-1 text-center">
                      <div className="truncate text-[8px] font-semibold uppercase tracking-wide text-slate-400">{metricLabel}</div>
                      <div className="relative mx-auto h-[58px] w-full max-w-[112px]">
                        <svg className="h-full w-full overflow-visible" viewBox="0 0 120 76" aria-hidden="true">
                          <path
                            d="M 14 66 A 46 46 0 0 1 106 66"
                            fill="none"
                            stroke="rgba(148, 163, 184, 0.18)"
                            strokeWidth="11"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 14 66 A 46 46 0 0 1 106 66"
                            fill="none"
                            stroke={m.color}
                            strokeWidth="11"
                            strokeLinecap="round"
                            pathLength="100"
                            strokeDasharray={`${metricValue} 100`}
                            style={{ transition: 'stroke-dasharray 0.7s' }}
                          />
                        </svg>
                        <div className="absolute inset-x-0 bottom-0.5 flex items-center justify-center">
                          <div className={`max-w-[70px] truncate text-center font-mono ${semiGaugeValueClass} font-extrabold leading-none text-text-primary tabular-nums`}>
                            {formatGaugeValue(m.value)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No metric data</div>
          )}
        </section>

        <section className={`flex min-h-0 flex-col rounded-xl ${OVERVIEW_CONTAINER_FRAME_CLASSES.alarm} bg-bg-card/90 ${alarmPad} ${alarmPanelHeight} panel`}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="section-head">Alarm</div>
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
              {loading ? '--' : alerts.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg border border-border bg-bg-panel/45" />
              ))
            ) : alerts.length > 0 ? (
              alerts.slice(0, 6).map((alert) => (
                <div key={alert.title} className={`rounded-lg border-l-4 ${alert.color} ${alert.bg} px-2.5 py-1.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[9px] font-bold uppercase tracking-wider ${alert.text}`}>{alert.severity}</div>
                    <div className="font-mono text-[9px] text-slate-500">{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-100">{alert.title}</div>
                  <div className="truncate text-[9px] text-slate-400">{alert.desc}</div>
                </div>
              ))
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-bg-panel/35 text-sm text-slate-400">
                No active alarms
              </div>
            )}
          </div>
        </section>
        </div>
      </div>
    </div>

      <div className="mx-auto px-4 mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Bottom 3 Columns */}
        {/* Machine Status Board */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">⚙ Machine Status Board</div>
            <div className="ml-auto"><span className="text-[11px] text-slate-400">คลิกชื่อเพื่อดูรายละเอียด</span></div>
          </div>
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse h-32 rounded-xl border border-border bg-bg-panel/40" />
              ))
              : machines.map((m) => (
                <div key={m.name} className="rounded-xl border-2 p-4 transition"
                  style={{ borderColor: m.borderColor, backgroundColor: m.bgColor, boxShadow: `${m.shadow} 0px 0px 30px` }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button onClick={() => setSelectedMachine(m)} className="text-left text-[10px] font-bold hover:underline text-slate-100">{m.name}</button>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold"
                        style={{ background: m.status === 'running' ? 'rgba(34,197,94,0.125)' : 'rgba(239,68,68,0.125)', color: m.status === 'running' ? '#22c55e' : '#ef4444', borderColor: m.status === 'running' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }}>
                        <span className="inline-block w-[7px] h-[7px] rounded-full mr-1"
                          style={{ background: m.status === 'running' ? '#22c55e' : '#ef4444', boxShadow: m.status === 'running' ? '#22c55e 0px 0px 5px' : 'none' }} />
                        {m.status === 'running' ? 'RUN' : 'BRE'}
                      </span>
                      <div className="rounded-full border px-2 py-0.5 text-[9px] font-bold flex items-center gap-1.5"
                        style={{ borderColor: '#64748b', backgroundColor: 'rgba(100,116,139,0.125)', color: '#64748b' }}>
                        <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: '#64748b', boxShadow: 'rgba(100,116,139,0.5) 0px 0px 4px' }} />
                        AUTO
                      </div>
                      <button onClick={() => setSelectedMachine(m)} className="rounded-md border border-border bg-bg-panel/50 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200">⚙</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="font-mono text-2xl font-extrabold" style={{ color: m.oeeColor }}>{m.oee}%</div>
                      <div className="text-[9px] text-slate-400">OEE</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[
                        { label: 'Availability', val: m.avail, color: '#22c55e' },
                        { label: 'Performance', val: m.perf, color: '#f59e0b' },
                        { label: 'Quality', val: m.qual, color: '#a78bfa' },
                        { label: 'OEE', val: m.oee, color: '#06b6d4' }
                      ].map((bar) => (
                        <div key={bar.label} className="flex items-center gap-3">
                          <div className="w-20 text-[10px] text-slate-400">{bar.label}</div>
                          <div className="flex-1">
                            <div style={{ background: 'var(--color-bg-panel)', borderRadius: '3px', height: '5px', width: '100%', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                              <div style={{ height: '100%', width: `${bar.val}%`, background: bar.color, borderRadius: '3px', transition: 'width 0.5s' }} />
                            </div>
                          </div>
                          <div className="w-12 text-right font-mono text-[10px] font-bold" style={{ color: bar.color }}>{Math.round(bar.val)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                    <div className="text-[11px] text-slate-400">Line {m.line} · Good {m.good}/{m.total}</div>
                    <div className="text-[11px] text-slate-400">Scrap: {m.scrap}</div>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* Six Big Losses */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">📉 Six Big Losses</div>
          </div>
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="flex justify-between"><div className="h-3 w-20 rounded bg-border" /><div className="h-3 w-12 rounded bg-border" /></div>
                  <div className="h-2 w-full rounded bg-border" />
                </div>
              ))
              : losses.map((l) => (
                <div key={l.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-xs text-slate-300">{l.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-slate-400">{l.category}</div>
                      <div className="font-mono text-[10px] font-bold" style={{ color: l.color }}>{l.value}%</div>
                    </div>
                  </div>
                  <div className="h-2 rounded border border-border bg-bg-panel/60">
                    <div className="h-2 rounded" style={{ width: `${l.width}%`, background: l.color }} />
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg-panel/50 p-3">
            <div><div className="text-[10px] text-slate-400">MTBF</div><div className="font-mono text-lg font-bold text-emerald-300">6.9h</div></div>
            <div><div className="text-[10px] text-slate-400">MTTR</div><div className="font-mono text-lg font-bold text-red-300">344m</div></div>
          </div>
        </section>
      </div>

    {selectedMachine && <MachineControlModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} />}

      {entryModalOpen && (
        <ProductionEntryModal
          slot={entryModalSlot}
          products={products}
          stockData={stockData}
          onClose={() => setEntryModalOpen(false)}
          onSave={saveProductionEntry}
        />
      )}

      {entrySuccessOpen && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-emerald-500/30 panel-modal">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-lg font-bold text-emerald-300">
                  ✓
                </div>
                <div>
                  <div className="text-base font-bold text-slate-100">เพิ่มสินค้าเรียบร้อยแล้ว</div>
                  <div className="mt-1 text-xs text-slate-400">สามารถเช็คสถานะได้ที่ Product Setting</div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4">
              <button
                onClick={() => setEntrySuccessOpen(false)}
                className="flex-1 rounded-lg border border-border bg-bg-panel/40 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-bg-panel/70 hover:text-white"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  setEntrySuccessOpen(false)
                  window.location.href = '/settings'
                }}
                className="flex-[1.4] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400"
              >
                ไป Product Setting
              </button>
            </div>
          </div>
        </div>
      )}

      {todayEntriesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-md rounded-xl border border-border panel-modal p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-slate-100">📦 สินค้าที่จะผลิตวันนี้</div>
              <button
                onClick={() => setTodayEntriesOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-white hover:bg-bg-panel/60 transition"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {todayEntries.length === 0 ? (
                <div className="rounded-lg border border-border bg-bg-panel/40 p-4 text-center text-sm text-slate-400">
                  ไม่มีสินค้าที่จะผลิตในวันนี้
                </div>
              ) : (
                todayEntries.map((e, i) => {
                  const status = getTodayEntryStatus(e)
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-panel/40 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-300">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.time}</div>
                        </div>
                      </div>
                      <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                        {status.label}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <button
              onClick={() => setTodayEntriesOpen(false)}
              className="mt-4 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400 transition"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Cleaning confirmation dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-xl border border-border panel-modal p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <div className="text-lg font-bold text-slate-100">อยู่ระหว่างการทำความสะอาด</div>
              <div className="mt-2 text-sm text-slate-400">
                คุณแน่ใจมั้ยว่าจะ{confirmDialog.action === 'start' ? ' Start' : ' Stop'}?
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, action: null })}
                className="flex-1 rounded-lg border border-border bg-bg-panel/40 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-bg-panel/60 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDialog}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400 transition"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

    </Fragment>
  )
}
