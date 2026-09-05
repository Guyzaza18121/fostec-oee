import { createContext, useContext } from 'react'

export const SidebarContext = createContext({ collapsed: false })

export function useSidebar() {
  return useContext(SidebarContext)
}
