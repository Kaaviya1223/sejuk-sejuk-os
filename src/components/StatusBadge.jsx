import { STATUS_COLORS } from '../lib/palette.js'

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
  New: 'bg-marine-100 text-marine-600',
  Assigned: 'bg-copper/10 text-copper',
  'In Progress': 'bg-coolant-50 text-coolant-700',
  'Job Done': 'bg-amber-50 text-amber-800',
  Reviewed: 'bg-pink-50 text-pink-700',
  Closed: 'bg-success-50 text-success-700',
}

function StatusBadge({ status, size = 'md', onDark = false }) {
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
        style={{ backgroundColor: onDark ? '#FFFFFF' : (STATUS_COLORS[status] ?? '#5A6B80') }}
      />
      {status}
    </span>
  )
}

export default StatusBadge
