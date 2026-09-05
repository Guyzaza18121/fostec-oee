import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { SidebarContext } from '../context/SidebarContext'

import PropTypes from 'prop-types'

export default function Layout({ user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-[100dvh]">
        <Sidebar user={user} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onLogout={onLogout} />
        <div className={`flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <Navbar onMenuToggle={() => setMobileOpen(!mobileOpen)} collapsed={collapsed} user={user} onLogout={onLogout} />
          <main className="flex-1 overflow-auto p-3 lg:p-5 2xl:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}

Layout.propTypes = {
  user: PropTypes.object,
  onLogout: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
}
