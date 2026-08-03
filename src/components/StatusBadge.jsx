import { statusColors } from '../lib/palette.js'
import { useTheme } from '../context/theme.js'

/**
 * Status names match the workflow exactly (New → Assigned → In Progress →
 * Job Done → Reviewed → Closed). An earlier version renamed them for display
 * ("Pending", "Servicing"), which made the UI and the database disagree — bad
 * for an internal tool where staff quote status names to each other.
 *
 * The dot takes its hue from the same map the charts read, so a status is one
 * colour everywhere it appears. The label is always present: the colour
 * supplements it, never replaces it.
 */

const TEXT_STYLES = {
  New: 'bg-marine-100 text-brand',
  Assigned: 'bg-copper/10 text-copper dark:text-[#E2A288]',
  'In Progress': 'bg-coolant-50 text-coolant-700 dark:text-[#5FD3C0]',
  'Job Done': 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  Reviewed: 'bg-pink-50 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300',
  Closed: 'bg-success-50 text-success-700 dark:text-[#5FD07E]',
}

function StatusBadge({ status, size = 'md', onDark = false }) {
  const { theme } = useTheme()
  const style = onDark
    ? 'bg-white/20 text-white'
    : (TEXT_STYLES[status] ?? 'bg-frost-deep text-slate')
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-medium ${style} ${padding}`}
    >
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: onDark ? '#FFFFFF' : (statusColors(theme)[status] ?? '#5A6B80') }}
      />
      {status}
    </span>
  )
}

export default StatusBadge
