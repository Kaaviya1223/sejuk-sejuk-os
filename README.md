# Sejuk Sejuk Ops — Service Operations System

An internal operations tool for an air-conditioner service company: an admin
creates a service order, a technician completes the job in the field, and the
record — evidence photos, final amount, payment, audit trail — comes back to
the office.

**Scope of this submission: Modules 1, 2 and 3, the KPI dashboard, and the AI
Operations Query Window** — including every WhatsApp bonus. Two of the three
optional advanced AI challenges are covered as well: the workflow supervisor
and operational insight. Document understanding is not. See
[What is not built](#what-is-not-built).

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in your Supabase URL + publishable key
npm run dev               # http://localhost:5173
```

### Apply the database migration (one paste)

The app connects with a Supabase **publishable** key, which can read and write
rows but cannot create tables, columns or storage buckets. Open the Supabase
dashboard → **SQL Editor** → **New query**, paste
[`supabase/schema.sql`](supabase/schema.sql), and run it. It is idempotent, so
re-running is safe.

The migration adds:

| Object | Purpose |
| --- | --- |
| new columns on `orders` | `branch`, `extra_charges`, payment fields, `completed_by`, `reschedule_count`, review/close timestamps |
| `job_files` | one row per uploaded photo / video / PDF, pointing at Storage |
| `audit_log` | who did what to which order, and when |
| `notifications` | every WhatsApp message the system generated |
| `technicians` | the roster used by the mock login (Ali, John, Bala, Yusoff) |
| `job-files` bucket | Supabase Storage for service evidence and receipts |
| a `CHECK` constraint | so an invalid workflow status can never be written |

**The app works before you run it.** Writes retry without any column the
database doesn't have yet, and the UI shows a banner naming what's missing.
You can create and complete orders immediately; the extra fields simply start
persisting once the migration lands, with no code change. This is deliberate —
a reviewer should not hit a wall on first load.

---

## What was built

### Module 1 — Admin Portal (order submission)

- Create order with all required fields: **auto-generated order no**, customer
  name, phone, address, problem description, service type, quoted price,
  assigned technician, admin notes — plus branch and a scheduled date.
- **Order summary after submission** (bonus): a confirmation panel showing the
  new order number, customer, price and resulting status.
- **WhatsApp notification to the technician** (bonus): assigning a technician
  renders a full job brief — address, phone, issue, quote, office notes — as a
  `wa.me` deep link, previewed in full before sending.
- Order list with search (order no / customer / phone / address) and filters by
  status and technician. Table on desktop, cards on mobile.
- Order detail sheet: full record, uploaded files, WhatsApp history, audit
  trail, and reassignment.

### Module 2 — Technician Portal (service job)

Mobile-first, on its own chrome: no sidebar, thumb-sized targets, sticky action
bar with safe-area padding.

- Only jobs assigned to the signed-in technician are **fetched at all** — the
  rule "only the assigned technician may complete a job" is enforced by not
  loading anyone else's work, not by hiding a button.
- Job cards with tap-to-navigate address (Google Maps) and tap-to-call phone.
- **Start job** → `In Progress`, then **Complete job**:
  - Order ID, technician name and timestamp are read-only / derived, never typed
  - Work done (required), extra charges, remarks
  - **Up to 6 photos / videos / PDFs**, camera capture on mobile, with local
    thumbnails and per-file removal before upload
  - **Final amount auto-calculated** (quoted + extras), always visible in the
    footer as you type
- **Payment capture** (bonus): amount, method, receipt photo, notes — collapsed
  by default so the common path stays short.
- **Postpone / reschedule** with a reason, which increments a counter.
- **WhatsApp feedback message to the customer** (bonus) plus a completion notice
  for the manager / accounts, both rendered on submission.

### Module 3 — WhatsApp notification trigger

[`api/notify.js`](api/notify.js) is a serverless endpoint that fires the
customer feedback request and the manager completion notice. It takes an order
id, **re-reads the order and checks `status = 'Job Done'` itself** rather than
believing the caller, so a client cannot fire "your job is complete" at a
customer whose job is still open. It refuses with a 409 that names the actual
status.

The top bar carries the feed of everything generated, with a count of what has
not gone out yet. "Unread" means *undispatched*: delivery is a human tapping a
`wa.me` link, so the app stamps `sent_at` at the moment someone opens it — the
only point at which it can honestly claim a message was sent.

It renders from the same template module the UI previews from, records each
message to `notifications`, and returns the deep links. A second call for the
same order returns what was already sent instead of notifying twice; `force`
overrides that for a deliberate resend. Job completion calls this endpoint and
falls back to building the messages client-side if it is unreachable, so a
technician never loses a write-up to a missing side effect.

### Bonus — KPI dashboard

A **Performance** page for Admin and Manager: jobs completed, value collected,
postponements, and a leaderboard ranked by jobs with value as the tie-break.
The period selector covers this week, last week, this month and all time —
weeks start Monday. Completed jobs are dated by completion, everything else by
when it was raised.

### Advanced AI — Workflow Supervisor

A **Needs attention** card on the dashboard, backed by
[`api/supervise.js`](api/supervise.js). It re-reads completed jobs and applies
four rules, each stating its own threshold in code:

| Rule | Fires when |
| --- | --- |
| Over quote | final is 30% above quoted **and** at least RM 50 over — a ratio alone flags a RM 20 job |
| No evidence | completed with zero files in `job_files` |
| Postponed repeatedly | `reschedule_count` ≥ 2 |
| Waiting on review | `Job Done` for 3 days or more |

The rules are the flags; the model writes only the one-line triage at the top,
and the card says when it wrote itself instead. A supervisor that quietly
changes its mind about what "much higher than quoted" means is not a
supervisor, so the thresholds live in `RULES` where they can be read and
argued with. Missing `job_files` means "cannot tell" rather than "no evidence",
so the rule sits out rather than flagging every job.

### Manager — review queue

Managers own the last three steps of the workflow, but until now they signed
off from inside an order sheet reached through the same list an admin uses for
intake — two roles, one screen, no sense that they do different jobs.

**Review queue** is a manager-only page holding everything at `Job Done`, with
the decision and the evidence for it on one screen: quoted against final with
the variance called out, what the technician wrote, and the photos or documents
they attached. Approve or reopen inline, with an optional review note. Cards
whose amount ran over quote, or that arrived with nothing attached, carry the
alert accent.

The dashboard also opens differently per role: an admin's day starts with work
coming in ("3 orders with no technician assigned"), a manager's with work
waiting to be signed off ("6 completed jobs waiting for your review"), each
with a way straight there.

### AI Module — Operations Query Window

A manager-only side panel answering four kinds of operational question from
live data. The model classifies the question and phrases the result; the query
and every number in between are server-side code. Each answer shows the exact
retrieval behind it. Full detail, including what it cannot do, is in
[AI module](#ai-module--operations-query-window).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Front-end | React 19 + Vite |
| Styling | Tailwind CSS 3 |
| Database | Supabase (Postgres + PostgREST) |
| File storage | Supabase Storage |
| Icons | lucide-react |
| AI | Google Gemini via a serverless function in `api/` |
| Login | Mock session with role switcher |
| Deployment | Vercel-ready static build |

---

## Architecture decisions

**All data access lives in `src/lib/orders.js`.** Components never touch the
Supabase client. Workflow rules, audit writes and notification rendering stay
in one reviewable module instead of being scattered across pages — so "what
happens when a job is completed" is answerable by reading one function.

**The workflow is a declared state machine, not scattered conditionals.**
`src/lib/constants.js` declares every legal transition together with the roles
allowed to make it and whether the actor must be the assigned technician:

```
New → Assigned → In Progress → Job Done → Reviewed → Closed
```

Work also moves backwards, because real work does: an admin can unassign or
postpone, and a manager reviewing a job can send it back to the technician
(`Job Done → In Progress`) or reopen one already reviewed. Those paths are
declared beside the forward ones, so a page cannot invent a move the rules do
not allow — the review queue renders its buttons from `allowedTransitions`
rather than hardcoding Approve and Reject.

`allowedTransitions(order, role, technicianName)` is the only thing that
decides which action buttons render, so the UI cannot offer an illegal move.
The database enforces the same status vocabulary with a `CHECK` constraint.

**The mock session carries an identity, not just a role.** Picking
"Technician" also picks *which* technician, because "only the assigned
technician may complete this job" is meaningless without one. Every write
stamps this actor onto the audit trail. Swapping in Supabase Auth means
replacing one provider's internals.

**Sequential order numbers.** The starting code generated `ORDER` + a random
4-digit number, which collides roughly once every 40 orders once a few thousand
exist. Now the highest existing number is read and incremented, with a unique
constraint plus retry covering two admins submitting at once.

**Writes degrade instead of failing.** `writeWithSchemaFallback` retries a
write without any column PostgREST reports as unknown, and returns what it had
to drop so the UI can say "saved, but these fields weren't stored" rather than
silently losing data or refusing to work.

**Job completion never fails on a non-essential step.** Evidence upload
failures are collected and reported per file rather than aborting the
submission; notification logging is best-effort. A technician standing in a
customer's hallway must not lose their write-up because a side effect timed
out.

**Two shells, one codebase.** Admin and manager get a sidebar layout; the
technician role renders an entirely different chrome. The brief says admin
staff are on desktops and technicians are on phones, so they get genuinely
different navigation rather than one layout squeezed down.

**Light and dark are one set of class names.** The semantic tokens — surface,
canvas, ink, muted, hairline, and the tint steps — are CSS variables consumed
through Tailwind (`rgb(var(--surface) / <alpha-value>)`), so `bg-surface` and
`text-ink` resolve per theme and opacity modifiers still work. Around 320 usages
across 16 files therefore flip without a single `dark:` variant; the handful of
fixed tints that a variable can't reach (status chips, alert tones) carry
explicit dark steps.

The dark palette is **selected, not inverted**. Surfaces are cool navy so they
sit under the same brand gradient, ink was picked against that surface, and the
six status hues use their own dark steps — flipping a categorical palette by
lightness is what makes dark-mode charts muddy. The theme follows the OS until
someone chooses, after which their choice sticks.

**Blue leads, teal supports, green is spent only on "finished".** An earlier
pass used green as the brand accent, which put it on the sidebar, the icon
chips and the card rules — and also on the Complete job button and the Closed
badge. When everything is green, green stops meaning done. So the chrome is now
deep blue with an aircon-cold teal (the company is called *Sejuk* — cool — and
sells cooling), and `success` is a reserved token that appears on exactly three
things: the button that finishes a job, the manager's review/close actions, and
the Closed state. Nothing decorative may wear it.

**One status colour, everywhere.** `src/lib/palette.js` is the single source of
the six status hues, read by both the badges and the dashboard figures, so a
status never means one colour in the table and another in a chart. The six were
checked for colour-blind separation against the white card surface (worst
adjacent pair ΔE 9.1 simulated, 19.6 unsimulated); three of them fall below 3:1
contrast on white, which is why every figure that uses them prints the count
next to the swatch instead of leaving identity to the fill.

### Project layout

```
src/
  lib/         constants.js (workflow rules) · orders.js (all data access)
               whatsapp.js (message templates) · format.js · supabase.js
               palette.js (status colours shared by badges and charts)
  context/     SessionContext.jsx (mock login) · session.js (hook)
  components/  ui.jsx (design primitives) · charts.jsx (dashboard figures)
               AssistantPanel.jsx (AI query window) · NotificationBell.jsx
               OrderList · OrderDetailSheet · JobCompletionSheet
               WhatsAppPreview · StatusBadge · StatusTrack
  pages/       Overview.jsx · AdminOrders.jsx · TechnicianPortal.jsx
               ReviewQueue.jsx (manager sign-off) · Performance.jsx (KPI)
api/
  notify.js    Module 3: the Job Done WhatsApp trigger
  query.js     the AI endpoint: classify → retrieve → compute → phrase
supabase/
  schema.sql   the one-paste migration
```

---

## WhatsApp notifications

Implemented as the Module 1 and Module 2 **bonuses** — a technician job brief
on assignment, and a customer feedback request plus manager/accounts notice on
completion. The completion pair is fired by the Module 3 server-side trigger,
which checks the status condition itself; see
[`api/notify.js`](api/notify.js). Messages are rendered from templates in `src/lib/whatsapp.js` and
delivered as `wa.me` deep links with the text pre-filled.

The message is always shown in full next to the send button rather than hidden
behind it: staff are about to send this to a paying customer, and a pre-filled
WhatsApp draft stays editable, so they should read it first. Every generated
message is written to `notifications` so the history is auditable even though
delivery is a manual tap.

Numbers are normalised to the `wa.me` format (`012-345 6789` → `60123456789`).
Orders without a phone number still produce a working link — WhatsApp opens and
asks the sender to pick a contact.

---

## AI module — Operations Query Window

A manager-only side panel, opened with **Ask** in the top bar. It sits beside
the work rather than on its own page: the questions it answers ("who is
overloaded this week?") get asked *while* looking at the dashboard or an order,
so making someone navigate away to ask and back to act was the wrong shape.

### How it works

The endpoint is [`api/query.js`](api/query.js), a serverless function. Four
steps, and the model is only trusted with two of them:

```
question → 1. classify (model)  → intent + parameters
         → 2. retrieve (server) → one declared query, fixed columns, bounded window
         → 3. compute (server)  → counts and totals, in JavaScript
         → 4. phrase (model)    → a sentence around those numbers
```

**The model never sees the database and never produces a figure.** It turns a
sentence into an intent, and later turns computed facts into prose. Everything
between is ordinary server code. A hallucination can therefore change the
wording of an answer but never the number in it.

**Retrieval is controlled, not open-ended.** Each intent declares the table, the
exact column list, the date window and a row cap; nothing selects `*`, so a
customer's phone number cannot reach the model because someone asked about job
counts. A technician name coming back from the classifier is only used after it
matches a row in `technicians` — the model cannot invent a filter value.

**Every answer carries its own receipt.** The response body includes the
retrieval descriptor — table, columns, filters, row count — and the rows it
counted, so the claim is auditable rather than asserted. The panel itself shows
the intent it was read as, the period and the row count; the column list stays
in the response rather than on screen, because it is developer language in a
tool built for operations staff.

### What you can ask

| Intent | Example |
| --- | --- |
| `jobs_by_technician` | What jobs did Ali complete last week? |
| `top_technician` | Which technician completed the most jobs this week? |
| `jobs_completed_count` | How many jobs were completed today? |
| `technician_workload` | Which technician might be overloaded this week? |

Periods understood: today, yesterday, this week, last week, this month, all
time. Weeks start on Monday and "today" means today in UTC+8.

Conversation is answered by the model in its own words. "Nice to meet you"
deserves a reply rather than a capability list, and no pattern list covers every
pleasantry. Anything plainly not a data question goes to the model with **no
data in the prompt** and an instruction never to state a number, name, order or
date — it can be warm, it cannot make a claim about the company's work. Fixed
replies for "hi", "thanks" and "what can you do?" stand in when the model is
unavailable. A greeting wrapped around a real question ("hi, how many jobs
today?") is treated as the question.

Anything else is refused before a query runs, with a list of what the assistant
does support — it does not guess. Off-topic questions ("what is the weather?"),
a name that is not on the roster, and an instruction to ignore its instructions
all return the same refusal, having touched no data.

The keyword router carries an explicit off-scope list too, because "how many
customers do we have?" shares its wording with a job count: answering that from
job rows would be a confident answer to a different question, which is worse
than a refusal. Branches, customers, revenue, invoices and stock are all named
as out of scope.

### Limitations

- **Four intents, and that is the whole surface.** "Which branch is busiest?"
  or "show me unassigned orders" are not supported. Adding one is adding an
  entry to `INTENTS` with its own declared query — deliberately not a
  free-form text-to-SQL layer, which is what would make an unbounded question
  set possible and an unbounded blast radius with it.
- **Completed work only.** Every intent filters to `Job Done`, `Reviewed`,
  `Closed`, so open jobs are invisible to it.
- **No conversation memory.** Each question is answered on its own; "and what
  about last month?" will not resolve.
- **Free-tier quota.** Google AI Studio meters per model, so `callGemini` walks
  a short list — the configured model, then lighter ones — before giving up, and
  one model's exhausted quota no longer costs the whole feature. When every one
  is out, the endpoint routes by keyword and phrases the answer from a template
  instead — the numbers are identical because they were never the model's to
  begin with. The response marks this (`routedBy`, `phrasedBy`) and the UI shows
  a badge, so a degraded answer is never passed off as a full one.
- **200-row cap per query.** Beyond that the counts would under-report; at real
  volume this belongs in a Postgres aggregate rather than a row fetch.
- **No auth on the endpoint.** It answers anyone who can POST to it. Real
  deployment needs the session's role checked server-side.

---

## Assumptions

- Single company, roster of four technicians. Branches exist as a field on the
  order but there is no per-branch access control.
- Currency is MYR; dates render in `en-MY`.
- Quoted price is agreed up front, so **final amount = quoted + extra charges**.
  There is no discount or line-item path.
- One technician per order; no crews or job splitting.
- Manager review actions exist in the detail sheet because the status machine
  defines them, but there is no dedicated review-queue page (that was the
  bonus module).

---

## Limitations

- **No real authentication.** The role switcher is a mock login stored in
  `localStorage`. Anyone can become any role.
- **RLS is permissive by design.** `supabase/schema.sql` enables row-level
  security but grants the anonymous role full access, because there are no real
  user identities to check against. Production would replace every
  `USING (true)` with a check on `auth.uid()` and the user's role. Until then
  the publishable key can read and write all rows — fine for an assessment
  build, not for real customer data.
- **Workflow rules are enforced in the client**, apart from the status `CHECK`
  constraint. A crafted request could still make an illegal transition. Real
  enforcement belongs in RLS policies or Postgres functions.
- **The storage bucket is public.** Anyone with the URL can read an uploaded
  photo. Signed URLs would be the fix.
- **No optimistic-concurrency control.** Two people editing the same order
  last-write-wins.
- **File uploads are not resumable** and there is no client-side image
  compression, which matters on a weak mobile connection — a technician
  uploading six full-resolution photos on 4G will wait.
- **Order lists load up to 200 rows** with no pagination.
- **No automated tests.** The data layer was verified manually against the live
  database (order-number generation, full status lifecycle, schema fallback);
  the UI was not.

---

## What is not built

- **Real WhatsApp delivery.** The trigger generates, records and returns a
  `wa.me` deep link; a human still taps send. There are no WhatsApp Business
  API credentials for this build, and the brief accepts a deep link. Swapping in
  a provider means replacing one function in `api/notify.js`.
- **AI document understanding** — the third advanced challenge. Extracting
  fields from an uploaded invoice needs a vision call per document, and the
  evidence already arrives as structured fields typed by the technician, so it
  would be re-deriving what the form already collected. The other two advanced
  challenges are built: the workflow supervisor above, and operational insight
  via the `technician_workload` intent, which flags anyone running 30% above
  the team average.

---

## Self-assessment

**Easiest module.** Module 1. Order intake is a form and an insert; the
interesting decisions were about what to derive rather than ask for, and
putting creation in a sheet so the admin keeps the order list in view.

**Hardest module.** Module 2 — not technically, but in judgement. A completion
form is easy to make thorough and miserable to use one-handed on a phone in
someone's hallway. Deciding what to derive (order no, technician, timestamp,
final amount), what to make optional (payment, collapsed by default), and what
to require (only "work done") took the most iteration. The upload path also
needed the most care: partial failures are reported per file instead of losing
the whole submission.

**What I would improve in production.**

1. Real auth with RLS policies keyed to `auth.uid()`, so the workflow rules are
   enforced by the database rather than trusted from the client.
2. Move aggregation into Postgres views / RPCs before any dashboard is built —
   summing in the browser stops working at a few thousand orders.
3. Client-side image compression and resumable uploads before this touches a
   real 4G connection.
4. Signed URLs for evidence files instead of a public bucket.
5. Automated tests around the state machine and the money arithmetic — the two
   places where a silent bug costs real money.

**How AI tools were used.** This implementation was built with Claude Code.
The parts that needed human judgement — and got it — were the workflow state
machine, the decision to derive rather than collect fields in the technician
form, and the schema-fallback behaviour, which came from actually probing the
live database and finding that none of the new columns existed yet.
