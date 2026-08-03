import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'

import { Card, CardHeader, EmptyState, Skeleton } from './ui.jsx'
import { money } from '../lib/format.js'

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
      const res = await fetch('/api/supervise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const raw = await res.text()
      const parsed = raw ? JSON.parse(raw) : null
      if (!parsed) throw new Error('The supervisor endpoint is not available here.')
      if (!res.ok) throw new Error(parsed.error || 'The supervisor could not run.')
      setData(parsed)
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
              <ul className="space-y-2">
                {data.flagged.slice(0, 6).map((f) => (
                  <li key={f.order_no}>
                    <button
                      onClick={() => onOpenOrder?.(f.order_no)}
                      className="w-full rounded-xl border border-slate-line bg-surface p-3 text-left transition hover:border-coolant/50 hover:bg-frost/50"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          size={13}
                          className={f.severity === 'high' ? 'text-copper' : 'text-slate-light'}
                        />
                        <span className="tabular-nums text-sm font-medium text-ink">
                          {f.order_no}
                        </span>
                        <span className="truncate text-xs text-slate">{f.technician ?? '—'}</span>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-slate">
                          {money(f.final_amount)}
                        </span>
                      </div>

                      <ul className="mt-1.5 space-y-1">
                        {f.reasons.map((r) => (
                          <li key={r.key} className="flex items-start gap-1.5 text-[11px]">
                            <span
                              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                                r.severity === 'high' ? 'bg-copper' : 'bg-slate-light'
                              }`}
                            />
                            <span className="text-slate">
                              <span className="font-medium text-ink">{r.label}.</span> {r.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  </li>
                ))}
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
