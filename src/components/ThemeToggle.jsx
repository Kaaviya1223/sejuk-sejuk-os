import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/theme.js'

/**
 * Light / dark switch. Two placements: the white top bar, and the technician's
 * brand-gradient header (`onBand`), where it has to sit on colour.
 */
function ThemeToggle({ onBand = false }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`rounded-lg p-2 transition ${
        onBand
          ? 'text-white/80 hover:bg-white/15 hover:text-white'
          : 'text-slate hover:bg-frost hover:text-ink'
      }`}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export default ThemeToggle
