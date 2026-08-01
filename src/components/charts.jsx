import { useState } from 'react'

import { SEQUENTIAL, STATUS_COLORS } from '../lib/palette.js'
import { STATUSES } from '../lib/constants.js'

/**
 * Dashboard marks, drawn as SVG and plain elements — no charting dependency
 * for three figures. Every fill carries a visible count beside it, because
 * three of the six status hues sit below 3:1 contrast on a white card.
 */

/* ------------------------------------------------------------------ */
/* Part-to-whole: where the workload sits                              */
/* ------------------------------------------------------------------ */

/**
 * Horizontal stacked bar. Segments run in workflow order, separated by a 2px
 * gap in the surface colour rather than a stroke, and the legend below doubles
 * as the value table.
 */
export function StatusMix({ orders }) {
  const [hovered, setHovered] = useState(null)

  const counts = STATUSES.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }))
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const present = counts.filter((c) => c.count > 0)

  if (!total) return <ChartEmpty>No orders to chart yet.</ChartEmpty>

  const pct = (n) => Math.round((n / total) * 100)

  return (
    <div>
      <div className="relative">
        {hovered && (
          <div className="pointer-events-none absolute -top-1 left-0 z-10 -translate-y-full rounded-lg bg-marine px-2.5 py-1.5 text-xs text-white shadow-lift">
            <span className="font-medium">{hovered.status}</span> · {hovered.count} job
            {hovered.count === 1 ? '' : 's'} ({pct(hovered.count)}%)
          </div>
        )}

        <div className="flex h-7 items-center gap-[2px]">
          {present.map(({ status, count }, i) => (
            <button
              key={status}
              type="button"
              style={{ width: `${(count / total) * 100}%` }}
              className="flex h-full items-center"
              onMouseEnter={() => setHovered({ status, count })}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered({ status, count })}
              onBlur={() => setHovered(null)}
              aria-label={`${status}: ${count} of ${total} orders`}
            >
              <span
                className={`h-3.5 w-full ${i === 0 ? 'rounded-l' : ''} ${
                  i === present.length - 1 ? 'rounded-r' : ''
                }`}
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {counts.map(({ status, count }) => (
          <li key={status} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            <span className="min-w-0 flex-1 truncate text-slate">{status}</span>
            <span className="font-medium tabular-nums text-marine">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Magnitude: who is carrying the work                                 */
/* ------------------------------------------------------------------ */

/**
 * One hue, more-is-longer. Open jobs per technician, sorted heaviest first,
 * with the value at the tip of each bar.
 */
export function TechnicianLoad({ orders, technicians }) {
  const rows = technicians
    .map((tech) => ({
      name: tech.name,
      open: orders.filter(
        (o) => o.assigned_technician === tech.name && !['Reviewed', 'Closed'].includes(o.status),
      ).length,
    }))
    .sort((a, b) => b.open - a.open)

  const max = Math.max(...rows.map((r) => r.open), 1)

  if (!rows.length) return <ChartEmpty>No technicians on the roster.</ChartEmpty>

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.name} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3">
          <span className="truncate text-xs font-medium text-marine">{row.name}</span>
          <span className="flex h-3.5 items-center" title={`${row.name}: ${row.open} open`}>
            <span
              className="h-full rounded-r"
              style={{
                width: `${Math.max((row.open / max) * 100, row.open ? 2 : 0)}%`,
                backgroundColor: SEQUENTIAL,
              }}
            />
          </span>
          <span className="text-right text-xs tabular-nums text-slate">{row.open}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* A ratio against its limit                                           */
/* ------------------------------------------------------------------ */

/**
 * Completion meter. The unfilled track is a lighter step of the fill's own
 * ramp, so the state reads across the whole ring rather than only where it
 * stops.
 */
export function CompletionMeter({ done, total, caption }) {
  const ratio = total ? done / total : 0
  const r = 74
  const circumference = 2 * Math.PI * r

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 180 180" className="h-40 w-40" role="img"
          aria-label={`${done} of ${total} orders completed`}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#D8EDE2" strokeWidth="16" />
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke="#3E9B6B"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${circumference * ratio} ${circumference}`}
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-semibold leading-none text-marine">
            {Math.round(ratio * 100)}
            <span className="text-2xl text-slate">%</span>
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate">
        <span className="font-semibold text-marine">{done}</span> of{' '}
        <span className="font-semibold text-marine">{total}</span> {caption}
      </p>
    </div>
  )
}

function ChartEmpty({ children }) {
  return <p className="py-8 text-center text-xs text-slate-light">{children}</p>
}
