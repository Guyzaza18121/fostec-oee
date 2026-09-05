import { Component, Suspense, lazy, useState, useEffect } from 'react'
import Layout from './components/Layout'
import { getStoredUser, authApi, hasAnyPerm } from './services/authApi.js'
import { Navigate, useLocation } from './router.jsx'

const USER_UPDATED_EVENT = 'auth:user-updated'

const Login = lazy(() => import('./pages/Login'))
const Overview = lazy(() => import('./pages/Overview'))
const Process = lazy(() => import('./pages/Process'))
const Process1 = lazy(() => import('./pages/Process1'))
const ProcessDetail = lazy(() => import('./pages/ProcessDetail'))
const OEEMetrics = lazy(() => import('./pages/OEEMetrics'))
const Analytics = lazy(() => import('./pages/Analytics'))
const DataEntry = lazy(() => import('./pages/DataEntry'))
const Alerts = lazy(() => import('./pages/Alerts'))
const LineDashboard = lazy(() => import('./pages/LineDashboard'))
const UserSettings = lazy(() => import('./pages/UserSettings'))
const DataCenter = lazy(() => import('./pages/DataCenter'))
const Settings = lazy(() => import('./pages/Settings'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Logs = lazy(() => import('./pages/Logs'))
const DataRange = lazy(() => import('./pages/DataRange'))
const DataExport = lazy(() => import('./pages/DataExport'))
const DataReceipts = lazy(() => import('./pages/DataReceipts'))
const Stock = lazy(() => import('./pages/Stock'))

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    console.error('App Error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-bg-card text-slate-200">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-4">Please refresh the page to continue.</p>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold hover:bg-sky-500 transition-colors">
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ user, children, perms = [] }) {
  if (!user) return <Navigate to="/login" replace />
  if (perms.length > 0 && !hasAnyPerm(user, perms)) {
    return <Navigate to="/" replace />
  }
  return children
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-card text-sm font-semibold text-slate-300">
      Loading...
    </div>
  )
}

const redirects = {
  '/availability': '/oee-metrics#availability',
  '/performance': '/oee-metrics#performance',
  '/quality': '/oee-metrics#quality',
}

const routes = {
  '/': { element: <Overview /> },
  '/overview': { element: <Overview /> },
  '/equipment': { element: <Process /> },
  '/process': { element: <Process /> },
  '/process/1': { element: <Process1 /> },
  '/process/2': { element: <ProcessDetail processId="2" /> },
  '/process/3': { element: <ProcessDetail processId="3" /> },
  '/process/4': { element: <ProcessDetail processId="4" /> },
  '/process/5': { element: <ProcessDetail processId="5" /> },
  '/process/6': { element: <ProcessDetail processId="6" /> },
  '/oee-metrics': { element: <OEEMetrics /> },
  '/analytics': { element: <Analytics /> },
  '/alerts': { element: <Alerts /> },
  '/data-entry': { element: <DataEntry /> },
  '/line-dashboard': { element: <LineDashboard /> },
  '/user-settings': { element: <UserSettings /> },
  '/data/history': { element: <DataCenter /> },
  '/data/range': { element: <DataRange /> },
  '/data/receipts': { element: <DataReceipts /> },
  '/data/export': { element: <DataExport /> },
  '/stock': { element: <Stock /> },
  '/settings': { element: <Settings />, perms: ['SETTINGS'] },
  '/user-management': { element: <UserManagement />, perms: ['USER_MANAGE'] },
  '/logs': { element: <Logs />, perms: ['SETTINGS'] },
}

function AppRoutes() {
  const [user, setUser] = useState(() => getStoredUser())
  const location = useLocation()

  useEffect(() => {
    const stored = getStoredUser()
    if (stored) setUser(stored)
  }, [location.pathname])

  useEffect(() => {
    const handleUserUpdated = (event) => {
      setUser(event.detail || getStoredUser())
    }
    window.addEventListener(USER_UPDATED_EVENT, handleUserUpdated)
    return () => window.removeEventListener(USER_UPDATED_EVENT, handleUserUpdated)
  }, [])

  const handleLogout = async () => {
    await authApi.logout()
    setUser(null)
  }

  const redirectTo = redirects[location.pathname]
  const matchedRoute = routes[location.pathname] || routes['/']

  if (location.pathname === '/login') {
    return (
      <Suspense fallback={<RouteFallback />}>
        {user ? <Navigate to="/" replace /> : <Login />}
      </Suspense>
    )
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Layout user={user} onLogout={handleLogout}>
        <ProtectedRoute user={user} perms={matchedRoute.perms || []}>
          {matchedRoute.element}
        </ProtectedRoute>
      </Layout>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}

export default App
