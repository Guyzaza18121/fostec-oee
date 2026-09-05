import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowRight, Boxes, ImageIcon, Magnet, Plus, Scale, Settings, Sparkles, Trash2, Zap } from 'lucide-react'
import MachineControlModal from '../components/MachineControlModal'
import useNodeRedDashboard from '../hooks/useNodeRedDashboard'
import { api } from '../services/api.js'
import { getProcessTheme } from '../utils/processTheme.js'
import {
  ZERO_RUNTIME,
  findRuntimeTriggerUnit,
  getCurrentProductionCycle,
  getRuntimeByMachineId,
  getRuntimeMachineUnits,
  readProcessRuntimeStore,
  saveProcessRuntimeStore,
  statusIsRuntimeRunning,
  updateProcessRuntimeStore,
} from '../utils/processRuntime.js'

const PRODUCTION_ENTRIES_STORAGE_KEY = 'productionEntries'
const PRODUCTION_ENTRIES_SYNC_KEY = 'productionEntriesUpdatedAt'
const PRODUCTION_ENTRIES_CHANGED_EVENT = 'production-entries:changed'
const FINISHED_GOODS_STORAGE_KEY = 'finishedGoodsWarehouseInputs'
const MACHINE_PICTURES_STORAGE_KEY = 'processMachinePictures'
const PROCESS_RUNTIME_REFRESH_MS = 15000
const EMPTY_LIVE_PACKAGING = []
const NODE_RED_DASHBOARD_POLL_MS = 5000
const LOADCELL_REALTIME_POLL_MS = 1000
const LOADCELL_HISTORY_POINTS = 90
const NODE_RED_LIVE_SOURCE = 'node-red'
const DEFAULT_MACHINE_STOP_STATUS = 'STOP'
const DEFAULT_PACKAGING_STOP_STATUS = 'DISCONNECT'

const loadcellChartConfigs = {
  2: {
    id: 'loadcell-in',
    title: 'Loadcell IN',
    chartTitle: 'Weight Input (kg)',
    currentLabel: 'Weight Input',
    maximumLabel: 'Input Maximum',
    totalLabel: 'Input Total',
    tone: 'emerald',
    lineColor: '#22c55e',
    fillColor: '#22c55e',
    phase: 0.4,
    base: 27,
    chartMax: 60,
    runtimeMachineId: 'ccp-magnet-1',
  },
  4: {
    id: 'loadcell-out',
    title: 'Loadcell OUT',
    chartTitle: 'Weight Output (kg)',
    currentLabel: 'Weight Output',
    maximumLabel: 'Output Maximum',
    totalLabel: 'Output Total',
    tone: 'violet',
    lineColor: '#8b5cf6',
    fillColor: '#8b5cf6',
    phase: 1.8,
    base: 22,
    runtimeMachineId: 'outbound-loadcell',
  },
}

const stages = [
  {
    id: 1,
    title: 'รับและจัดเก็บวัตถุดิบ',
    color: '#2563eb',
    twColor: 'blue',
    steps: [
      'ตรวจสอบคุณภาพ และน้ำหนัก',
      'บันทึกข้อมูลการรับเข้า ของวัตถุดิบ',
      'สำเลียงข้าวสารเข้าที่จัดเก็บ',
      'เปิดวัตถุดิบข้าวสารตาม FIFO',
    ],
  },
  {
    id: 2,
    title: 'ลำเลียงเข้าสายการผลิต',
    color: '#10b981',
    twColor: 'emerald',
    steps: [
      'จัดเก็บข้าวสารไซโล',
      'คัดแยกโลหะ และสิ่งแปลกปลอม',
      'ชั่งน้ำหนัก Load cell ขาเข้า',
      'ตรวจสอบสิ่งปนเปื้อนเบื้องต้น',
    ],
  },
  {
    id: 3,
    title: 'CCP2',
    color: '#8b5cf6',
    twColor: 'violet',
    steps: [
      'แยกหินออกจากข้าวสาร',
      'ดูดเศษโละหะขนาดเล็ก',
      'คัดขนาดเมล็ดข้าวสารด้วยตะแกรง',
      'ผสมข้าวบนสายพาน',
      'คัดแยกโละ และสิ่งแปลกปลอม',
      'คัดแยกสีข้าวด้วย Color master',
    ],
  },
  {
    id: 4,
    title: 'บรรจุถุง',
    color: '#16a34a',
    twColor: 'green',
    steps: [
      'ชั่งน้ำหนัก Load cell บรรจุ',
      'คัดแยกโลหะ และสิ่งแปลกปลอม ก่อนบรรจุ',
      'บรรจุข้าวลงถุง',
      'บรรจุลงกล่อง',
    ],
  },
  {
    id: 5,
    title: 'ตรวจสอบและจัดส่ง',
    color: '#7c3aed',
    twColor: 'purple',
    steps: [
      'จัดเก็บสินค้าสำเร็จรูป',
      'จัดส่งสินค้า',
    ],
  },
  {
    id: 6,
    title: 'คลังเก็บสินค้าสำเร็จรูป',
    color: '#0891b2',
    twColor: 'cyan',
    steps: [],
  },
]

const machines = [
  {
    processId: 1,
    name: 'machine Inbound & Storage',
    line: 'A',
    status: 'run',
    oee: 74.5,
    availability: 93,
    performance: 81,
    quality: 99,
    oeeBar: 75,
    good: 742,
    total: 748,
    scrap: 6,
    theme: 'green',
  },
  {
    processId: 2,
    name: 'Feeding / Material Handling',
    line: 'A',
    status: 'run',
    oee: 64.5,
    availability: 95,
    performance: 71,
    quality: 96,
    oeeBar: 65,
    good: 702,
    total: 732,
    scrap: 30,
    theme: 'green',
  },
  {
    processId: 3,
    name: 'Sorting & Cleaning',
    line: 'B',
    status: 'bre',
    oee: 56.3,
    availability: 75,
    performance: 81,
    quality: 93,
    oeeBar: 56,
    good: null,
    total: null,
    scrap: 6,
    theme: 'red',
  },
  {
    processId: 4,
    name: 'Packaging',
    line: 'B',
    status: 'run',
    oee: 81.1,
    availability: 99,
    performance: 82,
    quality: 100,
    oeeBar: 81,
    good: 778,
    total: 779,
    scrap: 1,
    theme: 'green',
  },
  {
    processId: 5,
    name: 'QC & Dispatch',
    line: 'C',
    status: 'run',
    oee: 60.2,
    availability: 93,
    performance: 65,
    quality: 100,
    oeeBar: 60,
    good: 578,
    total: 579,
    scrap: 1,
    theme: 'green',
  },
  {
    processId: 6,
    name: 'Process6',
    line: 'C',
    status: 'run',
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    oeeBar: 0,
    good: null,
    total: null,
    scrap: 0,
    theme: 'green',
  },
]

export const process2MachineContainers = [
  {
    id: 'ccp-magnet-1',
    name: 'T1',
    type: 'Critical Control Point',
    status: 'RUNNING',
    power: 1.8,
    unit: 'kW',
    icon: Magnet,
    accent: 'cyan',
    primaryLabel: 'สถานะแม่เหล็ก',
    primaryValue: 'พร้อมใช้งาน',
    detail: 'ตรวจจับโลหะก่อนเข้าไลน์ผลิต',
  },
  {
    id: 'cleaning-machine',
    name: 'T2',
    type: 'Cleaning Process',
    status: 'STOP',
    power: 0,
    unit: 'kW',
    icon: Sparkles,
    accent: 'amber',
    primaryLabel: 'สถานะเครื่อง',
    primaryValue: 'หยุดทำงาน',
    detail: 'รอคำสั่งเริ่มทำความสะอาด',
  },
]

