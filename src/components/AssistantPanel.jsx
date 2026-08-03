import { useEffect, useRef, useState } from 'react'
import { Database, Send, Sparkles, X } from 'lucide-react'

import { Alert, Section } from './ui.jsx'
import { dateOnly, money } from '../lib/format.js'

/**
 * AI Module — the manager's query window, as a side panel.
 *
 * It lives beside the work rather than on its own page: the questions it
 * answers ("who is overloaded this week?") are asked *while* looking at the
 * dashboard or an order, so making someone navigate away to ask them — and
 * navigate back to act — was the wrong shape.
 *
 * Every answer ships with the retrieval that produced it: which table, which
 * columns, which filters, how many rows. A manager about to act on "Bala is
 * overloaded" should be able to see the jobs that claim was counted from, and
 * a reviewer should be able to tell the model was handed those rows rather
 * than the database.
 */

const SUGGESTIONS = [
  'What jobs did Ali complete last week?',
  'Which technician completed the most jobs this week?',
  'How many jobs were completed today?',
  'Which technician might be overloaded this week?',
]

function AssistantPanel({ open, onClose }) {
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  // The newest answer is the one you want to read, so ride the bottom.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

      setThread((prev) => [...prev, { question: q, result }])
      setQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <button
          className="animate-fade fixed inset-0 z-40 bg-marine/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-label="Close assistant"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-line bg-surface shadow-sheet transition-transform duration-200 sm:w-[26rem] ${
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <header className="relative flex items-center gap-3 overflow-hidden bg-brand-sweep px-4 py-3">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-brand-glow" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50 [background-size:16px_16px]"
          />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white">
            <Sparkles size={17} />
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-white">Operations assistant</p>
            <p className="truncate text-[11px] text-white/75">
              Answers computed from the database
            </p>
          </div>
          <button
            onClick={onClose}
            className="relative rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Close assistant"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-frost/40 p-3">
          {thread.length === 0 && !loading && <Primer />}

          {thread.map((entry, i) => (
            <Exchange key={i} entry={entry} />
          ))}

          {loading && (
            <p className="px-1 py-2 text-xs text-slate">Retrieving and computing…</p>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-line bg-surface p-3">
          {thread.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={loading}
                  className="shrink-0 rounded-full border border-slate-line px-2.5 py-1 text-[11px] text-slate transition hover:border-coolant hover:text-coolant-700 disabled:opacity-50"
                >
                  {s.length > 34 ? `${s.slice(0, 32)}…` : s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask()
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-line bg-surface px-2.5 py-1.5 focus-within:border-coolant focus-within:ring-2 focus-within:ring-coolant/25"
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about completed work…"
              maxLength={300}
              aria-label="Ask a question about operations"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-slate-light focus:outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marine text-white transition hover:bg-marine-600 disabled:bg-marine/30"
              aria-label="Ask"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}

/** What the panel shows before anything has been asked. */
function Primer() {
  return (
    <div className="rounded-xl border border-slate-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Ask about completed work</p>
      <p className="mt-1 text-xs text-slate">
        The model turns your question into an intent, the server runs one declared query, the
        numbers are computed in code, and the model writes the sentence around them. Every answer
        shows the rows it used.
      </p>
      <ul className="mt-3 space-y-1.5">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <span className="text-xs text-slate">· {s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Exchange({ entry }) {
  const { question, result } = entry
  const rows = result.rows ?? []

  return (
    <div className="space-y-2">
      {/* The question, as the reader asked it. */}
      <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-marine-100 px-3 py-2 text-sm text-ink">
        {question}
      </p>

      <div className="rounded-xl border border-slate-line bg-surface p-3">
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coolant-50 text-coolant">
            <Sparkles size={14} />
          </span>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{result.answer}</p>
        </div>

        {result.retrieval && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
              <Tag>{result.intentLabel ?? result.intent}</Tag>
              {result.params?.range && <Tag>{result.params.range}</Tag>}
              {result.params?.technician && <Tag>{result.params.technician}</Tag>}
              <Tag>{result.retrieval.rowCount} rows</Tag>
              {result.phrasedBy === 'computed' && <Tag tone="warn">worded without the model</Tag>}
              {result.routedBy === 'keywords' && <Tag tone="warn">routed by keywords</Tag>}
            </div>

            <div className="mt-2">
              <Section title="Data used" icon={Database} defaultOpen={false}>
                <p className="mb-2 break-words text-[11px] text-slate">
                  <span className="font-medium text-ink">
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
                  <p className="py-1 text-xs text-slate-light">No rows matched.</p>
                ) : (
                  <ul className="-mx-4 divide-y divide-slate-line border-y border-slate-line">
                    {rows.map((r) => (
                      <li key={r.order_no} className="flex items-baseline gap-2 px-4 py-1.5 text-xs">
                        <span className="tabular-nums text-ink">{r.order_no}</span>
                        <span className="truncate text-slate">{r.assigned_technician ?? '—'}</span>
                        <span className="ml-auto shrink-0 text-slate-light">
                          {dateOnly(r.completed_at)}
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">
                          {money(r.final_amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tag({ children, tone = 'neutral' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        tone === 'warn' ? 'bg-amber-50 text-amber-700 dark:text-amber-300' : 'bg-frost-deep text-slate'
      }`}
    >
      {children}
    </span>
  )
}

export default AssistantPanel
