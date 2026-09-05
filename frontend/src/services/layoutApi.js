const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const LAYOUT_URL = `${BASE_URL}/oee/layout`

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

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })
  if (res.status === 401) {
    handleUnauthorized()
    return null
  }
  if (!res.ok) throw new Error(`Layout API failed: ${res.status}`)
  const json = await res.json()
  return json.success ? json.data : null
}

export async function getLayout() {
  return fetchJson(LAYOUT_URL)
}

export async function saveLayout(layoutPatch) {
  return fetchJson(LAYOUT_URL, {
    method: 'POST',
    body: JSON.stringify(layoutPatch),
  })
}
