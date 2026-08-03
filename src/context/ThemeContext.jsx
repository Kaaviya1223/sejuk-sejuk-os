import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './theme.js'

/**
 * Light / dark, stored per browser.
 *
 * Defaults to whatever the operating system asks for, because a technician
 * opening this at night on a phone has already told their phone what they
 * want. An explicit choice wins and sticks; we stop following the OS from that
 * point rather than surprising someone by flipping under them at sunset.
 */

const STORAGE_KEY = 'sejuk.theme'

function preferred() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* private mode, fall through to the OS setting */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(preferred)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    // Tells the browser to theme form controls and scrollbars to match.
    root.style.colorScheme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* not fatal — the class is already applied */
    }
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
