import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import {
  Machine,
  OEESummary,
  Shift,
  Loss,
  Alert,
  Equipment,
  QualityData,
  OEEHistory,
  ProductionEntry,
  DataEntry,
  DowntimeEvent,
  MachineStatusLog,
  QualityRecord,
  MaintenanceRecord,
} from '../models/index.js'

const seedData = async () => {
  await connectDB()

  // Clear existing data
  await Machine.deleteMany()
  await OEESummary.deleteMany()
  await Shift.deleteMany()
  await Loss.deleteMany()
  await Alert.deleteMany()
  await Equipment.deleteMany()
  await QualityData.deleteMany()
  await OEEHistory.deleteMany()
  await ProductionEntry.deleteMany()
  await DataEntry.deleteMany()
  await DowntimeEvent.deleteMany()
  await MachineStatusLog.deleteMany()
  await QualityRecord.deleteMany()
  await MaintenanceRecord.deleteMany()

  console.log('Cleared existing collections')

  // ── Machines ─────────────────────────────────────────────────
  await Machine.insertMany([
    { name: 'Inbound & Storage', line: 'A', oee: 78.1, availability: 99, performance: 79, quality: 100, goodUnits: 750, totalUnits: 751, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, maintenanceWorkingMinutes: 0, workingHours: 0, segments: [0, 54, 0, 0], borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
    { name: 'Feeding / Material Handling', line: 'A', oee: 64.9, availability: 86, performance: 76, quality: 100, goodUnits: 623, totalUnits: 625, scrapUnits: 2, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, maintenanceWorkingMinutes: 0, workingHours: 0, segments: [0, 47, 0, 0], borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
    { name: 'Sorting & Cleaning', line: 'B', oee: 39.2, availability: 52, performance: 81, quality: 93, goodUnits: 377, totalUnits: 405, scrapUnits: 28, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, maintenanceWorkingMinutes: 0, workingHours: 0, segments: [0, 29, 0, 0], borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
    { name: 'Packaging', line: 'B', oee: 81.1, availability: 99, performance: 82, quality: 100, goodUnits: 778, totalUnits: 779, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, maintenanceWorkingMinutes: 0, workingHours: 0, segments: [0, 54, 0, 0], borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
    { name: 'QC & Dispatch', line: 'C', oee: 60.2, availability: 93, performance: 65, quality: 100, goodUnits: 578, totalUnits: 579, scrapUnits: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, maintenanceWorkingMinutes: 0, workingHours: 0, segments: [0, 51, 0, 0], borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' }
  ])
  console.log('Seeded Machines')

  // ── OEE Summary ──────────────────────────────────────────────
  await OEESummary.create({
    oee: 64.7,
    availability: 85.7,
    performance: 76.6,
    quality: 98.5,
    totalProduction: 3139,
    downtime: 344,
    targetOee: 85.0,
    goodUnits: 3106,
    scrapUnits: 33,
    hourly: [
      { hour: '00:00', oee: 72, availability: 80, performance: 88, quality: 95 },
      { hour: '02:00', oee: 74, availability: 82, performance: 89, quality: 96 },
      { hour: '04:00', oee: 76, availability: 84, performance: 90, quality: 96 },
      { hour: '06:00', oee: 80, availability: 88, performance: 91, quality: 97 },
      { hour: '08:00', oee: 82, availability: 86, performance: 93, quality: 97 },
      { hour: '10:00', oee: 78, availability: 84, performance: 90, quality: 96 },
      { hour: '12:00', oee: 75, availability: 82, performance: 89, quality: 96 },
      { hour: '14:00', oee: 79, availability: 85, performance: 91, quality: 97 },
      { hour: '16:00', oee: 81, availability: 87, performance: 92, quality: 97 },
      { hour: '18:00', oee: 77, availability: 83, performance: 90, quality: 96 },
      { hour: '20:00', oee: 73, availability: 80, performance: 88, quality: 95 },
      { hour: '22:00', oee: 71, availability: 79, performance: 87, quality: 95 }
    ],
    lastUpdated: new Date()
  })
  console.log('Seeded OEE Summary')

  // ── Shifts ───────────────────────────────────────────────────
  await Shift.insertMany([
    {
      name: 'Shift 1',
      type: 'Shift 1',
      time: '06:00 – 14:00',
      status: 'waiting',
      isCurrent: false,
      color: '#3b82f6',
      product: 'สินค้า1',
      received: 100,
      target: 95,
      bagSize: 5,
      cleaningTime: '00:30',
      availability: 88.5, runtime: 420, downtime: 60
    },
    {
      name: 'Shift 2',
      type: 'Shift 2',
      time: '14:00 – 22:00',
      status: 'waiting',
      isCurrent: false,
      color: '#10b981',
      product: 'สินค้า2',
      received: 200,
      target: 190,
      bagSize: 10,
      cleaningTime: '01:00',
      availability: 82.1, runtime: 390, downtime: 90
    },
    {
      name: 'Shift 3',
      type: 'Shift 3',
      time: '22:00 – 06:00',
      status: 'done',
      isCurrent: false,
      color: '#f59e0b',
      product: 'สินค้า3',
      received: 150,
      target: 140,
      bagSize: 5,
      cleaningTime: '00:45',
      availability: 85.0, runtime: 400, downtime: 80
    }
  ])
  console.log('Seeded Shifts')

  // ── Losses ────────────────────────────────────────────────────
  await Loss.insertMany([
    { name: 'Breakdowns', category: 'Availability', value: 5.4, color: '#ef4444', width: 16.2 },
    { name: 'Changeover', category: 'Availability', value: 3.7, color: '#f97316', width: 11.1 },
    { name: 'Small Stops', category: 'Performance', value: 12.9, color: '#f59e0b', width: 38.7 },
    { name: 'Reduced Speed', category: 'Performance', value: 10.5, color: '#eab308', width: 31.5 },
    { name: 'Startup Rejects', category: 'Quality', value: 0.8, color: '#a78bfa', width: 2.4 },
    { name: 'Prod. Rejects', category: 'Quality', value: 0.7, color: '#8b5cf6', width: 2.1 }
  ])
  console.log('Seeded Losses')

  // ── Alerts ────────────────────────────────────────────────────
  await Alert.insertMany([
    { severity: 'CRITICAL', color: 'border-red-500', bg: 'bg-red-950/20', text: 'text-red-200', title: '🚨 Sorting & Cleaning — Breakdown', description: 'OEE:39.2% Avail:52%', equipment: 'Sorting & Cleaning', acknowledged: false, timestamp: new Date() },
    { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ Feeding / Material Handling — Low OEE (64.9%)', description: 'Avail:86% Perf:76% Qual:100%', equipment: 'Feeding / Material Handling', acknowledged: false, timestamp: new Date() },
    { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Inbound & Storage — Status Update', description: 'Status:stopped OEE:78.1% Good:750/751', equipment: 'Inbound & Storage', acknowledged: true, timestamp: new Date() },
    { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ QC & Dispatch — Low OEE (60.2%)', description: 'Avail:93% Perf:65% Qual:100%', equipment: 'QC & Dispatch', acknowledged: false, timestamp: new Date() },
    { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '🧪 Sorting & Cleaning — Quality below 95% (93%)', description: 'Scrap:28 units', equipment: 'Sorting & Cleaning', acknowledged: false, timestamp: new Date() },
    { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Packaging — Status Update', description: 'Status:stopped OEE:81.1% Good:778/779', equipment: 'Packaging', acknowledged: true, timestamp: new Date() }
  ])
  console.log('Seeded Alerts')

  // ── Equipment ─────────────────────────────────────────────────
  await Equipment.insertMany([
    { equipmentId: 'EQ001', name: 'Line A - Assembly', status: 'stopped', efficiency: 92.5, lastMaintenance: new Date('2026-05-28'), nextMaintenance: new Date('2026-06-15') },
    { equipmentId: 'EQ002', name: 'Line B - Welding', status: 'warning', efficiency: 78.2, lastMaintenance: new Date('2026-05-20'), nextMaintenance: new Date('2026-06-10') },
    { equipmentId: 'EQ003', name: 'Line C - Painting', status: 'stopped', efficiency: 85.0, lastMaintenance: new Date('2026-06-01'), nextMaintenance: new Date('2026-06-20') },
    { equipmentId: 'EQ004', name: 'Line D - Packaging', status: 'stopped', efficiency: 88.3, lastMaintenance: new Date('2026-05-25'), nextMaintenance: new Date('2026-06-12') },
    { equipmentId: 'EQ005', name: 'Line E - Testing', status: 'stopped', efficiency: 0, lastMaintenance: new Date('2026-05-15'), nextMaintenance: new Date('2026-06-08') }
  ])
  console.log('Seeded Equipment')

  // ── Quality Data ──────────────────────────────────────────────
  await QualityData.create({
    current: 96.8,
    totalProduced: 12450,
    defectCount: 398,
    reworkCount: 120,
    defectBreakdown: [
      { type: 'Dimensional', count: 145, percentage: 36.4 },
      { type: 'Surface', count: 98, percentage: 24.6 },
      { type: 'Assembly', count: 87, percentage: 21.9 },
      { type: 'Material', count: 68, percentage: 17.1 }
    ],
    trend: [
      { date: 'Mon', quality: 95.2 },
      { date: 'Tue', quality: 96.1 },
      { date: 'Wed', quality: 94.8 },
      { date: 'Thu', quality: 97.5 },
      { date: 'Fri', quality: 96.8 },
      { date: 'Sat', quality: 98.2 },
      { date: 'Sun', quality: 97.0 }
    ]
  })
  console.log('Seeded Quality Data')

  // ── OEE History ───────────────────────────────────────────────
  await OEEHistory.insertMany([
    { timestamp: new Date(), machine: 'Inbound & Storage', line: 'A', oee: 78.1, availability: 99, performance: 79, quality: 100, goodUnits: 750, totalUnits: 751, status: 'stopped' },
    { timestamp: new Date(), machine: 'Feeding / Material Handling', line: 'A', oee: 64.9, availability: 86, performance: 76, quality: 100, goodUnits: 623, totalUnits: 625, status: 'stopped' },
    { timestamp: new Date(), machine: 'Sorting & Cleaning', line: 'B', oee: 39.2, availability: 52, performance: 81, quality: 93, goodUnits: 377, totalUnits: 405, status: 'stopped' },
    { timestamp: new Date(), machine: 'Packaging', line: 'B', oee: 81.1, availability: 99, performance: 82, quality: 100, goodUnits: 778, totalUnits: 779, status: 'stopped' },
    { timestamp: new Date(), machine: 'QC & Dispatch', line: 'C', oee: 60.2, availability: 93, performance: 65, quality: 100, goodUnits: 578, totalUnits: 579, status: 'stopped' },
  ])
  console.log('Seeded OEE History')

  // ── Production Entry ────────────────────────────────────────────
  await ProductionEntry.create({
    date: new Date(),
    shift: 'Shift 1',
    line: 'A',
    product: 'สินค้า1',
    timeRange: '6 AM - 2 PM',
    received: 100,
    target: 95,
    actualBags: 19,
    bagSize: 5,
    cleaningTime: '00:30',
    startMinutes: 360,
    endMinutes: 840,
    operator: 'Admin',
    notes: 'ตัวอย่างรายการผลิต'
  })
  console.log('Seeded Production Entry')

  // ── Data Entry ─────────────────────────────────────────────────
  await DataEntry.create({
    date: new Date(),
    shift: 'Shift 1',
    line: 'A',
    machine: 'Inbound & Storage',
    actualProduction: 750,
    targetProduction: 800,
    downtimeMinutes: 30,
    scrapUnits: 1,
    operator: 'Admin',
    notes: 'บันทึกข้อมูลตัวอย่าง'
  })
  console.log('Seeded Data Entry')

  // ── Downtime Event ─────────────────────────────────────────────
  await DowntimeEvent.create({
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(),
    machine: 'Sorting & Cleaning',
    line: 'B',
    reason: 'Mechanical failure',
    category: 'Unplanned',
    description: 'เครื่องหยุดทำงานเนื่องจากขัดข้องทางกล',
    reportedBy: 'Admin',
    resolved: false
  })
  console.log('Seeded Downtime Event')

  // ── Machine Status Log ─────────────────────────────────────────
  await MachineStatusLog.create({
    machine: 'Inbound & Storage',
    line: 'A',
    oldStatus: 'stopped',
    newStatus: 'running',
    changedAt: new Date(),
    changedBy: 'Admin',
    reason: 'เริ่มการผลิตกะที่ 1'
  })
  console.log('Seeded Machine Status Log')

  // ── Quality Record ───────────────────────────────────────────────
  await QualityRecord.create({
    shift: 'Shift 1',
    line: 'A',
    product: 'สินค้า1',
    produced: 100,
    good: 99,
    defect: 1,
    rework: 0,
    quality: 99.0,
    defectBreakdown: [
      { type: 'Surface', count: 1, percentage: 1.0 }
    ],
    inspectedBy: 'Admin',
    inspectedAt: new Date()
  })
  console.log('Seeded Quality Record')

  // ── Maintenance Record ───────────────────────────────────────────
  await MaintenanceRecord.create({
    equipment: 'Line A - Assembly',
    type: 'Preventive',
    date: new Date(Date.now() - 86400000),
    durationHours: 1,
    cost: 0,
    parts: [],
    technician: 'Admin',
    description: 'บำรุงรักษาตัวอย่าง',
    nextSchedule: new Date(Date.now() + 30 * 86400000),
    completed: true
  })
  console.log('Seeded Maintenance Record')

  console.log('\n✅ Database seeded successfully!')
  process.exit(0)
}

seedData().catch(err => {
  console.error('❌ Seed error:', err)
  process.exit(1)
})
