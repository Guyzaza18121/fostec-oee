import { useEffect, useState } from 'react'
import { NavLink } from '../router.jsx'
import PropTypes from 'prop-types'
import { hasAnyPerm } from '../services/authApi.js'
import {
  LayoutDashboard, Factory, Gauge, LineChart, Bell,
  CalendarDays, Settings, CalendarClock, Users, LogOut, ChevronDown, Menu, X,
  ScrollText, Download,
} from 'lucide-react'
import { getProcessTheme } from '../utils/processTheme.js'

const overviewMenu = { path: '/', label: 'Overview', icon: LayoutDashboard, color: 'text-sky-400' }
const oeeMetricsMenu = { path: '/oee-metrics', label: 'OEE Metrics', icon: Gauge, color: 'text-amber-400' }

const processSubmenu = [
  { path: '/process/1', label: 'Input Stock', icon: Factory, color: getProcessTheme(1).navIcon, navSubActive: getProcessTheme(1).navSubActive },
  { path: '/process/2', label: 'Loadcell IN', icon: Factory, color: getProcessTheme(2).navIcon, navSubActive: getProcessTheme(2).navSubActive },
  { path: '/process/3', label: 'Sorting & Cleaning', icon: Factory, color: getProcessTheme(3).navIcon, navSubActive: getProcessTheme(3).navSubActive },
  { path: '/process/4', label: 'Loadcell OUT', icon: Factory, color: getProcessTheme(4).navIcon, navSubActive: getProcessTheme(4).navSubActive },
  { path: '/process/5', label: 'Packaging', icon: Factory, color: getProcessTheme(5).navIcon, navSubActive: getProcessTheme(5).navSubActive },
  { path: '/process/6', label: 'QC & Stock', icon: Factory, color: getProcessTheme(6).navIcon, navSubActive: getProcessTheme(6).navSubActive },
]

const productionPlanMenu = [
  { path: '/settings', label: 'Production Plan', icon: CalendarClock, color: 'text-orange-400', perms: ['SETTINGS'] },
]

const reportExportSubmenu = [
  { path: '/analytics', label: 'Reports', icon: LineChart, color: 'text-violet-400' },
  { path: '/data/history', label: 'ข้อมูลย้อนหลัง', icon: CalendarDays, color: 'text-sky-400' },
  { path: '/data/range', label: 'ดูตามช่วงเวลา', icon: CalendarClock, color: 'text-emerald-400' },
  { path: '/data/export', label: 'Export ข้อมูล', icon: Download, color: 'text-amber-400' },
]

const alarmLogSubmenu = [
  { path: '/alerts', label: 'Alarms', icon: Bell, color: 'text-rose-400' },
  { path: '/logs', label: 'System Log', icon: ScrollText, color: 'text-cyan-400', perms: ['SETTINGS'] },
]

const usersSettingSubmenu = [
  { path: '/user-settings', label: 'ตั้งค่าผู้ใช้งาน', icon: Settings, color: 'text-amber-400' },
  { path: '/user-management', label: 'เพิ่มผู้ใช้งาน และกำหนดสิทธิ', icon: Users, color: 'text-fuchsia-400', perms: ['USER_MANAGE'] },
]

function MenuItem({ item, collapsed, onCloseMobile }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onCloseMobile}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center rounded-lg text-[12px] font-medium transition-all duration-200 ${
          collapsed ? 'lg:justify-center lg:px-2 lg:py-3' : 'px-3 py-2.5'
        } ${
          isActive
            ? 'border border-blue-500/35 bg-gradient-to-r from-blue-500/15 to-bg-panel/60 text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] before:absolute before:left-0 before:top-1/2 before:h-8 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-gradient-to-b before:from-sky-400 before:to-indigo-500'
            : 'border border-transparent text-slate-400 hover:bg-bg-panel/55 hover:text-slate-100'
        }`
      }
    >
      <Icon size={18} strokeWidth={2} className={`shrink-0 ${item.color}`} />
      <span className={`flex-1 ml-3 transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
    </NavLink>
  )
}

function SubmenuItem({ item, onCloseMobile }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      onClick={onCloseMobile}
      className={({ isActive }) =>
        `flex items-center rounded-lg px-3 py-2 text-[11px] font-medium transition ${
          isActive
            ? 'bg-bg-panel/80 text-white'
            : 'text-slate-400 hover:bg-bg-panel/55 hover:text-slate-100'
        }`
      }
    >
      <Icon size={15} strokeWidth={2} className={`shrink-0 ${item.color}`} />
      <span className="flex-1 ml-2">{item.label}</span>
    </NavLink>
  )
}

