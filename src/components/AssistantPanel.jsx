import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, X } from 'lucide-react'

import { Alert } from './ui.jsx'
import { postJson } from '../lib/api.js'

/**
 * AI Module — the manager's query window, as a side panel.
 *
 * It lives beside the work rather than on its own page: the questions it
 * answers ("who is overloaded this week?") are asked *while* looking at the
 * dashboard or an order, so making someone navigate away to ask them — and
 * navigate back to act — was the wrong shape.
 *
 * Each answer carries the intent it was read as, the period, and how many rows
 * were counted — enough to tell whether the question was understood. The full
 * retrieval descriptor is still in the response body for anyone who wants to
 * audit it; it is not rendered, because a column list is developer language in
 * a tool built for operations staff.
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

  /**
   * The question is posted to the thread and the box cleared before the
   * request goes out. Waiting for the response to do either left the typed
   * text sitting in the box with an empty conversation above it — it looked
   * like nothing had been sent.
   */
  const ask = async (text) => {
    const q = (text ?? question).trim()
    if (!q || loading) return

    const id = `${Date.now()}-${q.length}`
    setThread((prev) => [...prev, { id, question: q, result: null, error: null }])
    setQuestion('')
    setLoading(true)
    setError(null)

    try {
      const result = await postJson('/api/query', { question: q })
      setThread((prev) => prev.map((e) => (e.id === id ? { ...e, result } : e)))
    } catch (err) {
      // The failure belongs against the question that caused it, not floating
      // at the bottom of the panel.
      setThread((prev) => prev.map((e) => (e.id === id ? { ...e, error: err.message } : e)))
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

          {thread.map((entry) => (
            <Exchange key={entry.id} entry={entry} />
          ))}

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
            className="flex items-center gap-2 rounded-xl border border-slate-line bg-surface px-2.5 py-1.5 focus-within:border-marine-500"
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
        numbers are computed in code, and the model writes the sentence around them.
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
  const { question, result, error } = entry

  return (
    <div className="space-y-2">
      {/* The question, as the reader asked it — posted the moment they send. */}
      <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-marine-100 px-3 py-2 text-sm text-ink">
        {question}
      </p>

      <div className="rounded-xl border border-slate-line bg-surface p-3">
        <div className="flex gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-coolant-50 text-coolant">
            <Sparkles size={14} />
          </span>

          {error ? (
            <p className="text-sm leading-relaxed text-slate">{error}</p>
          ) : result ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{result.answer}</p>
          ) : (
            /* Waiting, in the place the answer will appear. */
            <span className="flex items-center gap-1.5 py-1" aria-label="Working">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-light"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )}
        </div>

        {result?.retrieval && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
              <Tag>{result.intentLabel ?? result.intent}</Tag>
              {result.params?.range && <Tag>{result.params.range}</Tag>}
              {result.params?.technician && <Tag>{result.params.technician}</Tag>}
              <Tag>
                {result.retrieval.rowCount} row{result.retrieval.rowCount === 1 ? '' : 's'}
              </Tag>

              {/* One quiet chip rather than two amber ones. The disclosure has
                  to stay — silently switching to keyword routing would leave a
                  reader with no way to explain a crudely-read question — but
                  the numbers are computed either way, so it is a footnote, not
                  a warning. The detail is on hover. */}
              {(result.routedBy === 'keywords' || result.phrasedBy === 'computed') && (
                <Tag
                  title={[
                    result.routedBy === 'keywords'
                      ? 'Your question was matched by keyword rather than read by the model, so an unusual phrasing may be read crudely.'
                      : null,
                    result.phrasedBy === 'computed'
                      ? 'The sentence came from a template.'
                      : null,
                    'The figures are computed from the database either way.',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  without the model
                </Tag>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tag({ children, title }) {
  return (
    <span
      title={title}
      className={`rounded-full bg-frost-deep px-2 py-0.5 text-slate ${title ? 'cursor-help' : ''}`}
    >
      {children}
    </span>
  )
}

export default AssistantPanel