export const process3MachineContainers = [
  {
    id: 'ccp2-stone-separation',
    name: 'การแยกหินออกจากข้าวสาร',
    type: 'CCP2',
    status: 'RUNNING',
    power: 2.4,
    unit: 'kW',
    icon: Sparkles,
    accent: 'cyan',
    primaryLabel: 'สถานะรวม',
    primaryValue: 'ปกติ',
    detail: 'CCP2 ตรวจและแยกหินออกจากข้าวสารด้วยเครื่องแยกหิน 2 ตัว',
    wide: true,
    subMachines: [
      {
        id: 'stone-separator-1',
        name: 'เครื่องแยกหิน 1',
        type: 'Stone Separator',
        status: 'RUNNING',
        power: 1.2,
        unit: 'kW',
        primaryValue: 'ปกติ',
      },
      {
        id: 'stone-separator-2',
        name: 'เครื่องแยกหิน 2',
        type: 'Stone Separator',
        status: 'RUNNING',
        power: 1.2,
        unit: 'kW',
        primaryValue: 'ปกติ',
      },
    ],
  },
  {
    id: 'process3-cleaning-machine',
    name: 'Cleaning Machine',
    type: 'Cleaning Machine',
    status: 'RUNNING',
    power: 1.6,
    unit: 'kW',
    icon: Sparkles,
    accent: 'cyan',
    primaryLabel: 'Status',
    primaryValue: 'RUNNING',
    detail: 'Cleaning Machine 2 units before the magnetic separator stage',
    subMachines: [
      {
        id: 'cleaning-machine-1',
        name: 'Cleaning Machine 1',
        type: 'Cleaning Machine',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'RUNNING',
      },
      {
        id: 'cleaning-machine-2',
        name: 'Cleaning Machine 2',
        type: 'Cleaning Machine',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'RUNNING',
      },
    ],
  },
  {
    id: 'magnet-pass-1',
    name: 'ผ่านแม่เหล็ก',
    type: 'Magnetic Separator',
    status: 'RUNNING',
    power: 1.3,
    unit: 'kW',
    icon: Magnet,
    accent: 'emerald',
    primaryLabel: 'สถานะรวม',
    primaryValue: 'ทำงาน',
    detail: 'ดักโลหะก่อนเข้าสู่ชุดคัดข้าวสารด้วยเครื่องแม่เหล็ก 6 ตัว',
    subMachines: [
      {
        id: 'magnet-pass-1-1',
        name: 'เครื่องแม่เหล็ก 1',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.2,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'magnet-pass-1-2',
        name: 'เครื่องแม่เหล็ก 2',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.2,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'magnet-pass-1-3',
        name: 'เครื่องแม่เหล็ก 3',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.2,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'magnet-pass-1-4',
        name: 'เครื่องแม่เหล็ก 4',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.2,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'magnet-pass-1-5',
        name: 'เครื่องแม่เหล็ก 5',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.2,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'magnet-pass-1-6',
        name: 'เครื่องแม่เหล็ก 6',
        type: 'Magnetic Separator',
        status: 'RUNNING',
        power: 0.3,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
    ],
  },
  {
    id: 'rice-sorting',
    name: 'การคัดขนาดด้วยตะแกรงเหลี่ยม',
    type: 'Square Screen Separator',
    status: 'RUNNING',
    power: 3.2,
    unit: 'kW',
    icon: Activity,
    accent: 'amber',
    primaryLabel: 'สถานะรวม',
    primaryValue: 'ทำงาน',
    detail: 'คัดขนาดข้าวสารด้วยตะแกรงเหลี่ยม 4 เครื่อง',
    subMachines: [
      {
        id: 'square-screen-1',
        name: 'ตะแกรงเหลี่ยม 1',
        type: 'Square Screen',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'square-screen-2',
        name: 'ตะแกรงเหลี่ยม 2',
        type: 'Square Screen',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'square-screen-3',
        name: 'ตะแกรงเหลี่ยม 3',
        type: 'Square Screen',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'square-screen-4',
        name: 'ตะแกรงเหลี่ยม 4',
        type: 'Square Screen',
        status: 'RUNNING',
        power: 0.8,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
    ],
  },
  {
    id: 'size-separator',
    name: 'การคัดขนาดด้วยตะแกรงกลม',
    type: 'Round Screen Separator',
    status: 'RUNNING',
    power: 2.1,
    unit: 'kW',
    icon: Scale,
    accent: 'cyan',
    primaryLabel: 'สถานะรวม',
    primaryValue: 'ทำงาน',
    detail: 'คัดขนาดข้าวสารด้วยตะแกรงกลม 2 เครื่อง',
    subMachines: [
      {
        id: 'round-screen-1',
        name: 'ตะแกรงกลม 1',
        type: 'Round Screen',
        status: 'RUNNING',
        power: 1.0,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'round-screen-2',
        name: 'ตะแกรงกลม 2',
        type: 'Round Screen',
        status: 'RUNNING',
        power: 1.1,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
    ],
  },
  {
    id: 'ccp3-color-sorter',
    name: 'CCP3 คัดแยกสี',
    type: 'Color Sorter',
    status: 'STOP',
    power: 0,
    unit: 'kW',
    icon: Sparkles,
    accent: 'cyan',
    primaryLabel: 'สถานะคัดสี',
    primaryValue: 'รอเริ่ม',
    detail: 'CCP3 คัดแยกสีและเมล็ดผิดปกติ',
  },
]

export const process4MachineContainers = [
  {
    id: 'outbound-loadcell',
    name: 'ค่าน้ำหนัก Loadcell ขาเข้า',
    type: 'Simulated Backend Value',
    status: 'RUNNING',
    power: 0.7,
    unit: 'kW',
    icon: Scale,
    accent: 'emerald',
    primaryLabel: 'น้ำหนักที่รับมา',
    primaryValue: '10,860 kg',
    detail: 'ข้อมูลน้ำหนักจำลอง รอเชื่อมค่าจากหลังบ้าน',
  },
  {
    id: 'bagging-ready',
    name: 'ถังเตรียมบรรจุ',
    type: 'Pre-bagging Buffer',
    status: 'RUNNING',
    power: 1.1,
    unit: 'kW',
    icon: Activity,
    accent: 'cyan',
    primaryLabel: 'สถานะรวม',
    primaryValue: 'ทำงาน',
    detail: 'ตรวจสถานะและเตรียมพร้อมก่อนส่งเข้ากระบวนการบรรจุถุงด้วยเครื่อง 4 ตัว',
    subMachineColumns: 2,
    subMachines: [
      {
        id: 'bagging-ready-1',
        name: 'ถังบรรจุ 1',
        type: 'Pre-bagging Buffer',
        status: 'RUNNING',
        power: 0.3,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'bagging-ready-2',
        name: 'ถังบรรจุ 2',
        type: 'Pre-bagging Buffer',
        status: 'RUNNING',
        power: 0.3,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'bagging-ready-3',
        name: 'ถังบรรจุ 3',
        type: 'Pre-bagging Buffer',
        status: 'RUNNING',
        power: 0.25,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
      {
        id: 'bagging-ready-4',
        name: 'ถังบรรจุ 4',
        type: 'Pre-bagging Buffer',
        status: 'RUNNING',
        power: 0.25,
        unit: 'kW',
        primaryValue: 'ทำงาน',
      },
    ],
  },
]

export const process5MachineContainers = [
  {
    id: 'ccp4-magnet',
    name: 'เครื่องซีล - 01',
    type: 'Critical Control Point',
    status: 'RUNNING',
    power: 1.5,
    totalPower: 1.5,
    unit: 'kW',
    icon: Settings,
    accent: 'cyan',
    primaryLabel: 'สถานะแม่เหล็ก',
    primaryValue: 'ทำงาน',
    detail: 'ตรวจโลหะก่อนส่งเข้าเครื่องบรรจุอัตโนมัติ',
  },
  {
    id: 'auto-packing-machine',
    name: 'เครื่องซีล - 02',
    type: 'Automatic Packing',
    status: 'RUNNING',
    power: 4.8,
    totalPower: 6,
    unit: 'kW',
    icon: Settings,
    accent: 'emerald',
    primaryLabel: 'อัตราบรรจุ',
    primaryValue: '42 bag/min',
    detail: 'บรรจุข้าวสารลงถุงตามน้ำหนักที่กำหนด',
  },
  {
    id: 'sealing-machine',
    name: 'เครื่องซีล - 03',
    type: 'Sealing Machine',
    status: 'ALERT',
    power: 0,
    totalPower: 1.2,
    unit: 'kW',
    icon: Settings,
    accent: 'amber',
    primaryLabel: 'สถานะซีล',
    primaryValue: 'รอเริ่ม',
    detail: 'ซีลปิดปากถุงหลังบรรจุ',
  },
  {
    id: 'checkweigher',
    name: 'เครื่องซีล - 04',
    type: 'Checkweigher',
    status: 'RUNNING',
    power: 0.9,
    totalPower: 1.2,
    unit: 'kW',
    icon: Settings,
    accent: 'emerald',
    primaryLabel: 'น้ำหนักสุทธิ',
    primaryValue: 'ตรงสเปก',
    detail: 'ตรวจสอบน้ำหนักถุงหลังซีลให้ตรงตามค่าที่กำหนด',
  },
  {
    id: 'bag-discharge-conveyor',
    name: 'เครื่องซีล - 05',
    type: 'Bag Discharge Conveyor',
    status: 'RUNNING',
    power: 0.8,
    totalPower: 1,
    unit: 'kW',
    icon: Settings,
    accent: 'cyan',
    primaryLabel: 'สถานะลำเลียง',
    primaryValue: 'ทำงาน',
    detail: 'ลำเลียงถุงสำเร็จรูปออกจากเครื่องบรรจุไปยังจุดตรวจรับถัดไป',
  },
]

export const processMachineContainerBoards = {
  2: process2MachineContainers,
  3: process3MachineContainers,
  4: process4MachineContainers,
  5: process5MachineContainers,
}

const accentClasses = {
  cyan: {
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
    iconBg: 'bg-cyan-500/12',
    iconText: 'text-cyan-300',
    value: 'text-cyan-300',
    line: 'bg-cyan-400',
  },
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/12',
    iconText: 'text-emerald-300',
    value: 'text-emerald-300',
    line: 'bg-emerald-400',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/12',
    iconText: 'text-amber-300',
    value: 'text-amber-300',
    line: 'bg-amber-400',
  },
}

function readFinishedGoodsInputs() {
  try {
    const raw = localStorage.getItem(FINISHED_GOODS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeFinishedGoodsInputs(value) {
  try {
    localStorage.setItem(FINISHED_GOODS_STORAGE_KEY, JSON.stringify(value))
  } catch {}
}

function readMachinePictures() {
  try {
    const raw = localStorage.getItem(MACHINE_PICTURES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeMachinePictures(value) {
  try {
    localStorage.setItem(MACHINE_PICTURES_STORAGE_KEY, JSON.stringify(value))
  } catch {}
}

function getMachineStorageKey(machine = {}) {
  return String(machine.id || machine.name || '').trim()
}

function normalizePackagingMachineStatus(status) {
  if (status === true) return 'RUNNING'
  if (status === false) return 'DISCONNECT'
  const value = String(status || '').trim().toUpperCase()
  if (statusIsRuntimeRunning(value) || ['RUN', 'ON', 'ONLINE', 'TRUE'].includes(value)) return 'RUNNING'
  if (['STANDBY', 'STANBY', 'IDLE', 'WAITING'].includes(value)) return 'STANDBY'
  if (['DISCONNECT', 'DISCONNECTED', 'OFF', 'OFFLINE', 'STOP', 'STOPPED', 'FALSE'].includes(value)) return 'DISCONNECT'
  if (['ALARM', 'BREAKDOWN', 'BRE', 'FAULT', 'ERROR'].includes(value)) return 'ALARM'
  if (['ALERT', 'WARNING', 'WARN'].includes(value)) return 'STANDBY'
  return 'DISCONNECT'
}

export function normalizePackagingMachineContainerStatuses(containers = []) {
  return containers.map((container) => {
    const subMachines = Array.isArray(container.subMachines)
      ? container.subMachines.map((subMachine) => {
        return {
          ...subMachine,
          status: normalizePackagingMachineStatus(subMachine.status),
        }
      })
      : undefined

    return {
      ...container,
      status: normalizePackagingMachineStatus(container.status),
      ...(subMachines ? { subMachines } : {}),
    }
  })
}

function powerNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function getMachineTotalPower(machine = {}) {
  const explicitTotal = Number(machine.totalPower)
  if (Number.isFinite(explicitTotal) && explicitTotal >= 0) return explicitTotal

  const subMachines = Array.isArray(machine.subMachines) ? machine.subMachines : []
  if (subMachines.length > 0) {
    return subMachines.reduce((sum, subMachine) => sum + getMachineTotalPower(subMachine), 0)
  }

  return powerNumber(machine.power, 0)
}

function formatPower(value) {
  return powerNumber(value, 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function machineLookupKey(value) {
  return String(value || '').trim().toUpperCase()
}

function statusValueAvailable(value) {
  return typeof value === 'boolean' || (value !== undefined && value !== null && String(value).trim() !== '')
}

function liveStatusAvailable(live = null) {
  if (!live) return false
  if (live.hasStatus === false) return false
  return (
    statusValueAvailable(live.rawStatus)
    || statusValueAvailable(live.status)
    || typeof live.isOnline === 'boolean'
    || typeof live.online === 'boolean'
  )
}

function readLiveStatus(live = {}, fallbackStatus = DEFAULT_MACHINE_STOP_STATUS) {
  if (statusValueAvailable(live.rawStatus)) return live.rawStatus
  if (statusValueAvailable(live.status)) return live.status
  if (live.isOnline === true || live.online === true) return 'RUNNING'
  return fallbackStatus
}

function primaryMetricIsStatus(machine = {}) {
  const label = String(machine.primaryLabel || '').trim().toUpperCase()
  return label === 'STATUS' || label.includes('สถานะ')
}

function statusPrimaryValue(machine = {}, status = DEFAULT_MACHINE_STOP_STATUS, limitToPackagingStatuses = false) {
  return primaryMetricIsStatus(machine)
    ? displayStatusLabel(status, limitToPackagingStatuses)
    : machine.primaryValue
}

function withOfflineStatus(machine = {}, status = DEFAULT_MACHINE_STOP_STATUS, limitToPackagingStatuses = false) {
  const subMachines = Array.isArray(machine.subMachines)
    ? machine.subMachines.map((subMachine) => withOfflineStatus(subMachine, status, limitToPackagingStatuses))
    : undefined

  return {
    ...machine,
    status,
    isOnline: false,
    hasStatus: false,
    liveSource: null,
    power: 0,
    ...(machine.totalPower !== undefined ? { totalPower: 0 } : {}),
    primaryValue: statusPrimaryValue(machine, status, limitToPackagingStatuses),
    ...(subMachines ? { subMachines } : {}),
  }
}

function livePowerKw(live = {}, fallback = 0) {
  return powerNumber(live.powerKw ?? live.powerKW ?? live.power_kw ?? live.power, fallback)
}

function applyLiveStatus(machine = {}, live = null, fallbackStatus = DEFAULT_MACHINE_STOP_STATUS, limitToPackagingStatuses = false) {
  if (!liveStatusAvailable(live)) {
    return withOfflineStatus(machine, fallbackStatus, limitToPackagingStatuses)
  }

  const rawStatus = readLiveStatus(live, fallbackStatus)
  const status = limitToPackagingStatuses ? normalizePackagingMachineStatus(rawStatus) : rawStatus

  return {
    ...machine,
    status,
    rawStatus,
    isOnline: live.isOnline ?? statusIsRunning(status),
    hasStatus: true,
    liveSource: NODE_RED_LIVE_SOURCE,
    power: livePowerKw(live, 0),
    primaryValue: statusPrimaryValue(machine, status, limitToPackagingStatuses),
  }
}

function addLiveMachineLookupEntries(lookup, machine = {}) {
  ;[machine.code, machine.machineCode, machine.machineId, machine.name, machine.id].forEach((value) => {
    const key = machineLookupKey(value)
    if (key) lookup.set(key, machine)
  })
}

function buildLiveMachineLookup(liveMachines = []) {
  const lookup = new Map()
  if (!Array.isArray(liveMachines)) return lookup
  liveMachines.forEach((machine) => addLiveMachineLookupEntries(lookup, machine))
  return lookup
}

function findLiveMachine(machine = {}, lookup = new Map()) {
  const keys = [machine.nodeRedKey, machine.code, machine.machineCode, machine.machineId, machine.name, machine.id]
  for (const key of keys) {
    const live = lookup.get(machineLookupKey(key))
    if (live) return live
  }
  return null
}

export function applyLiveNodeRedMachineData(containers = [], liveMachines = []) {
  const lookup = buildLiveMachineLookup(liveMachines)

  return containers.map((container) => {
    const subMachines = Array.isArray(container.subMachines)
      ? container.subMachines.map((subMachine) => (
        applyLiveStatus(subMachine, findLiveMachine(subMachine, lookup))
      ))
      : undefined
    const nextContainer = applyLiveStatus(container, findLiveMachine(container, lookup))
    return {
      ...nextContainer,
      ...(subMachines ? { subMachines } : {}),
    }
  })
}

export function applyLivePackagingData(containers = [], livePackaging = []) {
  const liveItems = Array.isArray(livePackaging) ? livePackaging : []

  return containers.map((container, index) => {
    const live = liveItems[index]
    if (!liveStatusAvailable(live)) {
      return withOfflineStatus(container, DEFAULT_PACKAGING_STOP_STATUS, true)
    }

    const powerKw = powerNumber(live.powerKw, 0)
    const energyKwh = powerNumber(live.powerKwh, 0)

    return {
      ...container,
      id: live.id || container.id,
      name: live.name || container.name,
      status: normalizePackagingMachineStatus(readLiveStatus(live, DEFAULT_PACKAGING_STOP_STATUS)),
      rawStatus: live.rawStatus,
      isOnline: live.isOnline ?? statusIsRunning(readLiveStatus(live, DEFAULT_PACKAGING_STOP_STATUS)),
      hasStatus: true,
      liveSource: NODE_RED_LIVE_SOURCE,
      power: powerKw,
      totalPower: energyKwh,
      totalPowerLabel: 'Energy kWh',
      totalPowerUnit: 'kWh',
      primaryLabel: 'Energy kWh',
      primaryValue: `${formatPower(energyKwh)} kWh`,
      workingTimeMinutes: Math.round(powerNumber(live.workingTimeMinutes, container.workingTimeMinutes || 0)),
      stopTimeMinutes: Math.round(powerNumber(live.stopTimeMinutes, container.stopTimeMinutes || 0)),
      detail: `Live Node-RED data for ${live.name || container.name}`,
    }
  })
}

function getProcessLoadcellReading(dashboard, seed) {
  if (seed === 2) return dashboard?.loadcell?.in || null
  if (seed === 4) return dashboard?.loadcell?.out || null
  return null
}

function applyLiveLoadcellContainerData(processId, containers = [], dashboard = null) {
  if (Number(processId) !== 4) return containers

  const reading = getProcessLoadcellReading(dashboard, 4)
  return containers.map((container) => {
    if (container.id !== 'outbound-loadcell') return container
    if (!liveStatusAvailable(reading)) return withOfflineStatus(container)

    const status = readLiveStatus(reading)
    return {
      ...container,
      type: 'Node-RED Loadcell',
      status,
      rawStatus: reading.rawStatus ?? reading.status,
      isOnline: reading.isOnline ?? statusIsRunning(status),
      hasStatus: true,
      liveSource: NODE_RED_LIVE_SOURCE,
      power: 0,
      primaryValue: `${formatLoadcellValue(reading.current, 2)} kg`,
      detail: 'Live Node-RED data for Loadcell OUT',
    }
  })
}

export function getEffectiveProcessMachineContainers(processId, containers = [], dashboard = null) {
  const normalizedProcessId = Number(processId)
  if (normalizedProcessId === 5) {
    return normalizePackagingMachineContainerStatuses(
      applyLivePackagingData(containers, dashboard?.packaging || EMPTY_LIVE_PACKAGING)
    )
  }

  const liveMachines = Array.isArray(dashboard?.machines) ? dashboard.machines : []
  const containersWithMachineStatus = applyLiveNodeRedMachineData(containers, liveMachines)
  return applyLiveLoadcellContainerData(normalizedProcessId, containersWithMachineStatus, dashboard)
}

function loadcellClamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function formatLoadcellValue(value, digits = 2) {
  return powerNumber(value, 0).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function parseSampleTime(value, fallback = new Date()) {
  const parsed = value ? new Date(value) : fallback
  return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : fallback
}

function formatLoadcellSampleTime(at = new Date()) {
  return at.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function makeLoadcellSample(at = new Date(), reading = null) {
  const liveCurrent = reading ? powerNumber(reading.current, null) : null
  if (liveCurrent === null) return null

  return {
    sampledAt: at.getTime(),
    time: formatLoadcellSampleTime(at),
    weight: Math.round(liveCurrent * 100) / 100,
  }
}

function appendLoadcellSample(series = [], sample = null) {
  if (!sample) return series
  const last = series.at(-1)
  const next = last?.sampledAt === sample.sampledAt
    ? [...series.slice(0, -1), sample]
    : [...series, sample]
  return next.slice(-LOADCELL_HISTORY_POINTS)
}

function getLoadcellStats(series = [], reading = null) {
  const liveCurrent = reading ? powerNumber(reading.current, null) : null
  const liveMaximum = reading ? powerNumber(reading.maximum, null) : null
  const liveTotal = reading ? powerNumber(reading.total, null) : null
  const seriesTotal = series.reduce((sum, point) => sum + point.weight, 0)
  const current = liveCurrent ?? series.at(-1)?.weight ?? 0
  const maximum = liveMaximum ?? series.reduce((max, point) => Math.max(max, point.weight), 0)
  const minimum = series.reduce((min, point) => Math.min(min, point.weight), 100)
  const total = liveTotal ?? seriesTotal
  const average = series.length ? seriesTotal / series.length : 0
  return { current, maximum, minimum, total, average }
}

function getLoadcellChartMax(series = [], stats = {}, fixedMax = null) {
  const parsedFixedMax = Number(fixedMax)
  if (Number.isFinite(parsedFixedMax) && parsedFixedMax > 0) return parsedFixedMax

  const sampleMax = series.reduce((max, point) => Math.max(max, point.weight || 0), 0)
  const max = Math.max(sampleMax, stats.current || 0, stats.maximum || 0, 100)
  return Math.ceil((max * 1.1) / 10) * 10
}

function getLoadcellRuntime(reading = null, runtime = ZERO_RUNTIME) {
  const liveWorkingTime = runtimeNumber(reading?.workingTimeMinutes, null)
  const liveStopTime = runtimeNumber(reading?.stopTimeMinutes, null)
  return {
    workingTimeMinutes: liveWorkingTime ?? runtimeNumber(runtime?.workingTimeMinutes, 0),
    stopTimeMinutes: liveStopTime ?? runtimeNumber(runtime?.stopTimeMinutes, 0),
  }
}

function readStoredProductionEntries() {
  try {
    const raw = localStorage.getItem(PRODUCTION_ENTRIES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function formatKg(value) {
  return (Number(value) || 0).toLocaleString('en-US')
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
}

function runtimeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}

function statusIsRunning(status) {
  const value = String(status || '').trim().toUpperCase()
  return statusIsRuntimeRunning(status) || value === 'RUN'
}

function statusIsAlert(status) {
  const value = String(status || '').trim().toUpperCase()
  return ['ALERT', 'WARNING', 'WARN'].includes(value)
}

function statusIsAlarm(status) {
  const value = String(status || '').trim().toUpperCase()
  return ['ALARM', 'BREAKDOWN', 'BRE', 'FAULT', 'ERROR'].includes(value)
}

function displayStatusLabel(status, limitToPackagingStatuses = false) {
  if (limitToPackagingStatuses) return normalizePackagingMachineStatus(status)
  if (statusIsRunning(status)) return 'RUNNING'
  if (statusIsAlarm(status)) return 'ALARM'
  if (statusIsAlert(status)) return 'ALERT'
  return 'STOP'
}

function statusToneClasses(status, limitToPackagingStatuses = false) {
  const label = displayStatusLabel(status, limitToPackagingStatuses)
  const packagingMap = {
    RUNNING: {
      badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
      dot: 'bg-emerald-400',
      text: 'text-emerald-300',
      panel: 'border-emerald-500/25 bg-emerald-500/10',
    },
    STANDBY: {
      badge: 'border-amber-400/35 bg-amber-400/10 text-amber-300',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      panel: 'border-amber-500/25 bg-amber-500/10',
    },
    DISCONNECT: {
      badge: 'border-red-400/35 bg-red-400/10 text-red-300',
      dot: 'bg-red-400',
      text: 'text-red-300',
      panel: 'border-red-500/25 bg-red-500/10',
    },
    ALERT: {
      badge: 'border-amber-400/35 bg-amber-400/10 text-amber-300',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      panel: 'border-amber-500/25 bg-amber-500/10',
    },
    ALARM: {
      badge: 'border-red-400/35 bg-red-400/10 text-red-300',
      dot: 'bg-red-400',
      text: 'text-red-300',
      panel: 'border-red-500/25 bg-red-500/10',
    },
  }
  const defaultMap = {
    RUNNING: packagingMap.RUNNING,
    ALERT: packagingMap.ALERT,
    STOP: {
      badge: 'border-red-400/35 bg-red-400/10 text-red-300',
      dot: 'bg-red-400',
      text: 'text-red-300',
      panel: 'border-red-500/25 bg-red-500/10',
    },
    ALARM: {
      badge: 'border-amber-400/35 bg-amber-400/10 text-amber-300',
      dot: 'bg-amber-400',
      text: 'text-amber-300',
      panel: 'border-amber-500/25 bg-amber-500/10',
    },
  }
  const map = limitToPackagingStatuses ? packagingMap : defaultMap
  return map[label] || map.DISCONNECT || map.STOP || map.ALERT
}

function getMachineRuntime(machine = {}, runtimeByMachineId = {}) {
  const machineKey = machine.id || machine.name
  if (machineKey && runtimeByMachineId[machineKey]) {
    return runtimeByMachineId[machineKey]
  }

  const subMachines = Array.isArray(machine.subMachines) ? machine.subMachines : []
  if (subMachines.length > 0) {
    return subMachines.reduce((total, subMachine) => {
      const runtime = getMachineRuntime(subMachine, runtimeByMachineId)
      return {
        workingTimeMinutes: total.workingTimeMinutes + runtime.workingTimeMinutes,
        stopTimeMinutes: total.stopTimeMinutes + runtime.stopTimeMinutes,
      }
    }, { ...ZERO_RUNTIME })
  }

  const explicitWorking = runtimeNumber(machine.workingTimeMinutes, null)
  const explicitStop = runtimeNumber(machine.stopTimeMinutes, null)
  if (explicitWorking !== null && explicitStop !== null) {
    return { workingTimeMinutes: explicitWorking, stopTimeMinutes: explicitStop }
  }

  if (explicitWorking !== null) {
    return {
      workingTimeMinutes: explicitWorking,
      stopTimeMinutes: 0,
    }
  }

  if (explicitStop !== null) {
    return {
      workingTimeMinutes: 0,
      stopTimeMinutes: explicitStop,
    }
  }

  return { ...ZERO_RUNTIME }
}

function getMachineContainerUnits(container) {
  return Array.isArray(container.subMachines) && container.subMachines.length > 0
    ? container.subMachines
    : [container]
}

function hasLiveMachineSource(machine = {}) {
  if (machine.liveSource === NODE_RED_LIVE_SOURCE) return true
  const subMachines = Array.isArray(machine.subMachines) ? machine.subMachines : []
  return subMachines.some(hasLiveMachineSource)
}

function getMachineContainerBoardStats(containers, limitToPackagingStatuses = false) {
  const units = containers.flatMap(getMachineContainerUnits)
  const running = units.filter((unit) => statusIsRunning(unit.status)).length
  const standby = limitToPackagingStatuses
    ? units.filter((unit) => displayStatusLabel(unit.status, true) === 'STANDBY').length
    : 0
  const disconnect = limitToPackagingStatuses
    ? units.filter((unit) => displayStatusLabel(unit.status, true) === 'DISCONNECT').length
    : 0
  const alert = limitToPackagingStatuses
    ? units.filter((unit) => displayStatusLabel(unit.status, true) === 'ALERT').length
    : units.filter((unit) => statusIsAlert(unit.status)).length
  const alarm = limitToPackagingStatuses
    ? units.filter((unit) => displayStatusLabel(unit.status, true) === 'ALARM').length
    : units.filter((unit) => statusIsAlarm(unit.status)).length
  const stop = limitToPackagingStatuses
    ? 0
    : units.filter((unit) => !statusIsRunning(unit.status) && !statusIsAlarm(unit.status)).length
  const total = units.length
  const totalPowerKw = units.reduce((sum, unit) => sum + powerNumber(unit.power, 0), 0)
  return {
    groups: containers.length,
    running,
    standby,
    disconnect,
    alert,
    stop,
    alarm,
    total,
    totalPowerKw,
    issues: (limitToPackagingStatuses ? disconnect : stop) + alarm,
  }
}

function getEntryDate(entry) {
  const date = new Date(entry.date || entry.day || entry.createdAt || Date.now())
  return Number.isNaN(date.getTime()) ? null : date
}

function formatThaiDate(date) {
  if (!date) return 'ไม่ระบุวันที่'
  return date.toLocaleDateString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeFromMinutes(minutesValue) {
  const minutes = Number(minutesValue) || 0
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  if (hour >= 24) return '24:00'
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function getEntryFinishedAt(entry) {
  const date = getEntryDate(entry)
  if (!date) return null
  const endMinutes = Number(entry.endMinutes) || 0
  date.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  return date
}

function isEntryFinished(entry, now = new Date()) {
  const finishedAt = getEntryFinishedAt(entry)
  return Boolean(entry.product || entry.name) && finishedAt && finishedAt <= now
}

function makeFinishedGoodsVariant(overrides = {}) {
  return {
    id: overrides.id || `size-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bagCount: overrides.bagCount ?? '',
    productSize: overrides.productSize ?? '',
  }
}

function normalizeFinishedGoodsVariants(input) {
  if (Array.isArray(input?.variants) && input.variants.length) {
    return input.variants.map((variant, index) => makeFinishedGoodsVariant({
      id: variant.id || `size-${index + 1}`,
      bagCount: variant.bagCount ?? '',
      productSize: variant.productSize ?? '',
    }))
  }

  if (input?.bagCount !== undefined || input?.productSize !== undefined) {
    return [makeFinishedGoodsVariant({
      id: 'size-1',
      bagCount: input.bagCount ?? '',
      productSize: input.productSize ?? '',
    })]
  }

  return [makeFinishedGoodsVariant({ id: 'size-1' })]
}

function getFinishedGoodsEntryKey(entry, index = 0) {
  const id = entry._id || entry.id || entry.entryId
  if (id) return `entry:${id}`
  const date = getEntryDate(entry)
  const dateKey = date ? date.toISOString().slice(0, 10) : 'no-date'
  const product = String(entry.product || entry.name || 'unknown').trim()
  const startMinutes = Number(entry.startMinutes) || 0
  const endMinutes = Number(entry.endMinutes) || 0
  return `entry:${dateKey}:${startMinutes}:${endMinutes}:${product}:${entry.createdAt || index}`
}

function MachineCard({ machine, onOpenControl, runtimeByMachineId = {}, processTheme = getProcessTheme(machine.processId) }) {
  const isRed = machine.theme === 'red'
  const runtime = getMachineRuntime(machine, runtimeByMachineId)
  const displayStatus = displayStatusLabel(machine.status)
  const statusTone = statusToneClasses(machine.status)
  return (
    <div className={`rounded-xl border p-4 ${isRed ? 'border-red-500/30 bg-red-500/5' : processTheme.panel}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-100">{machine.name}</h3>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone.badge}`}>
            {displayStatus}
          </span>
          <span className="rounded-full bg-slate-600/30 px-2 py-0.5 text-[10px] font-bold text-slate-300">AUTO</span>
          <button onClick={() => onOpenControl?.(machine)} className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-panel/60 text-slate-400 hover:text-slate-200 transition-colors">
            <Settings size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center gap-3">
          <div className={`font-mono text-4xl font-bold ${isRed ? 'text-red-300' : processTheme.value}`}>{machine.oee}%</div>
          <div className="text-[10px] text-slate-400">OEE</div>
        </div>

        <div className="space-y-2">
          {[
            { label: 'Availability', value: machine.availability, color: 'bg-green-500' },
            { label: 'Performance', value: machine.performance, color: 'bg-amber-500' },
            { label: 'Quality', value: machine.quality, color: 'bg-violet-500' },
            { label: 'OEE', value: machine.oeeBar, color: 'bg-sky-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 text-slate-400">{item.label}</span>
              <div className="flex-1 rounded-full bg-bg-panel/60 h-1.5">
                <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
              </div>
              <span className="w-8 text-right font-mono text-slate-200">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">Working time</div>
          <div className="mt-1 font-mono text-lg font-black text-emerald-200">{runtime.workingTimeMinutes.toLocaleString()} min</div>
        </div>
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-red-200/80">Stop time</div>
          <div className="mt-1 font-mono text-lg font-black text-red-200">{runtime.stopTimeMinutes.toLocaleString()} min</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[11px] text-slate-400">
        <span>
          Line {machine.line}
          {machine.good !== null && ` - Good ${machine.good}/${machine.total}`}
        </span>
        <span>
          Scrap: <span className={isRed ? 'text-red-400' : processTheme.value}>{machine.scrap}</span>
        </span>
      </div>
    </div>
  )
}

MachineCard.propTypes = {
  machine: PropTypes.shape({
    name: PropTypes.string.isRequired,
    line: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    oee: PropTypes.number.isRequired,
    availability: PropTypes.number.isRequired,
    performance: PropTypes.number.isRequired,
    quality: PropTypes.number.isRequired,
    oeeBar: PropTypes.number.isRequired,
    good: PropTypes.number,
    total: PropTypes.number,
    scrap: PropTypes.number.isRequired,
    theme: PropTypes.string.isRequired,
    processId: PropTypes.number,
    workingTimeMinutes: PropTypes.number,
    stopTimeMinutes: PropTypes.number,
  }).isRequired,
  onOpenControl: PropTypes.func,
  processTheme: PropTypes.object,
  runtimeByMachineId: PropTypes.objectOf(PropTypes.shape({
    workingTimeMinutes: PropTypes.number.isRequired,
    stopTimeMinutes: PropTypes.number.isRequired,
  })),
}

function MachineContainerCard({
  machine,
  layout = 'card',
  runtimeByMachineId = {},
  processTheme,
  pictureSrc = '',
  onPictureChange,
  showPictureUpload = false,
  showTotalPower = false,
  limitStatusLabels = false,
}) {
  const Icon = machine.icon
  const accent = processTheme || accentClasses[machine.accent] || accentClasses.cyan
  const subMachines = Array.isArray(machine.subMachines) ? machine.subMachines : []
  const hasSubMachineSummary = subMachines.length > 0
  const statusLabelFor = (status) => displayStatusLabel(status, limitStatusLabels)
  const runningSubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'RUNNING').length
  const alertSubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'ALERT').length
  const standbySubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'STANDBY').length
  const disconnectSubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'DISCONNECT').length
  const stopSubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'STOP').length
  const alarmSubMachineCount = subMachines.filter((subMachine) => statusLabelFor(subMachine.status) === 'ALARM').length
  const issueSubMachineCount = (limitStatusLabels ? disconnectSubMachineCount : stopSubMachineCount) + alarmSubMachineCount
  const machineRuntime = getMachineRuntime(machine, runtimeByMachineId)
  const isRunning = hasSubMachineSummary ? runningSubMachineCount === subMachines.length : statusLabelFor(machine.status) === 'RUNNING'
  const cardStatusLabel = hasSubMachineSummary
    ? (() => {
      if (alarmSubMachineCount > 0) return 'ALARM'
      if (disconnectSubMachineCount > 0) return 'DISCONNECT'
      if (standbySubMachineCount > 0 || alertSubMachineCount > 0) return limitStatusLabels ? 'STANDBY' : 'STOP'
      if (issueSubMachineCount > 0) return limitStatusLabels ? 'DISCONNECT' : 'STOP'
      return 'RUNNING'
    })()
    : displayStatusLabel(machine.status, limitStatusLabels)
  const containerStatusTone = statusToneClasses(cardStatusLabel, limitStatusLabels)
  const primaryMetricIsStatus = String(machine.primaryLabel || '').includes('สถานะ')
  const showPrimaryMetric = !limitStatusLabels
  const currentPower = powerNumber(machine.power, 0)
  const totalPower = getMachineTotalPower(machine)
  const totalPowerLabel = machine.totalPowerLabel || `Total power ${machine.totalPowerUnit || 'kW'}`
  const totalPowerUnit = machine.totalPowerUnit || 'kW'
  const rowLayout = layout === 'row'
  const singleMachineRowLayout = rowLayout && !hasSubMachineSummary
  const compactSubMachines = subMachines.length > 2
  const subMachineGridClass = rowLayout
    ? machine.subMachineColumns === 2
      ? 'sm:grid-cols-2'
      : subMachines.length >= 6
        ? 'lg:grid-cols-2 xl:grid-cols-3'
        : subMachines.length >= 4
          ? 'lg:grid-cols-2 xl:grid-cols-4'
          : 'sm:grid-cols-2'
    : 'sm:grid-cols-2'
  const detailClass = rowLayout ? 'lg:col-span-full' : ''
  const metricsGridClass = singleMachineRowLayout
    ? `grid-cols-2 lg:col-span-2 ${showTotalPower ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} lg:pt-8`
    : 'grid-cols-2'
  const statusSymbolClass = {
    RUNNING: 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.75)]',
    STANDBY: 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]',
    DISCONNECT: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]',
    ALERT: 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]',
    ALARM: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]',
  }[cardStatusLabel] || 'bg-slate-400'

  const handlePictureUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onPictureChange?.(machine, reader.result)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className={`relative h-fit overflow-hidden rounded-xl border ${accent.border} ${accent.bg} p-4 ${
      rowLayout
        ? 'lg:grid lg:grid-cols-[minmax(240px,0.75fr)_minmax(320px,0.85fr)_minmax(0,2.4fr)] lg:items-start lg:gap-4'
        : machine.wide ? 'xl:col-span-2' : ''
    }`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${accent.line}`} />
      {limitStatusLabels && (
        <div
          className={`absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black uppercase leading-none ${containerStatusTone.badge}`}
          title={`Status: ${cardStatusLabel}`}
          aria-label={`Status: ${cardStatusLabel}`}
        >
          <span className={`h-2 w-2 rounded-full ${statusSymbolClass}`} />
          <span>{cardStatusLabel}</span>
        </div>
      )}
      <div className={`flex flex-wrap items-start justify-between gap-3 ${limitStatusLabels ? 'pr-24' : ''}`}>
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconText}`}>
            <Icon size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black leading-snug text-slate-100">{machine.name}</h3>
            <p className="mt-1 text-xs text-slate-400">{machine.type}</p>
          </div>
        </div>
      </div>

      {showPictureUpload && (
        <label className={`mt-4 block cursor-pointer overflow-hidden rounded-lg border transition-colors hover:border-sky-400/50 ${accent.metricMuted || 'border-border bg-bg-card/45'} ${pictureSrc ? 'aspect-[16/9]' : 'flex min-h-32 items-center justify-center'}`}>
          {pictureSrc ? (
            <img src={pictureSrc} alt={machine.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={28} strokeWidth={1.8} className="text-slate-500" />
          )}
          <input type="file" accept="image/*" className="sr-only" onChange={handlePictureUpload} aria-label={`Upload picture for ${machine.name}`} />
        </label>
      )}

      <div className={`grid ${metricsGridClass} gap-3 ${rowLayout ? 'mt-4 lg:mt-0' : 'mt-5'}`}>
        {showPrimaryMetric && (
          <div className={`rounded-lg border ${accent.metricMuted || 'border-border bg-bg-card/45'} p-3`}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{machine.primaryLabel}</div>
            {hasSubMachineSummary ? (
              <>
                <div className={`mt-2 font-mono text-2xl font-black ${isRunning ? accent.value : containerStatusTone.text}`}>
                  {runningSubMachineCount}/{subMachines.length}
                </div>
                <div className={`mt-1 text-xs font-bold ${isRunning ? 'text-emerald-300' : containerStatusTone.text}`}>
                  {isRunning
                    ? 'ทุกเครื่องทำงาน'
                    : alarmSubMachineCount > 0
                      ? `${alarmSubMachineCount} เครื่อง ALARM`
                      : limitStatusLabels
                        ? `${alertSubMachineCount} เครื่อง ALERT`
                        : `${stopSubMachineCount} เครื่อง STOP`}
                </div>
              </>
            ) : (
              primaryMetricIsStatus ? (
                <div className={`mt-2 font-mono text-2xl font-black ${containerStatusTone.text}`}>
                  {displayStatusLabel(machine.status, limitStatusLabels)}
                </div>
              ) : (
                <div className={`mt-2 font-mono text-2xl font-black ${accent.value}`}>{machine.primaryValue}</div>
              )
            )}
          </div>
        )}
        <div className={`rounded-lg border ${accent.metricMuted || 'border-border bg-bg-card/45'} p-3`}>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <Zap size={12} />
            {showTotalPower ? 'Power kW' : 'Power'}
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-slate-100">
            {formatPower(currentPower)} <span className="text-xs text-slate-400">{machine.unit}</span>
          </div>
        </div>
        {showTotalPower && (
          <div className={`rounded-lg border ${accent.metricMuted || 'border-border bg-bg-card/45'} p-3`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
              <Zap size={12} />
              {totalPowerLabel}
            </div>
            <div className="mt-2 font-mono text-2xl font-black text-slate-100">
              {formatPower(totalPower)} <span className="text-xs text-slate-400">{totalPowerUnit}</span>
            </div>
          </div>
        )}
        {!hasSubMachineSummary && (
          <>
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">Working time</div>
              <div className="mt-2 font-mono text-2xl font-black text-emerald-200">
                {machineRuntime.workingTimeMinutes.toLocaleString()} <span className="text-xs text-emerald-200/70">min</span>
              </div>
            </div>
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-red-200/80">Stop time</div>
              <div className="mt-2 font-mono text-2xl font-black text-red-200">
                {machineRuntime.stopTimeMinutes.toLocaleString()} <span className="text-xs text-red-200/70">min</span>
              </div>
            </div>
          </>
        )}
      </div>

      {subMachines.length > 0 && (
        <div className={`grid grid-cols-1 ${subMachineGridClass} ${compactSubMachines ? 'gap-2' : 'gap-3'} ${rowLayout ? 'mt-4 lg:mt-0' : 'mt-4'}`}>
          {subMachines.map((subMachine) => {
            const subMachineStatusTone = statusToneClasses(subMachine.status, limitStatusLabels)
            const subMachineRuntime = getMachineRuntime(subMachine, runtimeByMachineId)
            const subMachinePower = powerNumber(subMachine.power, 0)
            const subMachineTotalPower = getMachineTotalPower(subMachine)
            return (
              <div key={subMachine.id} className={`rounded-lg border ${accent.metricMuted || 'border-border bg-bg-card/45'} ${compactSubMachines ? 'p-2.5' : 'p-3'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black leading-snug text-slate-100">{subMachine.name}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{subMachine.type}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">สถานะ</div>
                    <div className={`mt-1 font-mono text-lg font-black ${subMachineStatusTone.text}`}>
                      {displayStatusLabel(subMachine.status, limitStatusLabels)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                      <Zap size={11} />
                      {showTotalPower ? 'Power kW' : 'Power'}
                    </div>
                    <div className="mt-1 font-mono text-lg font-black text-slate-100">
                      {formatPower(subMachinePower)} <span className="text-[10px] text-slate-400">{subMachine.unit}</span>
                    </div>
                  </div>
                  {showTotalPower && (
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                        <Zap size={11} />
                        Total power kW
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-slate-100">
                        {formatPower(subMachineTotalPower)} <span className="text-[10px] text-slate-400">kW</span>
                      </div>
                    </div>
                  )}
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-emerald-200/80">Working time</div>
                    <div className="mt-1 font-mono text-base font-black text-emerald-200">
                      {subMachineRuntime.workingTimeMinutes.toLocaleString()} <span className="text-[9px] text-emerald-200/70">min</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-red-200/80">Stop time</div>
                    <div className="mt-1 font-mono text-base font-black text-red-200">
                      {subMachineRuntime.stopTimeMinutes.toLocaleString()} <span className="text-[9px] text-red-200/70">min</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className={`mt-4 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-slate-400 ${detailClass}`}>
        <Activity size={14} className={accent.iconText} />
        <span>{machine.detail}</span>
      </div>
    </div>
  )
}

MachineContainerCard.propTypes = {
  machine: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    power: PropTypes.number.isRequired,
    totalPower: PropTypes.number,
    totalPowerLabel: PropTypes.string,
    totalPowerUnit: PropTypes.string,
    unit: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    accent: PropTypes.string.isRequired,
    primaryLabel: PropTypes.string.isRequired,
    primaryValue: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    picture: PropTypes.string,
    workingTimeMinutes: PropTypes.number,
    stopTimeMinutes: PropTypes.number,
    wide: PropTypes.bool,
    subMachineColumns: PropTypes.oneOf([2]),
    subMachines: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      power: PropTypes.number.isRequired,
      totalPower: PropTypes.number,
      unit: PropTypes.string.isRequired,
      primaryValue: PropTypes.string.isRequired,
      workingTimeMinutes: PropTypes.number,
      stopTimeMinutes: PropTypes.number,
    })),
  }).isRequired,
  layout: PropTypes.oneOf(['card', 'row']),
  onPictureChange: PropTypes.func,
  pictureSrc: PropTypes.string,
  processTheme: PropTypes.object,
  limitStatusLabels: PropTypes.bool,
  showPictureUpload: PropTypes.bool,
  showTotalPower: PropTypes.bool,
  runtimeByMachineId: PropTypes.objectOf(PropTypes.shape({
    workingTimeMinutes: PropTypes.number.isRequired,
    stopTimeMinutes: PropTypes.number.isRequired,
  })),
}

function LoadcellTrendPanel({ config, now, processTheme, isOn = true, reading = null, sampledAt = null, runtime = ZERO_RUNTIME }) {
  const sampleTime = useMemo(() => parseSampleTime(sampledAt, now), [sampledAt, now])
  const [series, setSeries] = useState(() => {
    const sample = makeLoadcellSample(sampleTime, reading)
    return sample ? [sample] : []
  })
  const stats = useMemo(() => getLoadcellStats(series, reading), [series, reading])
  const loadcellRuntime = useMemo(() => getLoadcellRuntime(reading, runtime), [reading, runtime])
  const chartMax = useMemo(() => getLoadcellChartMax(series, stats, config.chartMax), [series, stats, config.chartMax])
  const nodeRedMaximum = powerNumber(reading?.maximum, 0)
  const nodeRedTotal = powerNumber(reading?.total, 0)
  const fillPercent = chartMax > 0 ? loadcellClamp((stats.current / chartMax) * 100) : 0
  const maximumPercent = chartMax > 0 ? loadcellClamp((nodeRedMaximum / chartMax) * 100) : 0
  const totalPercent = nodeRedTotal > 0 ? 100 : 0
  const totalRuntimeMinutes = loadcellRuntime.workingTimeMinutes + loadcellRuntime.stopTimeMinutes
  const workingPercent = totalRuntimeMinutes > 0
    ? loadcellClamp((loadcellRuntime.workingTimeMinutes / totalRuntimeMinutes) * 100)
    : 0
  const stopPercent = totalRuntimeMinutes > 0
    ? loadcellClamp((loadcellRuntime.stopTimeMinutes / totalRuntimeMinutes) * 100)
    : 0
  const ringOffset = 314 - (314 * fillPercent) / 100
  const toneStyles = {
    cyan: {
      border: 'border-cyan-400/30',
      borderStrong: 'border-cyan-300/45',
      bg: 'bg-cyan-400/10',
      bgSoft: 'bg-cyan-400/5',
      text: 'text-cyan-200',
      value: 'text-cyan-300',
      muted: 'text-cyan-100/70',
      ring: 'ring-cyan-400/20',
      shadow: 'shadow-[0_0_38px_rgba(34,211,238,0.18)]',
    },
    emerald: {
      border: 'border-emerald-400/30',
      borderStrong: 'border-emerald-300/45',
      bg: 'bg-emerald-400/10',
      bgSoft: 'bg-emerald-400/5',
      text: 'text-emerald-200',
      value: 'text-emerald-300',
      muted: 'text-emerald-100/70',
      ring: 'ring-emerald-400/20',
      shadow: 'shadow-[0_0_38px_rgba(52,211,153,0.18)]',
    },
    violet: {
      border: 'border-violet-400/30',
      borderStrong: 'border-violet-300/45',
      bg: 'bg-violet-400/10',
      bgSoft: 'bg-violet-400/5',
      text: 'text-violet-200',
      value: 'text-violet-300',
      muted: 'text-violet-100/70',
      ring: 'ring-violet-400/20',
      shadow: 'shadow-[0_0_38px_rgba(139,92,246,0.2)]',
    },
  }
  const tone = toneStyles[config.tone] || toneStyles.emerald
  const lastUpdatedLabel = sampleTime.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const signalStatus = isOn
    ? {
        label: 'ON',
        badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]',
      }
    : {
        label: 'OFF',
        badge: 'border-red-400/40 bg-red-500/15 text-red-200',
        dot: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]',
      }

  useEffect(() => {
    setSeries([])
  }, [config.id])

  useEffect(() => {
    const sample = makeLoadcellSample(sampleTime, reading)
    if (!sample) return
    setSeries((current) => appendLoadcellSample(current, sample))
  }, [reading, sampleTime])

  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border ${processTheme.borderStrong} bg-bg-card/90 panel ring-1 ${processTheme.ring} xl:min-h-[calc(100dvh-220px)]`}>
      <div className={`border-b ${processTheme.border} bg-bg-panel/35 px-4 py-2`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${tone.border} ${tone.bg} ${tone.value}`}>
              <Scale size={19} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <div className={`text-[11px] font-black uppercase tracking-wider ${tone.value}`}>{config.title}</div>
              <h2 className="mt-0.5 text-base font-black leading-tight text-slate-100">{config.chartTitle}</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${signalStatus.badge}`}>
              <span className={`h-2 w-2 rounded-full ${signalStatus.dot}`} />
              {signalStatus.label}
            </span>
            <span className="rounded-full border border-border bg-bg-card/60 px-3 py-1 font-mono text-[10px] font-bold text-slate-300">
              {lastUpdatedLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 p-3 xl:flex-1 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="grid grid-cols-1 content-start gap-3 xl:h-full xl:grid-rows-[minmax(300px,1fr)_128px]">
          <div className={`relative flex h-[300px] flex-col overflow-hidden rounded-lg border ${tone.borderStrong} bg-bg-panel/45 p-3 ${tone.shadow} xl:h-full`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-white/5 to-transparent" />
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Signal Trend</div>
                <div className="mt-1 font-mono text-2xl font-black text-slate-100">
                  {formatLoadcellValue(stats.current)}
                  <span className={`ml-2 text-sm ${tone.text}`}>kg</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right">
                <div className={`rounded-lg border ${tone.border} ${tone.bgSoft} px-3 py-2`}>
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Avg</div>
                  <div className={`mt-1 font-mono text-sm font-black ${tone.value}`}>{formatLoadcellValue(stats.average)}</div>
                </div>
                <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">Min</div>
                  <div className="mt-1 font-mono text-sm font-black text-slate-200">{formatLoadcellValue(stats.minimum)}</div>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`${config.id}-fill`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={config.fillColor} stopOpacity={0.34} />
                      <stop offset="100%" stopColor={config.fillColor} stopOpacity={0.02} />
                    </linearGradient>
                    <filter id={`${config.id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.11)" vertical strokeDasharray="4 6" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[0, chartMax]}
                    allowDataOverflow={Boolean(config.chartMax)}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: config.lineColor, strokeOpacity: 0.26, strokeDasharray: '4 4' }}
                    contentStyle={{
                      background: '#020617',
                      border: `1px solid ${config.lineColor}66`,
                      borderRadius: 8,
                      color: '#e2e8f0',
                      boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                    }}
                    formatter={(value) => [`${formatLoadcellValue(value)} kg`, config.chartTitle]}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke={config.lineColor}
                    strokeWidth={2.5}
                    fill={`url(#${config.id}-fill)`}
                    filter={`url(#${config.id}-glow)`}
                    dot={series.length < 2 ? { r: 3, stroke: config.lineColor, strokeWidth: 2, fill: '#020617' } : false}
                    activeDot={{ r: 4, stroke: config.lineColor, strokeWidth: 2, fill: '#020617' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:h-full">
            <div className="h-[128px] overflow-hidden rounded-lg border border-violet-400/35 bg-violet-400/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{config.maximumLabel}</div>
              <div className="mt-2 font-mono text-3xl font-black text-violet-300">
                {formatLoadcellValue(nodeRedMaximum)}
                <span className="ml-2 text-sm text-slate-300">kg</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${maximumPercent}%` }} />
              </div>
            </div>
            <div className="h-[128px] overflow-hidden rounded-lg border border-red-400/35 bg-red-400/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{config.totalLabel}</div>
              <div className="mt-2 font-mono text-3xl font-black text-red-300">
                {formatLoadcellValue(nodeRedTotal, 1)}
                <span className="ml-2 text-sm text-slate-300">kg</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full rounded-full bg-red-400" style={{ width: `${totalPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 content-start gap-3 xl:h-full xl:grid-rows-[minmax(300px,1fr)_128px]">
          <div className={`flex h-[300px] flex-col overflow-hidden rounded-lg border ${tone.borderStrong} ${tone.bgSoft} p-3 ${tone.shadow} xl:h-full`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{config.currentLabel}</div>
                <div className={`mt-1 text-xs font-bold ${tone.muted}`}>Real-time load</div>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${tone.border} ${tone.text}`}>kg</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="relative h-56 w-56 2xl:h-64 2xl:w-64">
              <svg className="-rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={config.lineColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="314"
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="font-mono text-5xl font-black text-slate-100">{formatLoadcellValue(stats.current)}</div>
                <div className={`mt-1 text-sm font-bold ${tone.text}`}>kg</div>
                <div className="mt-3 h-1.5 w-28 overflow-hidden rounded-full bg-slate-700/60">
                  <div className="h-full rounded-full" style={{ width: `${fillPercent}%`, backgroundColor: config.lineColor }} />
                </div>
              </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:h-full xl:grid-cols-2">
            <div className={`h-[128px] overflow-hidden rounded-lg border ${tone.border} ${tone.bg} p-3`}>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Working Time</div>
              <div className="mt-2 font-mono text-3xl font-black text-emerald-300">
                {loadcellRuntime.workingTimeMinutes.toLocaleString()}
                <span className="ml-2 text-sm text-slate-300">min</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${workingPercent}%` }} />
              </div>
            </div>
            <div className="h-[128px] overflow-hidden rounded-lg border border-red-400/25 bg-red-400/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Stop Time</div>
              <div className="mt-2 font-mono text-3xl font-black text-red-300">
                {loadcellRuntime.stopTimeMinutes.toLocaleString()}
                <span className="ml-2 text-sm text-slate-300">min</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                <span>Total time</span>
                <span className="text-right font-mono font-bold text-slate-200">{totalRuntimeMinutes.toLocaleString()} min</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700/50">
                <div className="h-full rounded-full bg-red-400" style={{ width: `${stopPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

LoadcellTrendPanel.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    chartTitle: PropTypes.string.isRequired,
    currentLabel: PropTypes.string.isRequired,
    maximumLabel: PropTypes.string.isRequired,
    totalLabel: PropTypes.string.isRequired,
    tone: PropTypes.oneOf(['emerald', 'cyan', 'violet']).isRequired,
    lineColor: PropTypes.string.isRequired,
    fillColor: PropTypes.string.isRequired,
    phase: PropTypes.number.isRequired,
    base: PropTypes.number.isRequired,
    chartMax: PropTypes.number,
    runtimeMachineId: PropTypes.string,
  }).isRequired,
  now: PropTypes.instanceOf(Date).isRequired,
  processTheme: PropTypes.object.isRequired,
  isOn: PropTypes.bool,
  sampledAt: PropTypes.string,
  runtime: PropTypes.shape({
    workingTimeMinutes: PropTypes.number,
    stopTimeMinutes: PropTypes.number,
  }),
  reading: PropTypes.shape({
    current: PropTypes.number,
    maximum: PropTypes.number,
    total: PropTypes.number,
    workingTimeMinutes: PropTypes.number,
    stopTimeMinutes: PropTypes.number,
    status: PropTypes.string,
    isOnline: PropTypes.bool,
  }),
}

function FinishedGoodsWarehouse({ processTheme = getProcessTheme(6) }) {
  const [productionEntries, setProductionEntries] = useState([])
  const [warehouseInputs, setWarehouseInputs] = useState(() => readFinishedGoodsInputs())
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    const loadProductionEntries = async () => {
      try {
        setLoading(true)
        const res = await api.getProductionEntries({ limit: 1000 })
        if (!cancelled) setProductionEntries(res.data || [])
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load production entries:', err)
          setProductionEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProductionEntries()
    const refreshTimer = setInterval(() => setNow(new Date()), 30000)
    const handleProductionEntriesChanged = () => loadProductionEntries()
    const handleStorage = (event) => {
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY) loadProductionEntries()
      if (event.key === FINISHED_GOODS_STORAGE_KEY) setWarehouseInputs(readFinishedGoodsInputs())
    }

    window.addEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
    window.addEventListener('storage', handleStorage)

    return () => {
      cancelled = true
      clearInterval(refreshTimer)
      window.removeEventListener(PRODUCTION_ENTRIES_CHANGED_EVENT, handleProductionEntriesChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const finishedJobs = useMemo(() => {
    return productionEntries
      .map((entry, index) => {
        if (!isEntryFinished(entry, now)) return null
        const product = String(entry.product || entry.name || '').trim()
        if (!product) return null
        const startMinutes = Number(entry.startMinutes) || 0
        const endMinutes = Number(entry.endMinutes) || Math.min(startMinutes + 60, 24 * 60)
        const date = getEntryDate(entry)
        return {
          storageKey: getFinishedGoodsEntryKey(entry, index),
          product,
          date,
          dateLabel: formatThaiDate(date),
          timeRange: entry.timeRange || `${formatTimeFromMinutes(startMinutes)} - ${formatTimeFromMinutes(endMinutes)}`,
          startMinutes,
          endMinutes,
          expectedKg: Number(entry.target ?? entry.data?.standardWeight) || 0,
          calendarOutputKg: Number(entry.siloOutput ?? entry.data?.outputWeight) || 0,
          finishedAt: getEntryFinishedAt(entry),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dateDiff = (b.finishedAt?.getTime() || 0) - (a.finishedAt?.getTime() || 0)
        if (dateDiff) return dateDiff
        return a.product.localeCompare(b.product)
      })
  }, [productionEntries, now])

  const productJobCounts = useMemo(() => {
    return finishedJobs.reduce((counts, job) => {
      counts.set(job.product, (counts.get(job.product) || 0) + 1)
      return counts
    }, new Map())
  }, [finishedJobs])

  const warehouseRows = useMemo(() => {
    return finishedJobs.map((item) => {
      const input = warehouseInputs[item.storageKey]
        || (productJobCounts.get(item.product) === 1 ? warehouseInputs[item.product] : {})
        || {}
      const variants = normalizeFinishedGoodsVariants(input).map((variant) => {
        const bagCount = Number(variant.bagCount) || 0
        const productSize = Number(variant.productSize) || 0
        return {
          ...variant,
          bagCount,
          productSize,
          bagCountInput: variant.bagCount,
          productSizeInput: variant.productSize,
          totalKg: bagCount * productSize,
        }
      })
      const bagCount = variants.reduce((sum, variant) => sum + variant.bagCount, 0)
      const packedKg = variants.reduce((sum, variant) => sum + variant.totalKg, 0)
      const hasPackingInput = variants.some((variant) => (
        String(variant.bagCountInput).trim() !== '' || String(variant.productSizeInput).trim() !== ''
      ))
      const performance = item.expectedKg > 0 && hasPackingInput ? (packedKg / item.expectedKg) * 100 : null
      return {
        ...item,
        variants,
        bagCount,
        packedKg,
        varianceKg: packedKg - item.expectedKg,
        performance,
        hasPackingInput,
      }
    })
  }, [finishedJobs, productJobCounts, warehouseInputs])

  const updateWarehouseVariant = (storageKey, variantId, field, value) => {
    setWarehouseInputs((prev) => {
      const variants = normalizeFinishedGoodsVariants(prev[storageKey]).map((variant) => (
        variant.id === variantId ? { ...variant, [field]: value } : variant
      ))
      const next = {
        ...prev,
        [storageKey]: {
          variants,
        },
      }
      writeFinishedGoodsInputs(next)
      return next
    })
  }

  const addWarehouseVariant = (storageKey) => {
    setWarehouseInputs((prev) => {
      const variants = normalizeFinishedGoodsVariants(prev[storageKey])
      const next = {
        ...prev,
        [storageKey]: {
          variants: [...variants, makeFinishedGoodsVariant()],
        },
      }
      writeFinishedGoodsInputs(next)
      return next
    })
  }

  const removeWarehouseVariant = (storageKey, variantId) => {
    setWarehouseInputs((prev) => {
      const variants = normalizeFinishedGoodsVariants(prev[storageKey])
      const remaining = variants.filter((variant) => variant.id !== variantId)
      const next = {
        ...prev,
        [storageKey]: {
          variants: remaining.length ? remaining : [makeFinishedGoodsVariant({ id: 'size-1' })],
        },
      }
      writeFinishedGoodsInputs(next)
      return next
    })
  }

  return (
    <section className={`rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} p-4 panel ring-1 ${processTheme.ring}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${processTheme.text}`}>
            <Boxes size={14} strokeWidth={2} />
            <span>Finished Goods Warehouse</span>
          </div>
          <h2 className="mt-1 text-lg font-black text-slate-100">คลังเก็บสินค้าสำเร็จรูป</h2>
          <p className="mt-1 text-xs text-slate-400">แยกตามงานผลิตที่เสร็จแล้ว สินค้าเดิมผลิตซ้ำจะแยกเป็นคนละรายการ</p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold ${processTheme.chip}`}>
          AUTO PRODUCT
        </span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className={`rounded-xl border px-4 py-8 text-center text-sm text-slate-400 ${processTheme.metricMuted}`}>
            กำลังโหลดสินค้าสำเร็จรูป...
          </div>
        ) : warehouseRows.length === 0 ? (
          <div className={`rounded-xl border px-4 py-8 text-center text-sm text-slate-400 ${processTheme.metricMuted}`}>
            ยังไม่มีสินค้าที่ผลิตเสร็จ
          </div>
        ) : (
          warehouseRows.map((row) => {
            const performanceClass = row.performance === null
              ? 'border-slate-500/25 bg-slate-500/10 text-slate-300'
              : row.performance >= 100
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : row.performance >= 95
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                  : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
            const varianceClass = !row.hasPackingInput || row.varianceKg === 0
              ? 'text-slate-300'
              : row.varianceKg > 0
                ? 'text-emerald-300'
                : 'text-amber-300'

            return (
            <div key={row.storageKey} className={`overflow-hidden rounded-xl border ${processTheme.border} bg-bg-panel/35`}>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b ${processTheme.border} ${processTheme.metricMuted} px-4 py-3`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-black text-slate-100">{row.product}</div>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${processTheme.chip}`}>
                      {row.variants.length} size
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.dateLabel} · {row.timeRange}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-xs font-bold ${performanceClass}`}>
                    A {formatPercent(row.performance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => addWarehouseVariant(row.storageKey)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${processTheme.chip} hover:bg-white/10`}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    เพิ่ม size
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-border px-4 py-3 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-bg-card/45 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">ผลคาดไว้</div>
                  <div className="mt-1 font-mono text-lg font-black text-amber-300">{formatKg(row.expectedKg)} kg</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-card/45 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">บรรจุจริง</div>
                  <div className="mt-1 font-mono text-lg font-black text-emerald-300">{formatKg(row.packedKg)} kg</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-card/45 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">A</div>
                  <div className="mt-1 font-mono text-lg font-black text-cyan-300">{formatPercent(row.performance)}</div>
                </div>
                <div className="rounded-lg border border-border bg-bg-card/45 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">ส่วนต่าง</div>
                  <div className={`mt-1 font-mono text-lg font-black ${varianceClass}`}>
                    {row.hasPackingInput ? `${row.varianceKg > 0 ? '+' : ''}${formatKg(row.varianceKg)} kg` : '-'}
                  </div>
                </div>
              </div>

              <div className="hidden grid-cols-[130px_150px_150px_40px] gap-3 border-b border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:grid">
                <div>จำนวนถุง</div>
                <div>Size Product</div>
                <div>kg ของ size นี้</div>
                <div />
              </div>

              <div className="divide-y divide-border">
                {row.variants.map((variant, index) => (
                  <div key={variant.id} className="grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[130px_150px_150px_40px] lg:items-center">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500 lg:hidden">จำนวนถุง</label>
                      <input
                        type="number"
                        min="0"
                        value={variant.bagCountInput}
                        onChange={(event) => updateWarehouseVariant(row.storageKey, variant.id, 'bagCount', event.target.value)}
                        className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500 lg:hidden">Size Product</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={variant.productSizeInput}
                          onChange={(event) => updateWarehouseVariant(row.storageKey, variant.id, 'productSize', event.target.value)}
                          className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                          placeholder="0"
                        />
                        <span className="shrink-0 text-xs text-slate-500">kg/ถุง</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500 lg:hidden">kg ของ size นี้</label>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-mono text-sm font-black text-emerald-300">
                        {formatKg(variant.totalKg)} kg
                      </div>
                    </div>
                    <div className="flex justify-end lg:justify-center">
                      <button
                        type="button"
                        onClick={() => removeWarehouseVariant(row.storageKey, variant.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                        title="ลบ size"
                        aria-label={`ลบ size ${index + 1}`}
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default function ProcessDetail({ processId }) {
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [productionEntries, setProductionEntries] = useState(() => readStoredProductionEntries())
  const [now, setNow] = useState(() => new Date())
  const [runtimeStore, setRuntimeStore] = useState(() => readProcessRuntimeStore())
  const [machinePictures, setMachinePictures] = useState(() => readMachinePictures())
  const seed = parseInt(processId, 10) || 1
  const stage = stages[seed - 1] || stages[0]
  const processTheme = getProcessTheme(seed)
  const machine = machines.find((m) => m.processId === seed)
  const machineContainers = processMachineContainerBoards[seed] || []
  const loadcellChartConfig = loadcellChartConfigs[seed] || null
  const nodeRedDashboardPollMs = loadcellChartConfig ? LOADCELL_REALTIME_POLL_MS : NODE_RED_DASHBOARD_POLL_MS
  const { dashboard: nodeRedDashboard } = useNodeRedDashboard(nodeRedDashboardPollMs)
  const isPackagingMachineBoard = seed === 5
  const loadcellReading = getProcessLoadcellReading(nodeRedDashboard, seed)
  const effectiveProcessMachineContainerBoards = useMemo(
    () => Object.fromEntries(Object.entries(processMachineContainerBoards).map(([processId, containers]) => [
      processId,
      getEffectiveProcessMachineContainers(Number(processId), containers, nodeRedDashboard),
    ])),
    [nodeRedDashboard]
  )
  const effectiveMachineContainers = effectiveProcessMachineContainerBoards[seed] || machineContainers
  const machineBoardStats = getMachineContainerBoardStats(effectiveMachineContainers, isPackagingMachineBoard)
  const loadcellSignalOn = loadcellChartConfig ? Boolean(loadcellReading?.isOnline) : false
  const machineBoardHasLiveData = effectiveMachineContainers.some(hasLiveMachineSource)
  const machineBoardSourceLabel = machineBoardHasLiveData ? 'LIVE DATA' : 'NO LIVE DATA'
  const useRowMachineBoard = seed === 3 || seed === 4
  const runtimeTriggerUnit = useMemo(
    () => findRuntimeTriggerUnit(effectiveProcessMachineContainerBoards),
    [effectiveProcessMachineContainerBoards]
  )
  const triggerRunning = statusIsRuntimeRunning(runtimeTriggerUnit?.status)
  const activeProductionCycle = useMemo(
    () => getCurrentProductionCycle(productionEntries, now),
    [productionEntries, now]
  )
  const visibleRuntimeUnits = useMemo(() => (
    effectiveMachineContainers.length > 0 ? getRuntimeMachineUnits(effectiveMachineContainers) : machine ? [machine] : []
  ), [effectiveMachineContainers, machine])
  const runtimeByMachineId = useMemo(
    () => getRuntimeByMachineId(runtimeStore, activeProductionCycle?.key),
    [runtimeStore, activeProductionCycle]
  )
  const loadcellRuntimeMachine = useMemo(() => {
    if (!loadcellChartConfig) return null
    const runtimeMachineId = String(loadcellChartConfig.runtimeMachineId || '').trim()
    return effectiveMachineContainers.find((container) => (
      container.id === runtimeMachineId || container.name === runtimeMachineId
    )) || null
  }, [effectiveMachineContainers, loadcellChartConfig])
  const loadcellRuntime = useMemo(
    () => getMachineRuntime(loadcellRuntimeMachine || {}, runtimeByMachineId),
    [loadcellRuntimeMachine, runtimeByMachineId]
  )
  useEffect(() => {
    let cancelled = false
    const loadProductionEntries = async () => {
      try {
        const res = await api.getProductionEntries({ limit: 1000 })
        const entries = Array.isArray(res.data) ? res.data : []
        if (cancelled) return
        setProductionEntries(entries)
        try {
          localStorage.setItem(PRODUCTION_ENTRIES_STORAGE_KEY, JSON.stringify(entries))
        } catch {}
      } catch {
        if (!cancelled) setProductionEntries(readStoredProductionEntries())
      }
    }

    loadProductionEntries()
    const handleProductionEntriesChanged = () => loadProductionEntries()
    const handleStorage = (event) => {
      if (event.key === PRODUCTION_ENTRIES_SYNC_KEY || event.key === PRODUCTION_ENTRIES_STORAGE_KEY) {
        loadProductionEntries()
      }
      if (event.key === MACHINE_PICTURES_STORAGE_KEY) setMachinePictures(readMachinePictures())
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
    const timer = setInterval(() => setNow(new Date()), PROCESS_RUNTIME_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setRuntimeStore((current) => {
      const next = updateProcessRuntimeStore(
        current,
        visibleRuntimeUnits,
        activeProductionCycle,
        triggerRunning,
        now
      )
      saveProcessRuntimeStore(next)
      return next
    })
  }, [visibleRuntimeUnits, activeProductionCycle, triggerRunning, now])

  const handleMachinePictureChange = (targetMachine, picture) => {
    const key = getMachineStorageKey(targetMachine)
    if (!key) return

    setMachinePictures((prev) => {
      const next = { ...prev, [key]: picture }
      writeMachinePictures(next)
      return next
    })
  }

  return (
    <div className={`${loadcellChartConfig ? 'space-y-3' : 'space-y-5'} max-w-[1600px] mx-auto`}>
      {/* Header */}
      <div className={`rounded-xl border ${processTheme.border} ${processTheme.bg} px-4 ${loadcellChartConfig ? 'py-2' : 'py-3'} shadow-[0_12px_40px_rgba(0,0,0,0.18)]`}>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Process Flow</span>
          <ArrowRight size={12} strokeWidth={2} />
          <span className={processTheme.text}>Process{seed}</span>
        </div>
        <h1 className={`mt-1 font-bold text-text-primary ${loadcellChartConfig ? 'text-xl' : 'text-2xl'}`}>
          ระยะที่ {seed} : {stage.title}
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          ขั้นตอนและรายละเอียดการทำงานของระยะที่ {seed}
        </p>
      </div>

      {loadcellChartConfig && (
        <LoadcellTrendPanel
          config={loadcellChartConfig}
          now={now}
          processTheme={processTheme}
          isOn={loadcellSignalOn}
          reading={loadcellReading}
          sampledAt={nodeRedDashboard?.updatedAt || null}
          runtime={loadcellRuntime}
        />
      )}

      {effectiveMachineContainers.length > 0 && (
        <section className={`rounded-xl border ${processTheme.borderStrong} ${processTheme.bg} p-4 panel ring-1 ${processTheme.ring}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${processTheme.text}`}>
                <Activity size={14} strokeWidth={2} />
                <span>Machine Container Board</span>
              </div>
              <h2 className="mt-1 text-lg font-black text-slate-100">ข้อมูลเครื่องจักรในระยะที่ {seed}</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-bold ${processTheme.chip}`}>
              {machineBoardSourceLabel}
            </span>
          </div>

          {seed === 3 || seed === 5 ? (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">RUNNING</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.running}/{machineBoardStats.total}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  <Zap size={12} />
                  Total Power KW
                </div>
                <div className="mt-1 font-mono text-xl font-black text-slate-100">
                  {formatPower(machineBoardStats.totalPowerKw)} <span className="text-xs text-slate-400">kW</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`mb-4 grid grid-cols-2 gap-2 ${isPackagingMachineBoard ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
              <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">กลุ่มเครื่อง</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.groups}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">เครื่องทั้งหมด</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.total}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">RUNNING</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.running}/{machineBoardStats.total}</div>
              </div>
              {isPackagingMachineBoard ? (
                <>
                  <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                      <Zap size={12} />
                      PROCESS POWER
                    </div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-100">
                      {formatPower(machineBoardStats.totalPowerKw)} <span className="text-xs text-slate-400">kW</span>
                    </div>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">STANDBY</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.standby}</div>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">DISCONNECT</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.disconnect}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">STOP</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.stop}</div>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 ${processTheme.metricMuted}`}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">ALARM</div>
                    <div className="mt-1 font-mono text-xl font-black text-slate-100">{machineBoardStats.alarm}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {useRowMachineBoard ? (
            <div className="space-y-3">
              {effectiveMachineContainers.map((item) => {
                const itemKey = getMachineStorageKey(item)
                return (
                  <MachineContainerCard
                    key={item.id}
                    machine={item}
                    layout="row"
                    runtimeByMachineId={runtimeByMachineId}
                    processTheme={processTheme}
                    pictureSrc={isPackagingMachineBoard ? machinePictures[itemKey] || item.picture || '' : ''}
                    onPictureChange={isPackagingMachineBoard ? handleMachinePictureChange : undefined}
                    showPictureUpload={isPackagingMachineBoard}
                    showTotalPower={isPackagingMachineBoard}
                    limitStatusLabels={isPackagingMachineBoard}
                  />
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3">
              {effectiveMachineContainers.map((item) => {
                const itemKey = getMachineStorageKey(item)
                return (
                  <MachineContainerCard
                    key={item.id}
                    machine={item}
                    runtimeByMachineId={runtimeByMachineId}
                    processTheme={processTheme}
                    pictureSrc={isPackagingMachineBoard ? machinePictures[itemKey] || item.picture || '' : ''}
                    onPictureChange={isPackagingMachineBoard ? handleMachinePictureChange : undefined}
                    showPictureUpload={isPackagingMachineBoard}
                    showTotalPower={isPackagingMachineBoard}
                    limitStatusLabels={isPackagingMachineBoard}
                  />
                )
              })}
            </div>
          )}
        </section>
      )}

      {seed === 6 && <FinishedGoodsWarehouse processTheme={processTheme} />}

      {/* Machine status board */}
      {seed !== 6 && effectiveMachineContainers.length === 0 && machine && (
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 section-head">
              <Settings size={14} strokeWidth={2} />
              <span>Machine Status Board</span>
            </div>
            <span className="text-[11px] text-slate-400">คลิกที่เครื่องดูรายละเอียด</span>
          </div>

          <MachineCard machine={machine} onOpenControl={setSelectedMachine} runtimeByMachineId={runtimeByMachineId} processTheme={processTheme} />
        </section>
      )}

      {selectedMachine && <MachineControlModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} />}
    </div>
  )
}

ProcessDetail.propTypes = {
  processId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
}
