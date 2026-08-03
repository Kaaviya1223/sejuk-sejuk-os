import { createClient } from '@supabase/supabase-js'

/**
 * Advanced AI challenge — Workflow Supervisor.
 *
 * Flags completed jobs that look wrong. The rules are ordinary code, and each
 * one states its own threshold: a supervisor that quietly changes its mind
 * about what "much higher than quoted" means is not a supervisor. The model is
 * given the finished list and asked for one sentence of triage — it can change
 * the wording of the summary, never which jobs were flagged or why.
 *
 * Same posture as `query.js`: fixed columns, bounded window, row cap, and a
 * template fallback so an exhausted quota costs the prose and nothing else.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const COMPLETED = ['Job Done', 'Reviewed', 'Closed']

const ORDER_COLUMNS = `id, order_no, customer_name, assigned_technician, completed_by, status,
  quoted_price, final_amount, extra_charges, completed_at, reschedule_count, payment_amount`

/** Every threshold this supervisor applies, in one readable place. */
export const RULES = {
  // "Final amount much higher than quoted price" — the brief's first example.
  over_quote: {
    label: 'Over quote',
    severity: 'high',
    // Both a ratio and a floor: +30% of RM 20 is not worth anyone's attention.
    test: (o) => {
      const quoted = Number(o.quoted_price || 0)
      const final = Number(o.final_amount || 0)
      if (!quoted || !final) return null
      const over = final - quoted
      if (over < 50 || final < quoted * 1.3) return null
      return `Final RM ${final.toFixed(2)} against a quote of RM ${quoted.toFixed(
        2,
      )} — ${Math.round((over / quoted) * 100)}% over.`
    },
  },

  // "Job done but no photos uploaded" — the brief's second example.
  no_evidence: {
    label: 'No evidence',
    severity: 'high',
    test: (o) => (o.fileCount === 0 ? 'Marked complete with no photo, video or PDF attached.' : null),
  },

  // Operationally useful, and the data was already being captured.
  repeat_postpone: {
    label: 'Postponed repeatedly',
    severity: 'medium',
    test: (o) =>
      Number(o.reschedule_count || 0) >= 2
        ? `Postponed ${o.reschedule_count} times before completion.`
        : null,
  },

  awaiting_review: {
    label: 'Waiting on review',
    severity: 'medium',
    test: (o) => {
      if (o.status !== 'Job Done' || !o.completed_at) return null
      const days = Math.floor((Date.now() - new Date(o.completed_at).getTime()) / 86400000)
      return days >= 3 ? `Finished ${days} days ago and still not reviewed.` : null
    },
  },
}

function client() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured on the server.')
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/** Evidence counts per order. A missing table means "cannot tell", not "none". */
async function evidenceCounts(db, ids) {
  try {
    const { data, error } = await db.from('job_files').select('order_id').in('order_id', ids)
    if (error) return null
    const counts = new Map(ids.map((id) => [id, 0]))
    for (const row of data ?? []) counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1)
    return counts
  } catch {
    return null
  }
}

async function digest(flagged, total) {
  if (!GEMINI_KEY) throw new Error('no-key')

  const prompt = `You are an operations supervisor for an air-conditioner service company.
Below is a list of completed jobs that automated checks flagged, with the reason for each.
Write ONE sentence for a manager: what needs attention first and why.
Use only what is in the JSON. Never invent an order, a name or a number.
Refer to people by name only — never he/she/his/her.

Flagged (${flagged.length} of ${total} completed jobs checked): ${JSON.stringify(flagged)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  )
  if (!res.ok) throw new Error(`gemini-${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('gemini-empty')
  return text.trim()
}

/** The summary a manager gets when the model is unavailable. */
function templateDigest(flagged, total) {
  if (!flagged.length) return `Nothing flagged across ${total} completed jobs.`
  const high = flagged.filter((f) => f.severity === 'high').length
  return high
    ? `${flagged.length} of ${total} completed jobs need attention, ${high} of them serious — start with the ones over quote or missing evidence.`
    : `${flagged.length} of ${total} completed jobs need attention.`
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const limit = Math.min(Number(req.body?.limit ?? req.query?.limit ?? 100), 200)

  try {
    const db = client()

    const { data: orders, error } = await db
      .from('orders')
      .select(ORDER_COLUMNS)
      .in('status', COMPLETED)
      .order('completed_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Could not read orders: ${error.message}`)

    const rows = orders ?? []
    const counts = rows.length ? await evidenceCounts(db, rows.map((o) => o.id)) : new Map()

    const flagged = []
    for (const order of rows) {
      // Without the job_files table there is no basis for the evidence rule,
      // so it is skipped rather than firing on every job.
      const withCounts = { ...order, fileCount: counts ? (counts.get(order.id) ?? 0) : null }

      const reasons = Object.entries(RULES)
        .map(([key, rule]) => {
          const detail = rule.test(withCounts)
          return detail ? { key, label: rule.label, severity: rule.severity, detail } : null
        })
        .filter(Boolean)

      if (reasons.length) {
        flagged.push({
          order_no: order.order_no,
          customer_name: order.customer_name,
          technician: order.completed_by || order.assigned_technician,
          status: order.status,
          quoted_price: order.quoted_price,
          final_amount: order.final_amount,
          severity: reasons.some((r) => r.severity === 'high') ? 'high' : 'medium',
          reasons,
        })
      }
    }

    // Worst first, so the top of the list is where to start.
    flagged.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))

    let summary
    let summaryBy = 'model'
    try {
      summary = await digest(flagged.slice(0, 12), rows.length)
    } catch {
      summary = templateDigest(flagged, rows.length)
      summaryBy = 'computed'
    }

    return res.status(200).json({
      summary,
      summaryBy,
      checked: rows.length,
      evidenceChecked: Boolean(counts),
      flagged,
      rules: Object.entries(RULES).map(([key, r]) => ({ key, label: r.label, severity: r.severity })),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
