import { useState, useEffect } from 'react'

// Device breakpoints.
// mobile  : < 768px
// tablet  : 768px – 1366px  (covers all iPad portrait/landscape incl. iPad Pro 12.9" landscape)
// desktop : >= 1367px, plus 1280px+ notebook/PC browsers with a fine pointer
// Fine-pointer notebook/PC browsers are detected below so 1366px laptops keep desktop layout.
const TABLET_MIN = 768
const NOTEBOOK_MIN = 1280
const DESKTOP_MIN = 1367

function detect(width, hasDesktopPointer = false) {
  if (width < TABLET_MIN) return 'mobile'
  if (width >= NOTEBOOK_MIN && hasDesktopPointer) return 'desktop'
  if (width < DESKTOP_MIN) return 'tablet'
  return 'desktop'
}

function measure() {
  if (typeof window === 'undefined') return { device: 'desktop', landscape: true }
  const mql = window.matchMedia ? window.matchMedia('(orientation: landscape)') : null
  const pointerMql = window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine), (any-hover: hover) and (any-pointer: fine)')
    : null
  return {
    device: detect(window.innerWidth, pointerMql ? pointerMql.matches : false),
    landscape: mql ? mql.matches : window.innerWidth >= window.innerHeight,
  }
}

export default function useDeviceType() {
  const [state, setState] = useState(measure)

  useEffect(() => {
    const handleResize = () => setState(measure())
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    const mql = window.matchMedia ? window.matchMedia('(orientation: landscape)') : null
    if (mql && mql.addEventListener) {
      mql.addEventListener('change', handleResize)
    }
    handleResize()
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      if (mql && mql.removeEventListener) {
        mql.removeEventListener('change', handleResize)
      }
    }
  }, [])

  return {
    device: state.device,
    isMobile: state.device === 'mobile',
    isTablet: state.device === 'tablet',
    isDesktop: state.device === 'desktop',
    isLandscape: state.landscape,
    isPortrait: !state.landscape,
  }
}
