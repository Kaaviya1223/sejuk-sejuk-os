import { createClient } from '@supabase/supabase-js'

/**
 * AI Module — Operations Query Window (server side).
 *
 * The flow is: classify → retrieve → compute → phrase.
 *
 *   1. A model turns the manager's sentence into an *intent plus parameters*.
 *      That is all it is trusted to do.
 *   2. The server runs the one query that intent declares — a fixed table, a
 *      fixed column list, a bounded date window and a row cap. The browser
 *      never supplies data, and the model never supplies a filter that has not
 *      been validated (a technician name has to match the roster).
 *   3. Every number in the answer is computed here in JavaScript.
 *   4. The model only phrases those numbers into a sentence.
 *
 * So a hallucination can change the wording, never the figure — and an
 * unsupported question is refused before it reaches the database rather than
 * being answered from a table dump.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

/** Statuses that mean the technician finished the work. */
const COMPLETED = ['Job Done', 'Reviewed', 'Closed']

/** The company operates in Malaysia; "today" means today in UTC+8. */
const TZ_OFFSET_MIN = 8 * 60

/* ------------------------------------------------------------------ */
/* Date windows                                                        */
/* ------------------------------------------------------------------ */

function shiftedNow() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60000)
}

/** Local midnight of the given shifted date, returned as a real UTC instant. */
function localMidnight(shifted, dayOffset = 0) {
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + dayOffset,
  )
  return new Date(utcMidnight - TZ_OFFSET_MIN * 60000)
}

/** Monday-start weeks, because that is how the branches roster their work. */
function localMonday(shifted, weekOffset = 0) {
  const dow = (shifted.getUTCDay() + 6) % 7
  return localMidnight(shifted, -dow + weekOffset * 7)
}

export const RANGES = {
  today: (n) => ({ from: localMidnight(n), to: null, label: 'today' }),
  yesterday: (n) => ({ from: localMidnight(n, -1), to: localMidnight(n), label: 'yesterday' }),
  this_week: (n) => ({ from: localMonday(n), to: null, label: 'this week' }),
  last_week: (n) => ({ from: localMonday(n, -1), to: localMonday(n), label: 'last week' }),
  this_month: (n) => ({
    from: new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1) - TZ_OFFSET_MIN * 60000),
    to: null,
    label: 'this month',
  }),
  all_time: () => ({ from: null, to: null, label: 'all time' }),
}

function resolveRange(key) {
  const build = RANGES[key] ?? RANGES.this_week
  return build(shiftedNow())
}

/* ------------------------------------------------------------------ */
/* Controlled retrieval                                                */
/* ------------------------------------------------------------------ */

/**
 * Every intent declares the exact columns it may read. Nothing selects `*`,
 * so a customer's phone number cannot reach the model as a side effect of
 * someone asking about job counts.
 */
const JOB_COLUMNS = 'order_no, service_type, status, assigned_technician, final_amount, completed_at'

function client() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured on the server.')
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/** Completed jobs inside a window, optionally for one technician. */
async function fetchCompleted({ range, technician = null, limit = 200 }) {
  let query = client().from('orders').select(JOB_COLUMNS).in('status', COMPLETED)

  if (technician) query = query.eq('assigned_technician', technician)
  if (range.from) query = query.gte('completed_at', range.from.toISOString())
  if (range.to) query = query.lt('completed_at', range.to.toISOString())

  const { data, error } = await query.order('completed_at', { ascending: false }).limit(limit)
  if (error) throw new Error(`Could not read orders: ${error.message}`)

  return {
    rows: data ?? [],
    descriptor: {
      table: 'orders',
      columns: JOB_COLUMNS.split(', '),
      filters: [
        `status in (${COMPLETED.join(', ')})`,
        technician ? `assigned_technician = ${technician}` : null,
        range.from ? `completed_at >= ${range.from.toISOString()}` : null,
        range.to ? `completed_at < ${range.to.toISOString()}` : null,
      ].filter(Boolean),
      limit,
    },
  }
}

async function roster() {
  const { data, error } = await client().from('technicians').select('name').order('name')
  if (error || !data?.length) return ['Ali', 'John', 'Bala', 'Yusoff']
  return data.map((t) => t.name)
}

const sum = (rows) => rows.reduce((t, r) => t + Number(r.final_amount || 0), 0)