function DropdownSection({ label, icon: Icon, iconClass, open, onToggle, items, parentPath, collapsed, onCloseMobile }) {
  if (!items.length) return null

  return (
    <div className={`${collapsed ? 'lg:hidden' : ''}`}>
      <div className="flex w-full items-center rounded-lg text-[12px] font-medium text-slate-400 transition-all duration-200 hover:bg-bg-panel/55 hover:text-slate-100">
        {parentPath ? (
          <NavLink
            to={parentPath}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              `flex items-center flex-1 px-3 py-2.5 transition-colors ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} className={`shrink-0 ${iconClass}`} />
            <span className="flex-1 ml-3 text-left">{label}</span>
          </NavLink>
        ) : (
          <button
            onClick={onToggle}
            className="flex flex-1 items-center px-3 py-2.5 text-left transition-colors"
          >
            <Icon size={18} strokeWidth={2} className={`shrink-0 ${iconClass}`} />
            <span className="flex-1 ml-3">{label}</span>
          </button>
        )}
        <button onClick={onToggle} className="px-3 py-2.5 text-slate-400 transition-colors hover:text-slate-100" aria-label={`Toggle ${label}`}>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
        </button>
      </div>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-border/80 pl-3">
          {items.map((item) => (
            <SubmenuItem key={item.path} item={item} onCloseMobile={onCloseMobile} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ user = null, collapsed = false, onToggleCollapse, mobileOpen = false, onCloseMobile, onLogout }) {
  const [processOpen, setProcessOpen] = useState(false)
  const [reportExportOpen, setReportExportOpen] = useState(false)
  const [alarmLogOpen, setAlarmLogOpen] = useState(false)
  const [usersSettingOpen, setUsersSettingOpen] = useState(false)

  useEffect(() => {
    if (!collapsed) return
    setProcessOpen(false)
    setReportExportOpen(false)
    setAlarmLogOpen(false)
    setUsersSettingOpen(false)
  }, [collapsed])

  const canAccess = (item) => !item.perms || hasAnyPerm(user, item.perms)
  const visibleProductionPlan = productionPlanMenu.filter(canAccess)
  const visibleReportExport = reportExportSubmenu.filter(canAccess)
  const visibleAlarmLog = alarmLogSubmenu.filter(canAccess)
  const visibleUsersSetting = usersSettingSubmenu.filter(canAccess)

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onCloseMobile} />
      )}
      <aside className={`fixed lg:fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-border bg-bg-card shadow-[10px_0_34px_rgba(0,0,0,0.22)] transition-all duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        ${collapsed ? 'lg:w-20' : 'lg:w-64'}
        w-64`}>
        <div className={`flex min-h-20 items-center border-b border-border bg-gradient-to-b from-bg-panel/60 to-transparent py-3 ${collapsed ? 'lg:justify-center lg:px-3' : 'justify-between px-5'}`}>
          <div className={`flex items-center ${collapsed ? 'lg:hidden' : ''}`}>
            <img
              src="/Logo-FOSTEC4.png"
              alt="FOSTEC"
              className="h-12 w-52 object-contain transition-all duration-300"
              draggable={false}
            />
          </div>
          <button
            onClick={onToggleCollapse}
            className="ml-2 hidden items-center justify-center rounded-xl bg-bg-panel/70 p-2 text-slate-400 shadow-lg shadow-black/30 transition-all duration-200 hover:border hover:border-blue-400/40 hover:text-blue-300 lg:flex"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>
          <button onClick={onCloseMobile} className="rounded-lg bg-bg-panel/80 p-2 text-slate-400 transition-colors hover:text-red-300 lg:hidden">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-1.5">
            <div className={`px-3 pb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${collapsed ? 'lg:hidden' : ''}`}>Dashboard</div>
            <MenuItem item={overviewMenu} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            <MenuItem item={oeeMetricsMenu} collapsed={collapsed} onCloseMobile={onCloseMobile} />

            <DropdownSection
              label="Process"
              icon={Factory}
              iconClass="text-blue-400"
              open={processOpen}
              onToggle={() => setProcessOpen(!processOpen)}
              items={processSubmenu}
              parentPath="/process"
              collapsed={collapsed}
              onCloseMobile={onCloseMobile}
            />

            {visibleProductionPlan.map((item) => (
              <MenuItem key={item.path} item={item} collapsed={collapsed} onCloseMobile={onCloseMobile} />
            ))}

            <DropdownSection
              label="Report & Export"
              icon={LineChart}
              iconClass="text-violet-400"
              open={reportExportOpen}
              onToggle={() => setReportExportOpen(!reportExportOpen)}
              items={visibleReportExport}
              collapsed={collapsed}
              onCloseMobile={onCloseMobile}
            />

            <DropdownSection
              label="Alarm & System Log"
              icon={Bell}
              iconClass="text-rose-400"
              open={alarmLogOpen}
              onToggle={() => setAlarmLogOpen(!alarmLogOpen)}
              items={visibleAlarmLog}
              collapsed={collapsed}
              onCloseMobile={onCloseMobile}
            />

            <DropdownSection
              label="Users Setting"
              icon={Settings}
              iconClass="text-amber-400"
              open={usersSettingOpen}
              onToggle={() => setUsersSettingOpen(!usersSettingOpen)}
              items={visibleUsersSetting}
              collapsed={collapsed}
              onCloseMobile={onCloseMobile}
            />
          </div>
        </nav>

        <div className="mt-2 border-t border-border p-4">
          <button
            onClick={onLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex w-full items-center rounded-lg border border-red-500/20 bg-red-500/10 text-[12px] font-medium text-red-300 transition-all duration-200 hover:bg-red-500/15 ${collapsed ? 'lg:justify-center lg:px-2 lg:py-3' : 'px-3 py-2.5'}`}
          >
            <LogOut size={18} strokeWidth={2} className="shrink-0 text-red-400" />
            <span className={`flex-1 ml-3 text-left transition-opacity duration-200 ${collapsed ? 'lg:hidden' : ''}`}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

const menuItemShape = PropTypes.shape({
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  navActive: PropTypes.string,
  navSubActive: PropTypes.string,
  perms: PropTypes.arrayOf(PropTypes.string),
})

MenuItem.propTypes = {
  item: menuItemShape.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onCloseMobile: PropTypes.func.isRequired,
}

SubmenuItem.propTypes = {
  item: menuItemShape.isRequired,
  onCloseMobile: PropTypes.func.isRequired,
}

DropdownSection.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  iconClass: PropTypes.string.isRequired,
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  items: PropTypes.arrayOf(menuItemShape).isRequired,
  parentPath: PropTypes.string,
  collapsed: PropTypes.bool.isRequired,
  onCloseMobile: PropTypes.func.isRequired,
}

Sidebar.propTypes = {
  user: PropTypes.object,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func.isRequired,
  mobileOpen: PropTypes.bool,
  onCloseMobile: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
}
