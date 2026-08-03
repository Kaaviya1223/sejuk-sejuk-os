import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, Trophy, Wallet } from 'lucide-react'

import { Alert, Card, CardHeader, PageHeader, SkeletonRows, Stat } from '../components/ui.jsx'
import { useSession } from '../context/session.js'
import { money, shortMoney } from '../lib/format.js'
import { listOrders } from '../lib/orders.js'
import { sequential } from '../lib/palette.js'
import { useTheme } from '../context/theme.js'
import { COMPLETED_STATUSES } from '../lib/constants.js'

/**
 * Bonus module — technician performance.
 *
 * Weekly is the brief's minimum, so the period selector opens on this week and
 * every figure recomputes against it. Aggregation happens in the browser over a
 * bounded fetch: correct at this scale, and the wrong place for it at real
 * volume — see the README.
 */

const PERIODS = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'all_time', label: 'All time' },
]

/** Monday-start weeks, matching how the branches roster their work. */
function windowFor(key) {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monday = new Date(midnight)
  monday.setDate(midnight.getDate() - ((now.getDay() + 6) % 7))

  switch (key) {
    case 'last_week': {
      const from = new Date(monday)
      from.setDate(monday.getDate() - 7)
      return { from, to: monday }
    }
    case 'this_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null }
    case 'all_time':
      return { from: null, to: null }
    default:
      return { from: monday, to: null }
  }
}

/** Completed jobs are dated by completion; anything else by when it was raised. */
function orderDate(order) {
  return new Date(order.completed_at ?? order.created_at)
}

function within({ from, to }, date) {
  if (from && date < from) return false
  if (to && date >= to) return false
  return true
}

function Performance() {
  const { technicians } = useSession()
  const { theme } = useTheme()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('this_week')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await listOrders())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const board = useMemo(() => {
    const range = windowFor(period)
    const inRange = orders.filter((o) => within(range, orderDate(o)))

    const rows = technicians.map((tech) => {
      const mine = inRange.filter((o) => o.assigned_technician === tech.name)
      const done = mine.filter((o) => COMPLETED_STATUSES.includes(o.status))
      return {
        name: tech.name,
        branch: tech.branch,
        jobs: done.length,
        total: done.reduce((sum, o) => sum + Number(o.final_amount || 0), 0),
        // Absent until the migration lands, which is not the same as a postponement.
        postponed: mine.reduce((sum, o) => sum + Number(o.reschedule_count || 0), 0),
      }
    })

    // Unassigned work belongs to nobody, so it is counted in the totals only.
    const completed = inRange.filter((o) => COMPLETED_STATUSES.includes(o.status))

    return {
      rows: rows.sort((a, b) => b.jobs - a.jobs || b.total - a.total),
      jobs: completed.length,
      value: completed.reduce((sum, o) => sum + Number(o.final_amount || 0), 0),
      postponed: inRange.reduce((sum, o) => sum + Number(o.reschedule_count || 0), 0),
    }
  }, [orders, technicians, period])

  const max = Math.max(...board.rows.map((r) => r.jobs), 1)
  const label = PERIODS.find((p) => p.key === period)?.label.toLowerCase()

  return (
    <>
      <PageHeader
        title="Technician performance"
        subtitle="Completed jobs, value collected and postponements per technician."
        actions={
          <div className="flex flex-wrap gap-1 rounded-lg bg-white/15 p-1 ring-1 ring-inset ring-white/25">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  period === p.key ? 'bg-surface text-brand' : 'text-white/80 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          loading={loading}
          label="Jobs completed"
          value={board.jobs}
          sub={label}
          icon={CheckCircle2}
          tone="accent"
        />
        <Stat
          loading={loading}
          label="Value completed"
          value={shortMoney(board.value)}
          sub={label}
          icon={Wallet}
          tone="brand"
        />
        <Stat
          loading={loading}
          label="Postponements"
          value={board.postponed}
          sub="reschedules in period"
          icon={RotateCcw}
          tone="amber"
        />
        <Stat
          loading={loading}
          label="Top technician"
          value={board.rows[0]?.jobs ? board.rows[0].name : '—'}
          sub={board.rows[0]?.jobs ? `${board.rows[0].jobs} jobs` : 'nothing completed yet'}
          icon={Trophy}
          tone="accent"
        />
      </div>

      <Card padded={false}>
        <CardHeader
          title="Leaderboard"
          subtitle={`Ranked by jobs completed ${label} — ties broken by value`}
        />

        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[2rem_1.2fr_2fr_1fr_0.8fr] gap-4 border-b border-slate-line bg-frost/70 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate">
                <span>#</span>
                <span>Technician</span>
                <span>Jobs completed</span>
                <span className="text-right">Value</span>
                <span className="text-right">Postponed</span>
              </div>
              <div className="divide-y divide-slate-line">
                {board.rows.map((row, i) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[2rem_1.2fr_2fr_1fr_0.8fr] items-center gap-4 px-5 py-3"
                  >
                    <span className="text-sm tabular-nums text-slate-light">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{row.name}</p>
                      {row.branch && <p className="truncate text-xs text-slate">{row.branch}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-3.5 min-w-0 flex-1 items-center">
                        <span
                          className="h-full rounded-r"
                          style={{
                            width: `${Math.max((row.jobs / max) * 100, row.jobs ? 2 : 0)}%`,
                            backgroundColor: sequential(theme),
                          }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink">
                        {row.jobs}
                      </span>
                    </div>
                    <span className="text-right text-sm tabular-nums text-ink">
                      {money(row.total)}
                    </span>
                    <span
                      className={`text-right text-sm tabular-nums ${
                        row.postponed ? 'text-amber-700' : 'text-slate-light'
                      }`}
                    >
                      {row.postponed}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-slate-line md:hidden">
              {board.rows.map((row, i) => (
                <div key={row.name} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">
                      <span className="mr-2 tabular-nums text-slate-light">{i + 1}</span>
                      {row.name}
                    </p>
                    <p className="text-sm tabular-nums text-ink">{money(row.total)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate">
                    {row.jobs} completed · {row.postponed} postponed
                    {row.branch ? ` · ${row.branch}` : ''}
                  </p>
                </div>
              ))}
            </div>

            {board.jobs === 0 && (
              <p className="border-t border-slate-line px-5 py-4 text-xs text-slate">
                No jobs were completed {label}. Try a wider period.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  )
}

export default Performance
