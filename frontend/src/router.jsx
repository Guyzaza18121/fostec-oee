import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

const RouterContext = createContext(null)

function readLocation() {
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  }
}

export function navigate(to, { replace = false } = {}) {
  if (!to) return
  const url = new URL(to, window.location.origin)
  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next === current) return
  if (replace) {
    window.history.replaceState(null, '', next)
  } else {
    window.history.pushState(null, '', next)
  }
  window.dispatchEvent(new Event('popstate'))
}

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(() => readLocation())

  useEffect(() => {
    const handleChange = () => setLocation(readLocation())
    window.addEventListener('popstate', handleChange)
    return () => window.removeEventListener('popstate', handleChange)
  }, [])

  const navigateTo = useCallback((to, options = {}) => {
    navigate(to, options)
    setLocation(readLocation())
  }, [])

  const value = useMemo(() => ({ location, navigate: navigateTo }), [location, navigateTo])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useLocation() {
  const context = useContext(RouterContext)
  if (!context) throw new Error('useLocation must be used inside RouterProvider')
  return context.location
}

export function useNavigate() {
  const context = useContext(RouterContext)
  if (!context) throw new Error('useNavigate must be used inside RouterProvider')
  return context.navigate
}

export function Navigate({ to, replace = true }) {
  const navigateTo = useNavigate()
  useEffect(() => {
    navigateTo(to, { replace })
  }, [navigateTo, replace, to])
  return null
}

export function Link({ to, replace = false, onClick, children, ...props }) {
  const navigateTo = useNavigate()
  const href = typeof to === 'string' ? to : '#'

  const handleClick = (event) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      props.target
    ) {
      return
    }
    event.preventDefault()
    navigateTo(href, { replace })
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

export function NavLink({ to, end = false, className, children, ...props }) {
  const location = useLocation()
  const isActive = end
    ? location.pathname === to
    : location.pathname === to || (to !== '/' && location.pathname.startsWith(`${to}/`))
  const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className

  return (
    <Link to={to} className={resolvedClassName} {...props}>
      {typeof children === 'function' ? children({ isActive }) : children}
    </Link>
  )
}

RouterProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

Navigate.propTypes = {
  to: PropTypes.string.isRequired,
  replace: PropTypes.bool,
}

Link.propTypes = {
  to: PropTypes.string.isRequired,
  replace: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node.isRequired,
  target: PropTypes.string,
}

NavLink.propTypes = {
  to: PropTypes.string.isRequired,
  end: PropTypes.bool,
  className: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
}