function tally(rows, names) {
  const counts = new Map(names.map((n) => [n, { technician: n, jobs: 0, total: 0 }]))
  for (const row of rows) {
    const key = row.assigned_technician
    if (!key) continue
    if (!counts.has(key)) counts.set(key, { technician: key, jobs: 0, total: 0 })
    const entry = counts.get(key)
    entry.jobs += 1
    entry.total += Number(row.final_amount || 0)
  }
  return [...counts.values()].sort((a, b) => b.jobs - a.jobs)
}

/* ------------------------------------------------------------------ */
/* Intents — the whole supported surface, in one place                 */
/* ------------------------------------------------------------------ */

const INTENTS = {
  jobs_by_technician: {
    label: 'Jobs completed by one technician',
    needsTechnician: true,
    run: async ({ technician, range }) => {
      const { rows, descriptor } = await fetchCompleted({ range, technician })
      return {
        descriptor,
        rows,
        facts: {
          technician,
          period: range.label,
          jobs_completed: rows.length,
          total_amount_myr: sum(rows),
          jobs: rows.map((r) => ({
            order_no: r.order_no,
            service: r.service_type,
            amount_myr: Number(r.final_amount || 0),
          })),
        },
      }
    },
    fallback: (f) =>
      f.jobs_completed === 0
        ? `${f.technician} completed no jobs ${f.period}.`
        : `${f.technician} completed ${f.jobs_completed} job${
            f.jobs_completed === 1 ? '' : 's'
          } ${f.period}, totalling RM ${f.total_amount_myr.toFixed(2)}:\n` +
          f.jobs.map((j) => `${j.order_no} – ${j.service ?? 'Service'}`).join('\n'),
  },

  top_technician: {
    label: 'Highest number of completed jobs',
    run: async ({ range }, names) => {
      const { rows, descriptor } = await fetchCompleted({ range })
      const board = tally(rows, names)
      // Nobody leads a week with no completed work. Sending a zero-job
      // "leader" invites the model to announce one.
      const leader = board[0]?.jobs ? board[0] : null
      return {
        descriptor,
        rows,
        facts: { period: range.label, leaderboard: leader ? board : [], leader },
      }
    },
    fallback: (f) =>
      !f.leader || f.leader.jobs === 0
        ? `No jobs were completed ${f.period}, so there is no leader.`
        : `${f.leader.technician} completed the most jobs ${f.period} — ${
            f.leader.jobs
          }, worth RM ${f.leader.total.toFixed(2)}.`,
  },

  jobs_completed_count: {
    label: 'Count of completed jobs',
    run: async ({ range, technician }) => {
      const { rows, descriptor } = await fetchCompleted({ range, technician })
      return {
        descriptor,
        rows,
        facts: {
          period: range.label,
          technician: technician ?? 'all technicians',
          jobs_completed: rows.length,
          total_amount_myr: sum(rows),
        },
      }
    },
    fallback: (f) =>
      `${f.jobs_completed} job${f.jobs_completed === 1 ? '' : 's'} completed ${f.period} by ${
        f.technician
      }, totalling RM ${f.total_amount_myr.toFixed(2)}.`,
  },

  technician_workload: {
    label: 'Workload spread across the team',
    run: async ({ range }, names) => {
      const { rows, descriptor } = await fetchCompleted({ range })
      const board = tally(rows, names)
      const average = board.length ? rows.length / board.length : 0
      return {
        descriptor,
        rows,
        facts: {
          period: range.label,
          team_average_jobs: Number(average.toFixed(1)),
          workload: board,
          // "Overloaded" is a threshold decided here, not by the model.
          overloaded: board.filter((t) => average > 0 && t.jobs >= average * 1.3 && t.jobs > 1),
        },
      }
    },
    fallback: (f) =>
      f.overloaded.length
        ? `${f.overloaded
            .map((t) => `${t.technician} completed ${t.jobs} jobs`)
            .join('; ')} ${f.period}, against a team average of ${f.team_average_jobs}.`
        : `Workload looks even ${f.period} — the team average is ${f.team_average_jobs} jobs each.`,
  },
}

const CAPABILITIES = Object.values(INTENTS).map((i) => i.label)

/* ------------------------------------------------------------------ */
/* The model calls                                                     */
/* ------------------------------------------------------------------ */

