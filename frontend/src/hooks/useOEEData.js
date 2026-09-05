import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api.js'
import { getPublicRuntime } from '../utils/machineTime.js'

const defaultTopMetrics = [
  { title: 'Overall OEE', value: 64.7, color: '#22d3ee', target: 85, label: '↓ Below Target · Target 85%', sparkColor: '#22d3ee' },
  { title: 'Availability', value: 85.7, color: '#22c55e', target: 85, label: 'Downtime 344m / Planned 2400m', sparkColor: '#22c55e' },
  { title: 'Performance', value: 76.6, color: '#f59e0b', target: 85, label: 'Output 3,139 units', sparkColor: '#f59e0b' },
  { title: 'Quality / FPY', value: 98.5, color: '#a78bfa', target: 85, label: 'Good 3,106 · Scrap 33', sparkColor: '#a78bfa' }
]

const defaultMachines = [
  { name: 'Inbound & Storage', line: 'A', oee: 78.1, avail: 99, perf: 79, qual: 100, good: 750, total: 751, scrap: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
  { name: 'Feeding / Material Handling', line: 'A', oee: 64.9, avail: 86, perf: 76, qual: 100, good: 623, total: 625, scrap: 2, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
  { name: 'Sorting & Cleaning', line: 'B', oee: 39.2, avail: 52, perf: 81, qual: 93, good: 377, total: 405, scrap: 28, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' },
  { name: 'Packaging', line: 'B', oee: 81.1, avail: 99, perf: 82, qual: 100, good: 778, total: 779, scrap: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fcd34d' },
  { name: 'QC & Dispatch', line: 'C', oee: 60.2, avail: 93, perf: 65, qual: 100, good: 578, total: 579, scrap: 1, status: 'stopped', runTime: 0, totalTime: 480, workingTimeMinutes: 0, stopTimeMinutes: 480, borderColor: 'rgba(239,68,68,0.5)', bgColor: 'rgba(239,68,68,0.25)', shadow: 'rgba(239,68,68,0.3)', oeeColor: '#fca5a5' }
]

const defaultLosses = [
  { name: 'Breakdowns', category: 'Availability', value: 5.4, color: '#ef4444', width: 16.2 },
  { name: 'Changeover', category: 'Availability', value: 3.7, color: '#f97316', width: 11.1 },
  { name: 'Small Stops', category: 'Performance', value: 12.9, color: '#f59e0b', width: 38.7 },
  { name: 'Reduced Speed', category: 'Performance', value: 10.5, color: '#eab308', width: 31.5 },
  { name: 'Startup Rejects', category: 'Quality', value: 0.8, color: '#a78bfa', width: 2.4 },
  { name: 'Prod. Rejects', category: 'Quality', value: 0.7, color: '#8b5cf6', width: 2.1 }
]

const defaultAlerts = [
  { severity: 'CRITICAL', color: 'border-red-500', bg: 'bg-red-950/20', text: 'text-red-200', title: '🚨 Sorting & Cleaning — Breakdown', desc: 'OEE:39.2% Avail:52%', timestamp: null },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ Feeding / Material Handling — Low OEE (64.9%)', desc: 'Avail:86% Perf:76% Qual:100%', timestamp: null },
  { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Inbound & Storage — Status Update', desc: 'Status:stopped OEE:78.1% Good:750/751', timestamp: null },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '⚠️ QC & Dispatch — Low OEE (60.2%)', desc: 'Avail:93% Perf:65% Qual:100%', timestamp: null },
  { severity: 'WARNING', color: 'border-amber-400', bg: 'bg-amber-950/10', text: 'text-amber-200', title: '🧪 Sorting & Cleaning — Quality below 95% (93%)', desc: 'Scrap:28 units', timestamp: null },
  { severity: 'INFO', color: 'border-sky-400', bg: 'bg-sky-950/10', text: 'text-sky-200', title: 'ℹ️ Packaging — Status Update', desc: 'Status:stopped OEE:81.1% Good:778/779', timestamp: null }
]

function round1(n) { return Math.round(n * 10) / 10 }

function statusOrStopped(status) {
  return String(status || '').trim() || 'stopped'
}

function statusVisuals(status) {
  const value = statusOrStopped(status).toLowerCase()
  if (value === 'running') {
    return {
      borderColor: 'rgba(34,197,94,0.5)',
      bgColor: 'rgba(34,197,94,0.25)',
      shadow: 'rgba(34,197,94,0.3)',
    }
  }
  if (value === 'warning' || value === 'idle') {
    return {
      borderColor: 'rgba(245,158,11,0.5)',
      bgColor: 'rgba(245,158,11,0.2)',
      shadow: 'rgba(245,158,11,0.25)',
    }
  }
  return {
    borderColor: 'rgba(239,68,68,0.5)',
    bgColor: 'rgba(239,68,68,0.25)',
    shadow: 'rgba(239,68,68,0.3)',
  }
}

function mapMachine(m) {
  const status = statusOrStopped(m.status)
  const visuals = statusVisuals(status)
  const runtime = getPublicRuntime(m)
  return {
    name: m.name,
    line: m.line,
    oee: m.oee ?? round1((m.availability ?? m.avail ?? 0) * (m.performance ?? m.perf ?? 0) * (m.quality ?? m.qual ?? 0) / 10000),
    avail: m.availability ?? m.avail ?? 0,
    perf: m.performance ?? m.perf ?? 0,
    qual: m.quality ?? m.qual ?? 0,
    good: m.goodUnits ?? m.good ?? 0,
    total: m.totalUnits ?? m.total ?? 0,
    scrap: m.scrapUnits ?? m.scrap ?? 0,
    status,
    ...runtime,
    borderColor: visuals.borderColor,
    bgColor: visuals.bgColor,
    shadow: visuals.shadow,
    oeeColor: m.oeeColor || '#fcd34d',
  }
}

function mapStoppedFallbackMachine(machine) {
  const totalTime = machine.totalTime ?? machine.workingTimeMinutes ?? machine.runTime ?? 0
  return mapMachine({
    ...machine,
    status: 'stopped',
    runTime: 0,
    workingTimeMinutes: 0,
    stopTimeMinutes: totalTime,
    borderColor: undefined,
    bgColor: undefined,
    shadow: undefined,
  })
}

function mapAlert(a) {
  return {
    severity: a.severity || 'INFO',
    color: a.color || 'border-sky-400',
    bg: a.bg || 'bg-sky-950/10',
    text: a.text || 'text-sky-200',
    title: a.title || '',
    desc: a.desc || '',
    timestamp: a.timestamp || null,
  }
}

function buildTopMetrics(summary, machines) {
  if (summary && summary.oee > 0) {
    return [
      { title: 'Overall OEE', value: round1(summary.oee), color: '#22d3ee', target: 85, label: summary.oee >= 85 ? '✓ On Target · Target 85%' : '↓ Below Target · Target 85%', sparkColor: '#22d3ee' },
      { title: 'Availability', value: round1(summary.availability), color: '#22c55e', target: 85, label: `Downtime ${summary.downtime || 0}m / Planned 2400m`, sparkColor: '#22c55e' },
      { title: 'Performance', value: round1(summary.performance), color: '#f59e0b', target: 85, label: `Output ${machines.reduce((s, m) => s + (m.total ?? 0), 0)} units`, sparkColor: '#f59e0b' },
      { title: 'Quality / FPY', value: round1(summary.quality), color: '#a78bfa', target: 85, label: `Good ${machines.reduce((s, m) => s + (m.good ?? 0), 0)} · Scrap ${machines.reduce((s, m) => s + (m.scrap ?? 0), 0)}`, sparkColor: '#a78bfa' }
    ]
  }
  return defaultTopMetrics
}

export default function useOEEData(pollInterval = 3000) {
  const [data, setData] = useState({
    topMetrics: [],
    machines: [],
    losses: [],
    alerts: []
  })
  const [loading, setLoading] = useState(true)
  const failedCount = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [summaryRes, machinesRes, lossesRes, alertsRes] = await Promise.all([
          api.getSummary(),
          api.getMachines(),
          api.getLosses(),
          api.getAlerts(),
        ])

        if (cancelled) return

        const summary = summaryRes?.data || summaryRes
        const rawMachines = machinesRes?.data || machinesRes || []
        const rawLosses = lossesRes?.data || lossesRes || []
        const rawAlerts = alertsRes?.data || alertsRes || []

        const machines = rawMachines.map(mapMachine)
        const losses = rawLosses.length ? rawLosses : defaultLosses
        const alerts = rawAlerts.length ? rawAlerts.map(mapAlert) : defaultAlerts
        const topMetrics = buildTopMetrics(summary, machines)

        failedCount.current = 0
        setData({ topMetrics, machines, losses, alerts })
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        failedCount.current++
        if (failedCount.current === 1) {
          console.warn('useOEEData: API fetch failed, using fallback data:', err.message)
        }
        setData({
          topMetrics: defaultTopMetrics,
          machines: defaultMachines.map(mapStoppedFallbackMachine),
          losses: defaultLosses,
          alerts: defaultAlerts,
        })
        setLoading(false)
      }
    }

    fetchAll()
    const timer = setInterval(fetchAll, pollInterval)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [pollInterval])

  return { ...data, loading }
}
