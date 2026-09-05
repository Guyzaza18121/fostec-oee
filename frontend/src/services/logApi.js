const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const LOG_URL = `${BASE_URL}/oee/logs`

function getToken() {
  return localStorage.getItem('fostec_token')
}

function clearAuth() {
  localStorage.removeItem('fostec_token')
  localStorage.removeItem('fostec_user')
}

function handleUnauthorized() {
  clearAuth()
  window.location.href = '/login'
}

export async function getLogs(limit = 50) {
  const res = await fetch(`${LOG_URL}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  })
  if (res.status === 401) {
    handleUnauthorized()
    return []
  }
  if (!res.ok) throw new Error(`Fetch logs failed: ${res.status}`)
  const json = await res.json()
  return json.success && Array.isArray(json.data) ? json.data : []
}

export async function createLog({ type = 'DATA', action, detail = '' }) {
  const res = await fetch(LOG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ type, action, detail })
  })
  if (res.status === 401) {
    handleUnauthorized()
    return null
  }
  if (!res.ok) throw new Error(`Create log failed: ${res.status}`)
  const json = await res.json()
  return json.success ? json.data : null
}