async function gemini(prompt, { json = false } = {}) {
  if (!GEMINI_KEY) throw new Error('no-key')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: json ? 0 : 0.2,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    },
  )

  if (!res.ok) throw new Error(`gemini-${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('gemini-empty')
  return text.replace(/```json|```/g, '').trim()
}

/** Step 1 — sentence in, intent + parameters out. Nothing else. */
async function classify(question, names) {
  const prompt = `You route questions for an air-conditioner service company's operations system.
Return JSON only: {"intent": "...", "technician": "..." | null, "range": "..."}

intent must be one of: ${Object.keys(INTENTS).join(', ')}, unsupported
range must be one of: ${Object.keys(RANGES).join(', ')}   (default this_week when the question gives no period)
technician must be exactly one of: ${names.join(', ')} — or null if the question names no one on that list.

Use "unsupported" for anything that is not about counting or listing completed jobs,
or that names a person who is not on the list.

Question: "${question}"`

  return JSON.parse(await gemini(prompt, { json: true }))
}

/** Keyword routing, used when the model is unavailable or out of quota. */
function classifyLocally(question, names) {
  const q = question.toLowerCase()
  const technician = names.find((n) => q.includes(n.toLowerCase())) ?? null

  const range =
    (q.includes('last week') && 'last_week') ||
    (q.includes('yesterday') && 'yesterday') ||
    (q.includes('today') && 'today') ||
    (q.includes('month') && 'this_month') ||
    ((q.includes('all time') || q.includes('overall') || q.includes('ever')) && 'all_time') ||
    'this_week'

  const intent = /overload|workload|busiest|spread|too many/.test(q)
    ? 'technician_workload'
    : /most|top|best|highest|leader/.test(q)
      ? 'top_technician'
      : /how many|count|total number/.test(q)
        ? 'jobs_completed_count'
        : technician
          ? 'jobs_by_technician'
          : 'unsupported'

  return { intent, technician, range }
}

/** Step 4 — phrase the computed facts. The model sees nothing else. */
async function phrase(question, facts) {
  const prompt = `You are an operations assistant for an air-conditioner service company.
Answer the manager's question using ONLY the JSON facts below.
Never invent a number, a name or an order number that is not in the JSON.
Refer to people by name only. Never use he/she/his/her — the roster carries names, not genders.
Amounts are Malaysian ringgit; write them as "RM 210.00".
Be direct: two sentences at most, then list order numbers on their own lines if the JSON has them.

Question: "${question}"
Facts: ${JSON.stringify(facts)}`

  return gemini(prompt)
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const question = String(req.body?.question ?? '').trim()
  if (!question) return res.status(400).json({ error: 'Ask a question.' })
  if (question.length > 300) return res.status(400).json({ error: 'Question is too long.' })

  try {
    const names = await roster()

    let route
    let routedBy = 'model'
    try {
      route = await classify(question, names)
    } catch {
      route = classifyLocally(question, names)
      routedBy = 'keywords'
    }

    const intent = INTENTS[route.intent]
    if (!intent) {
      return res.status(200).json({
        intent: 'unsupported',
        answer:
          'I can only answer questions about completed jobs — how many, by whom, and how the workload is spread. Try "How many jobs did Ali complete last week?"',
        capabilities: CAPABILITIES,
        routedBy,
      })
    }

    // A name from the model is only ever used after it matches the roster.
    const technician = route.technician
      ? (names.find((n) => n.toLowerCase() === String(route.technician).toLowerCase()) ?? null)
      : null

    if (intent.needsTechnician && !technician) {
      return res.status(200).json({
        intent: route.intent,
        answer: `I could not match that name to the roster. The technicians on file are ${names.join(
          ', ',
        )}.`,
        capabilities: CAPABILITIES,
        routedBy,
      })
    }

    const range = resolveRange(route.range)
    const { descriptor, rows, facts } = await intent.run({ technician, range }, names)

    let answer
    let phrasedBy = 'model'
    try {
      answer = await phrase(question, facts)
    } catch {
      answer = intent.fallback(facts)
      phrasedBy = 'computed'
    }

    return res.status(200).json({
      answer,
      intent: route.intent,
      intentLabel: intent.label,
      params: { technician, range: range.label },
      retrieval: { ...descriptor, rowCount: rows.length },
      rows: rows.slice(0, 20),
      facts,
      routedBy,
      phrasedBy,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
