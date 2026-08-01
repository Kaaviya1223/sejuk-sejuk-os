import { STATUSES } from '../lib/constants.js'

/** Compact six-step progress rail for the workflow state machine. */
function StatusTrack({ status, showLabel = false }) {
  const currentIndex = STATUSES.indexOf(status)

  return (
    <div className="flex items-center gap-1">
      {STATUSES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1" title={stage}>
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              i <= currentIndex ? 'bg-coolant' : 'bg-slate-line'
            }`}
          />
          {i < STATUSES.length - 1 && (
            <span
              className={`h-0.5 w-3.5 transition-colors ${
                i < currentIndex ? 'bg-coolant' : 'bg-slate-line'
              }`}
            />
          )}
        </div>
      ))}
      {showLabel && <span className="ml-2 tabular-nums text-xs text-slate">{status}</span>}
    </div>
  )
}

export default StatusTrack
