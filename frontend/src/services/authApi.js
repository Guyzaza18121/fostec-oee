const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const SIM_MODE = import.meta.env.VITE_SIMULATION_MODE === 'true'

const TOKEN_KEY = 'fostec_token'
const USER_KEY = 'fostec_user'

const mockUsers = [
  { id: 'm1', un: 'admin', name: 'Admin', role: 'ADMIN', pw: 'admin123', on: true, avatar: null, lastLogin: null },
  { id: 'm2', un: 'engineer', name: 'Engineer', role: 'ENGINEER', pw: 'eng123', on: true, avatar: null, lastLogin: null },
  { id: 'm3', un: 'operator', name: 'Operator', role: 'OPERATOR', pw: 'op123', on: true, avatar: null, lastLogin: null },
  { id: 'm4', un: 'viewer', name: 'Viewer', role: 'VIEWER', pw: 'view123', on: true, avatar: null, lastLogin: null },
]

export const ROLES = {
  ADMIN: 'ADMIN',
  ENGINEER: 'ENGINEER',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
}

export const PERMS = {
  ADMIN: ['CONTROL', 'SETTINGS', 'USER_MANAGE', 'DELETE'],
  ENGINEER: ['CONTROL', 'SETTINGS', 'DELETE'],
  OPERATOR: ['CONTROL'],
  VIEWER: [],
}

export const hasPerm = (user, perm) => {
  if (!user || !user.role) return false
  return PERMS[user.role]?.includes(perm) || false
}

export const hasAnyPerm = (user, perms) => {
  if (!user || !user.role) return false
  return perms.some((p) => PERMS[user.role]?.includes(p))
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

async function fetchJson(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearToken()
    throw new Error('SESSION_EXPIRED')
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `API error ${response.status}`)
  }

  return response.json()
}

export const authApi = {
  login: async (un, pw) => {
    if (SIM_MODE) {
      const user = mockUsers.find((u) => u.un === un && u.pw === pw)
      if (!user) {
        throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      }
      const safeUser = { ...user }
      delete safeUser.pw
      const fakeToken = btoa(JSON.stringify({ id: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 }))
      setToken(fakeToken)
      setUser(safeUser)
      return { token: fakeToken, user: safeUser }
    }
    const res = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ un, pw }),
    })
    if (res.success && res.token) {
      setToken(res.token)
      setUser(res.user)
    }
    return res
  },

  logout: async () => {
    if (!SIM_MODE) {
      try {
        await fetchJson('/auth/logout', { method: 'POST' })
      } catch (err) {
        console.warn('Logout API failed:', err.message)
      }
    }
    clearToken()
    return { success: true }
  },

  getUsers: async () => {
    if (SIM_MODE) {
      return { success: true, data: mockUsers.map((u) => ({ ...u, pw: undefined })) }
    }
    return fetchJson('/users')
  },

  createUser: async (data) => {
    if (SIM_MODE) {
      const newUser = { id: `m${Date.now()}`, ...data, on: true, lastLogin: null }
      mockUsers.push(newUser)
      return { success: true, data: newUser }
    }
    return fetchJson('/users', { method: 'POST', body: JSON.stringify(data) })
  },

  updateUser: async (id, data) => {
    if (SIM_MODE) {
      const idx = mockUsers.findIndex((u) => u.id === id)
      if (idx >= 0) {
        mockUsers[idx] = { ...mockUsers[idx], ...data }
        return { success: true, data: mockUsers[idx] }
      }
      throw new Error('User not found')
    }
    return fetchJson(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },

  removeUser: async (id) => {
    if (SIM_MODE) {
      const idx = mockUsers.findIndex((u) => u.id === id)
      if (idx >= 0) {
        mockUsers[idx].on = false
        return { success: true }
      }
      throw new Error('User not found')
    }
    return fetchJson(`/users/${id}`, { method: 'DELETE' })
  },
}

export { clearToken, setUser, getToken, setToken }
