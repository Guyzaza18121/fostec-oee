const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function getToken() {
  return localStorage.getItem('fostec_token')
}

async function fetchJson(url, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  })
  if (response.status === 401) {
    localStorage.removeItem('fostec_token')
    localStorage.removeItem('fostec_user')
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('SESSION_EXPIRED')
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export const api = {
  getSummary: () => fetchJson('/oee/summary'),
  getAvailability: () => fetchJson('/oee/availability'),
  getQuality: () => fetchJson('/oee/quality'),
  getEquipment: () => fetchJson('/oee/equipment'),
  getAlerts: () => fetchJson('/oee/alerts'),
  getMachines: () => fetchJson('/oee/machines'),
  getNodeRedDashboard: () => fetchJson('/oee/node-red-dashboard', { cache: 'no-store' }),
  getLoadcellInHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/loadcell-in/history${qs ? '?' + qs : ''}`, { cache: 'no-store' })
  },
  getLosses: () => fetchJson('/oee/losses'),
  getShifts: () => fetchJson('/oee/shifts'),
  createShift: (data) => fetchJson('/oee/shifts', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateShift: (id, data) => fetchJson(`/oee/shifts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteShift: (id) => fetchJson(`/oee/shifts/${id}`, {
    method: 'DELETE'
  }),
  updateMachine: (name, data) => fetchJson(`/oee/machines/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  createAlert: (data) => fetchJson('/oee/alerts', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  clearAlerts: () => fetchJson('/oee/alerts', {
    method: 'DELETE'
  }),
  acknowledgeAlert: (id) => fetchJson(`/oee/alerts/${id}/acknowledge`, {
    method: 'PATCH'
  }),
  postDataEntry: (data) => fetchJson('/oee/data-entry', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // OEE History
  getOEEHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/history${qs ? '?' + qs : ''}`)
  },
  getOEEHistorySummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/history/summary${qs ? '?' + qs : ''}`)
  },
  createOEEHistory: (data) => fetchJson('/oee/history', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Production Entries
  getProductionEntries: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/production-entries${qs ? '?' + qs : ''}`)
  },
  createProductionEntry: (data) => fetchJson('/oee/production-entries', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProductionEntry: (id, data) => fetchJson(`/oee/production-entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProductionEntry: (id) => fetchJson(`/oee/production-entries/${id}`, {
    method: 'DELETE'
  }),

  // Operator Data Entries
  getDataEntries: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/data-entries${qs ? '?' + qs : ''}`)
  },
  createDataEntry: (data) => fetchJson('/oee/data-entries', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Downtime Events
  getDowntimeEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/downtime${qs ? '?' + qs : ''}`)
  },
  createDowntimeEvent: (data) => fetchJson('/oee/downtime', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  resolveDowntimeEvent: (id, data = {}) => fetchJson(`/oee/downtime/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  // Machine Status Logs
  getMachineStatusLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/machine-status-logs${qs ? '?' + qs : ''}`)
  },
  createMachineStatusLog: (data) => fetchJson('/oee/machine-status-logs', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Quality Records
  getQualityRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/quality-records${qs ? '?' + qs : ''}`)
  },
  createQualityRecord: (data) => fetchJson('/oee/quality-records', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Maintenance Records
  getMaintenanceRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/maintenance${qs ? '?' + qs : ''}`)
  },
  createMaintenanceRecord: (data) => fetchJson('/oee/maintenance', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateMaintenanceRecord: (id, data) => fetchJson(`/oee/maintenance/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteMaintenanceRecord: (id) => fetchJson(`/oee/maintenance/${id}`, {
    method: 'DELETE'
  }),

  // Product Types
  getProductTypes: () => fetchJson('/oee/product-types'),
  createProductType: (data) => fetchJson('/oee/product-types', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteProductType: (id) => fetchJson(`/oee/product-types/${id}`, {
    method: 'DELETE'
  }),

  // Material Receipts (รับวัตถุดิบ)
  getMaterialReceipts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/material-receipts${qs ? '?' + qs : ''}`)
  },
  createMaterialReceipt: (data) => fetchJson('/oee/material-receipts', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteMaterialReceipt: (id) => fetchJson(`/oee/material-receipts/${id}`, {
    method: 'DELETE'
  }),

  // Material Withdraws (เบิกวัตถุดิบ)
  getMaterialWithdraws: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/material-withdraws${qs ? '?' + qs : ''}`)
  },
  createMaterialWithdraw: (data) => fetchJson('/oee/material-withdraws', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteMaterialWithdraw: (id) => fetchJson(`/oee/material-withdraws/${id}`, {
    method: 'DELETE'
  }),

  // Silo Settings (จัดเก็บในไซโล)
  getSiloSettings: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJson(`/oee/silo-settings${qs ? '?' + qs : ''}`)
  },
  createSiloSetting: (data) => fetchJson('/oee/silo-settings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteSiloSetting: (id) => fetchJson(`/oee/silo-settings/${id}`, {
    method: 'DELETE'
  }),

  // Material Stock Summary (คงเหลือรวม)
  getMaterialStock: () => fetchJson('/oee/material-stock'),

  // Bulk clear stock data (admin only)
  clearStockData: () => fetchJson('/oee/clear-stock-data', { method: 'DELETE' }),
}
