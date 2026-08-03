import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'

import { Card, CardHeader, EmptyState, Skeleton } from './ui.jsx'
import { money } from '../lib/format.js'
import { postJson } from '../lib/api.js'

/**
 * Advanced AI challenge — Workflow Supervisor.
 *
 * Completed jobs that look wrong, worst first. The reasons come from rules in
 * `api/supervise.js`, each with its own stated threshold; the model writes only
 * the one-line triage at the top, and the badge says when it didn't.
 */
function SupervisorCard({ onOpenOrder }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await postJson('/api/supervise'))
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

  return (
    <Card padded={false}>
      <CardHeader
        title="Needs attention"
        subtitle="Completed jobs the supervisor flagged"
        accent="warn"
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-line p-1.5 text-slate transition hover:bg-frost hover:text-ink disabled:opacity-50"
            aria-label="Re-run the supervisor"
            title="Re-run"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="p-3">
        {loading && !data ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : error ? (
          <p className="px-2 py-4 text-xs text-slate">{error}</p>
        ) : (
          <>
            {/* The triage line. Everything under it is rule output. */}
            <div className="mb-3 flex gap-2.5 rounded-xl bg-frost/70 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coolant-50 text-coolant">
                <Sparkles size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-ink">{data.summary}</p>
                <p className="mt-1 text-[11px] text-slate-light">
                  {data.checked} completed jobs checked
                  {data.summaryBy === 'computed' && ' · summary written without the model'}
                  {!data.evidenceChecked && ' · evidence rule skipped, no job_files table'}
                </p>
              </div>
            </div>

            {data.flagged.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nothing flagged">
                Every completed job passed the checks.
              </EmptyState>
            ) : (
              /* Bounded so a bad week cannot stretch the dashboard. The
                 scrollbar is hidden because a visible one inside a card reads
                 as a second window; the count below says what is out of view. */
              <ul className="no-scrollbar max-h-[26rem] space-y-1.5 overflow-y-auto">
                {data.flagged.slice(0, 6).map((f) => {
                  const serious = f.severity === 'high'
                  return (
                    <li key={f.order_no}>
                      <button
                        onClick={() => onOpenOrder?.(f.order_no)}
                        /* A severity edge and a tinted ground, so this list
                           cannot be mistaken for the neutral order table it
                           sits beside. */
                        className={`w-full rounded-lg border-l-[3px] py-2.5 pl-3 pr-3 text-left transition ${
                          serious
                            ? 'border-copper bg-copper/[0.06] hover:bg-copper/[0.12]'
                            : 'border-slate-light bg-frost/70 hover:bg-frost'
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="tabular-nums text-sm font-medium text-ink">
                            {f.order_no}
                          </span>
                          <span className="truncate text-xs text-slate">{f.technician ?? '—'}</span>
                          <span className="ml-auto shrink-0 text-xs tabular-nums text-slate">
                            {money(f.final_amount)}
                          </span>
                        </div>

                        {/* Labels as chips: the "why" at a glance, in the shape
                            of a badge rather than another line of prose. */}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {f.reasons.map((r) => (
                            <span
                              key={r.key}
                              title={r.detail}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                r.severity === 'high'
                                  ? 'bg-copper/15 text-copper dark:text-[#E2A288]'
                                  : 'bg-frost-deep text-slate'
                              }`}
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>

                        {/* One line of specifics — the rest are on the order. */}
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate">
                          {f.reasons[0].detail}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {data.flagged.length > 6 && (
              <p className="px-1 pt-2 text-[11px] text-slate-light">
                Showing 6 of {data.flagged.length} flagged.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export default SupervisorCard
