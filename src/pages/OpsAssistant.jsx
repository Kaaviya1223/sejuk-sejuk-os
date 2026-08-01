import { useState } from 'react'
import { CornerDownLeft, Database, Sparkles } from 'lucide-react'

import { Alert, Button, Card, CardHeader, Input, PageHeader, Section } from '../components/ui.jsx'
import { dateOnly, money } from '../lib/format.js'

/**
 * AI Module — the manager's query window.
 *
 * Every answer ships with the retrieval that produced it: which table, which
 * columns, which filters, how many rows. A manager about to act on "Bala is
 * overloaded" should be able to see the jobs that claim was counted from, and
 * a reviewer should be able to tell that the model was handed those rows
 * rather than the database.
 */

const SUGGESTIONS = [
  'What jobs did Ali complete last week?',
  'Which technician completed the most jobs this week?',
  'How many jobs were completed today?',
  'Which technician might be overloaded this week?',
]

function OpsAssistant() {
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ask = async (text) => {
    const q = (text ?? question).trim()
    if (!q || loading) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'The assistant could not answer that.')

      setThread((prev) => [{ question: q, result }, ...prev])
      setQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Operations assistant"
        subtitle="Ask about completed work. Answers are computed from the database, not recalled by the model."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask()
              }}
              className="flex gap-2"
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What jobs did Ali complete last week?"
                maxLength={300}
                aria-label="Ask a question about operations"
              />
              <Button type="submit" loading={loading} disabled={!question.trim()}>
                {!loading && <CornerDownLeft size={15} />}
                Ask
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={loading}
                  className="rounded-full border border-slate-line bg-white px-3 py-1 text-xs text-slate transition hover:border-coolant hover:text-coolant-700 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          {error && <Alert tone="error">{error}</Alert>}

          {thread.length === 0 && !loading && (
            <Card>
              <p className="text-sm text-slate">
                Nothing asked yet. Pick one of the suggestions above, or type your own — the
                assistant answers four kinds of question, listed on the right.
              </p>
            </Card>
          )}

          {thread.map((entry, i) => (
            <Answer key={thread.length - i} entry={entry} />
          ))}
        </div>

        <div className="space-y-4">
          <Card padded={false}>
            <CardHeader title="What it can answer" />
            <ul className="space-y-2 px-5 py-4 text-sm text-slate">
              <li>Jobs completed by one technician</li>
              <li>Who completed the most jobs</li>
              <li>How many jobs were completed</li>
              <li>How the workload is spread across the team</li>
            </ul>
          </Card>

          <Card padded={false}>
            <CardHeader title="How it works" />
            <ol className="space-y-2.5 px-5 py-4 text-xs text-slate">
              <li>
                <span className="font-medium text-marine">1 · Classify.</span> The model turns your
                sentence into an intent plus parameters — nothing more.
              </li>
              <li>
                <span className="font-medium text-marine">2 · Retrieve.</span> The server runs the
                one query that intent declares: fixed columns, a bounded date window, a row cap.
              </li>
              <li>
                <span className="font-medium text-marine">3 · Compute.</span> Counts and totals are
                worked out in code, so a figure can never be invented.
              </li>
              <li>
                <span className="font-medium text-marine">4 · Phrase.</span> The model writes the
                sentence around those numbers.
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  )
}

function Answer({ entry }) {
  const { question, result } = entry
  const rows = result.rows ?? []

  return (
    <Card padded={false}>
      <div className="border-b border-slate-line px-5 py-3">
        <p className="text-sm font-medium text-marine">{question}</p>
      </div>

      <div className="px-5 py-4">
        <div className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-coolant-50 text-coolant">
            <Sparkles size={16} />
          </span>
          <p className="whitespace-pre-line text-sm leading-relaxed text-marine">{result.answer}</p>
        </div>

        {result.retrieval && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            <Tag>{result.intentLabel ?? result.intent}</Tag>
            {result.params?.range && <Tag>{result.params.range}</Tag>}
            {result.params?.technician && <Tag>{result.params.technician}</Tag>}
            <Tag>{result.retrieval.rowCount} rows read</Tag>
            {result.phrasedBy === 'computed' && <Tag tone="warn">worded without the model</Tag>}
            {result.routedBy === 'keywords' && <Tag tone="warn">routed by keywords</Tag>}
          </div>
        )}
      </div>

      {result.retrieval && (
        <div className="border-t border-slate-line p-3">
          <Section title="Data used for this answer" icon={Database} defaultOpen={false}>
            <p className="mb-2 text-[11px] text-slate">
              <span className="font-medium text-marine">
                select {result.retrieval.columns.join(', ')} from {result.retrieval.table}
              </span>
              {result.retrieval.filters.map((f) => (
                <span key={f} className="block">
                  where {f}
                </span>
              ))}
              <span className="block">limit {result.retrieval.limit}</span>
            </p>

            {rows.length === 0 ? (
              <p className="py-2 text-xs text-slate-light">No rows matched.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="w-full min-w-[26rem] text-xs">
                  <thead>
                    <tr className="border-y border-slate-line bg-frost/60 text-left text-slate">
                      <th className="px-4 py-1.5 font-medium">Order</th>
                      <th className="px-2 py-1.5 font-medium">Technician</th>
                      <th className="px-2 py-1.5 font-medium">Completed</th>
                      <th className="px-4 py-1.5 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-line">
                    {rows.map((r) => (
                      <tr key={r.order_no}>
                        <td className="px-4 py-1.5 tabular-nums text-marine">{r.order_no}</td>
                        <td className="px-2 py-1.5 text-slate">{r.assigned_technician ?? '—'}</td>
                        <td className="px-2 py-1.5 text-slate">{dateOnly(r.completed_at)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums text-marine">
                          {money(r.final_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </Card>
  )
}

function Tag({ children, tone = 'neutral' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-frost-deep text-slate'
      }`}
    >
      {children}
    </span>
  )
}

export default OpsAssistant
