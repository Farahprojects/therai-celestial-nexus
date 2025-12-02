
import * as React from "react"

const MOBILE_BREAKPOINT = 640

export function useIsMobile() {
  // Start with false to prevent desktop from showing mobile UI initially
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    
    // Set initial value
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
