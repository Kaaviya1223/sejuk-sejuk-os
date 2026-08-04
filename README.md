# Sejuk Sejuk Ops

An internal operations system for an air-conditioner service company. An admin
raises a service order, a technician does the job in the field and records what
happened, and the office gets back the evidence, the final amount and a
traceable history.

**Repo:** https://github.com/Kaaviya1223/utopia-ops-assessment
**Live demo:** _add your Vercel URL here_

**What is covered:** Module 1, Module 2 and Module 3, plus both WhatsApp
bonuses, the KPI dashboard, the AI Operations Query Window, and two of the three
advanced AI challenges (workflow supervisor and operational insight). AI
document understanding is not built, and the reason is in
[What is not built](#what-is-not-built).

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in Supabase URL + key, and a Gemini key
npm run dev               # http://localhost:5173
```

Use `npm run dev`, not `npm run preview`. The `api/` folder holds serverless
functions, and `preview` only serves the built static files, so the assistant
and the supervisor will report that their endpoint is missing.

### Run the database migration once

The app connects with a Supabase publishable key. That key can read and write
rows but cannot create tables or storage buckets, so the schema is a manual
step. Open the Supabase dashboard, go to SQL Editor, paste
[`supabase/schema.sql`](supabase/schema.sql) and run it. It is safe to run more
than once.

It creates the `job_files`, `audit_log`, `notifications` and `technicians`
tables, adds the newer columns to `orders`, creates the `job-files` storage
bucket, and adds a `CHECK` constraint so an invalid status can never be stored.

The app still works before you run it. Writes retry without any column the
database does not have yet, and a banner names what is missing. Orders can be
created and completed straight away, and the extra fields start persisting once
the migration lands, with no code change.

---

## What I built

### Module 1: Admin Portal

Create an order with an auto-generated order number, customer name, phone,
address, problem description, service type, quoted price, assigned technician
and admin notes, plus a branch and a scheduled date.

Both bonuses are included. After saving, a confirmation panel shows the new
order number, customer, price and resulting status. Assigning a technician
builds a WhatsApp job brief with the address, phone, issue, quote and office
notes, and renders it as a `wa.me` link.

The order list has search across order number, customer, phone and address, and
filter chips per status that carry their own counts. It is a table on desktop
and cards on mobile. Opening an order shows the full record, its files, its
WhatsApp history and its audit trail.

### Module 2: Technician Portal

Mobile first, with its own chrome. No sidebar, large tap targets, and a sticky
action bar with safe-area padding.

Only jobs assigned to the signed-in technician are fetched at all. The rule
"only the assigned technician may complete a job" is enforced by never loading
anyone else's work rather than by hiding a button.

Job cards tap through to Google Maps and to the phone dialler. Start job moves
the order to In Progress. Complete job collects the work done (the only required
field), extra charges, remarks, and up to six photos, videos or PDFs with camera
capture on mobile. Order number, technician name, timestamp and final amount are
derived rather than typed, and the running final amount stays visible in the
footer.

Both bonuses are included. Payment capture (amount, method, receipt photo,
notes) sits collapsed by default so the common path stays short, and completing
a job produces a customer feedback message and a manager notice.

### Module 3: WhatsApp notification trigger

[`api/notify.js`](api/notify.js) is a serverless endpoint. Give it an order id
and it re-reads the order and checks `status = 'Job Done'` itself instead of
trusting the caller, so a client cannot fire "your job is complete" at a
customer whose job is still open. It refuses with a 409 naming the actual
status.

Messages come from the same template module the UI previews from, so what staff
read on screen is what the endpoint logs. A second call for the same order
returns what was already sent rather than notifying twice, unless `force` is
passed. Job completion calls this endpoint and falls back to building the
messages in the browser if it is unreachable.

Delivery is a `wa.me` deep link, which the brief allows. There are no WhatsApp
Business API credentials for this build.

### Bonus: KPI dashboard

A Performance page for admins and managers: jobs completed, value collected,
postponements, and a leaderboard ranked by jobs with value as the tie-break.
Periods are this week, last week, this month and all time. Weeks start on
Monday.

### Manager: review queue

Managers own the last three steps of the workflow, so they get a page built
around that. Everything at Job Done in one list, with the decision and its
evidence side by side: quoted against final with the variance called out, the
technician's write-up, and the files they attached. Approve or send back inline,
with an optional review note.

The dashboard also opens on a different line for each role. An admin sees
unassigned work, a manager sees work waiting for sign-off.

### AI: Operations Query Window

A manager-only side panel, opened with Ask in the top bar. Details are in
[AI integration](#ai-integration).

### Advanced AI: Workflow Supervisor

A "Needs attention" card on the dashboard, backed by
[`api/supervise.js`](api/supervise.js). It checks completed jobs against four
rules, each with its threshold written in code:

| Rule | Fires when |
| --- | --- |
| Over quote | final is at least 30% and RM 50 above the quote |
| No evidence | completed with no file attached |
| Postponed repeatedly | rescheduled twice or more |
| Waiting on review | Job Done for three days or more |

The rules produce the flags. The model only writes the one-line summary at the
top, and the card says when that summary was written without it.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Front end | React 19 with Vite |
| Styling | Tailwind CSS 3, Inter throughout |
| Database | Supabase (Postgres and PostgREST) |
| File storage | Supabase Storage |
| AI | Google Gemini, called from serverless functions in `api/` |
| Icons | lucide-react |
| Login | Mock session with a role switcher |
| Deployment | Vercel |

---

## Architecture decisions

**All data access sits in `src/lib/orders.js`.** Components never touch the
Supabase client. Workflow rules, audit writes and notification building stay in
one file, so "what happens when a job is completed" is answered by reading one
function.

**The workflow is a declared state machine.** `src/lib/constants.js` lists every
legal transition with the roles allowed to make it and whether the actor must be
the assigned technician:

```
New -> Assigned -> In Progress -> Job Done -> Reviewed -> Closed
```

Work also moves backwards, because real work does. An admin can unassign or
postpone. A manager can send a job back to the technician, or reopen one already
reviewed. `allowedTransitions()` is the only thing that decides which buttons
render, so a page cannot offer an illegal move. I got this wrong once: the
review queue had its own hardcoded Reopen button that set a Job Done order to
Job Done and quietly did nothing. Both pages now render their buttons from the
state machine.

**The mock session carries an identity as well as a role.** Choosing Technician
also chooses which technician, because "only the assigned technician may
complete this job" means nothing without one. Every write stamps that actor onto
the audit trail.

**Order numbers are sequential.** The starting code generated `ORDER` plus four
random digits, which collides about once every 40 orders once a few thousand
exist. The highest existing number is now read and incremented, with a unique
constraint and a retry for two admins saving at the same moment.

**Writes degrade instead of failing.** `writeWithSchemaFallback` retries a write
without any column PostgREST reports as unknown, and returns what it dropped so
the UI can say "saved, but these fields were not stored".

**Job completion never fails on a side effect.** Upload failures are reported
per file rather than losing the whole submission, and notification logging is
best effort. A technician standing in a customer's hallway should not lose their
write-up because something timed out.

**Two shells, one codebase.** Admins and managers get a sidebar layout. The
technician role renders completely different chrome, because the brief says
office staff are on desktops and technicians are on phones.

**One set of class names for light and dark.** The semantic colour tokens are
CSS variables read through Tailwind, so around 320 colour usages across 16 files
switch theme without a single `dark:` variant. The dark palette was chosen
against a dark surface rather than inverted, including the chart colours.

**The palette follows the brand spec.**

| Usage | Colour | Hex |
| --- | --- | --- |
| Primary navigation and buttons | Deep Blue | `#1565C0` |
| Secondary actions | Teal | `#00897B` |
| Page background | Light Grey | `#F4F7F9` |
| Cards and forms | White | `#FFFFFF` |
| Main text | Dark Navy | `#263238` |

Two working notes. White text on the teal measures 4.32:1, just under AA for
body size, so filled teal buttons use a slightly darker step at 5.32:1 and the
spec value stays for accents, icons and rules where nothing sits on top of it.
And green is reserved for one meaning: a job that is finished. It is not part of
the brand palette, and nothing decorative wears it.

**Status colours come from one file.** `src/lib/palette.js` is read by both the
badges and the charts, so a status never means one colour in a table and another
in a chart. The six were checked for colour-blind separation against the card
background, and three of them sit below 3:1 contrast, which is why every chart
prints the count next to the swatch.

### Project layout

```
src/
  lib/         constants.js (workflow rules), orders.js (all data access),
               whatsapp.js (message templates), gemini.js, palette.js,
               api.js, format.js, supabase.js
  context/     SessionContext.jsx (mock login), ThemeContext.jsx
  components/  ui.jsx (design primitives), charts.jsx, OrderList,
               OrderDetailSheet, JobCompletionSheet, WhatsAppPreview,
               AssistantPanel, SupervisorCard, NotificationBell
  pages/       Overview.jsx, AdminOrders.jsx, TechnicianPortal.jsx,
               ReviewQueue.jsx, Performance.jsx
api/
  notify.js    Module 3 trigger
  query.js     the assistant
  supervise.js the workflow supervisor
supabase/
  schema.sql   the migration
```

---

## WhatsApp notifications

Three messages: a job brief to the technician on assignment, and a feedback
request to the customer plus a notice to the manager on completion. Templates
live in `src/lib/whatsapp.js` and are delivered as `wa.me` links with the text
pre-filled.

The message is always shown in full next to the send button rather than hidden
behind it. Staff are about to send this to a paying customer, and a pre-filled
WhatsApp draft stays editable, so they should read it first. Every generated
message is written to `notifications`, so the history is auditable even though
sending is a manual tap.

The top bar carries a feed of everything generated, in two states, because a
deep link only supports two. Opening the link is observable, so that is recorded
as opened. Whether the message actually went is not observable at all: the
person may edit it, or close WhatsApp without sending. So they confirm it, with
a Mark as sent button. Nothing in the app claims delivery.

Real sent, delivered and read receipts need the WhatsApp Business Cloud API,
where messages go out over HTTP from the server and Meta posts status webhooks
back. That needs a Meta Business account, a registered number and approved
templates, which this build does not have.

Numbers are normalised for `wa.me` (`012-345 6789` becomes `60123456789`) and
displayed as `+60 12-345 6789`.

---

## AI integration

Two endpoints use a model, at three points in total. Everything else in the app
is ordinary code.

### The assistant: `api/query.js`

Four steps, and the model is trusted with two of them.

```
question -> 1. classify (model)   -> intent + parameters
         -> 2. retrieve (server)  -> one declared query, fixed columns, bounded window
         -> 3. compute (server)   -> counts and totals, in JavaScript
         -> 4. phrase (model)     -> a sentence around those numbers
```

**The model never sees the database and never produces a figure.** It turns a
sentence into an intent, then turns computed facts into prose. A hallucination
can change the wording of an answer but not the number in it.

**Retrieval is controlled.** Each intent declares its table, its exact column
list, its date window and a row cap. Nothing selects `*`, so a customer's phone
number cannot reach the model because somebody asked about job counts. A
technician name returned by the classifier is only used after it matches a row
in `technicians`, so the model cannot invent a filter value.

**Invented identifiers are checked for, not only forbidden.** Asked for a count,
where the facts contain no order numbers at all, the model once appended
"ORD-88902". The prompt already forbade that. So any order-number-shaped token
in a phrased answer is now checked against the facts the model was given, and an
answer that fails the check is thrown away for the computed one.

### What types of AI queries are supported

| Intent | Example |
| --- | --- |
| `jobs_by_technician` | What jobs did Ali complete last week? |
| `top_technician` | Which technician completed the most jobs this week? |
| `jobs_completed_count` | How many jobs were completed today? |
| `technician_workload` | Which technician might be overloaded this week? |

Periods understood: today, yesterday, this week, last week, this month, all
time. Weeks start on Monday, and "today" means today in UTC+8.

Conversation is answered by the model in its own words, with no data in the
prompt and an instruction never to state a number, name, order or date. So "nice
to meet you" gets a reply rather than a capability list, and it still cannot
make a claim about the company's work.

Anything else is refused before a query runs. That covers off-topic questions, a
name that is not on the roster, an instruction to ignore its instructions, and
questions about subjects the system does not model. "How many customers do we
have?" is refused rather than answered with a job count, because a confident
answer to a different question is worse than a decline.

### Limitations of the AI implementation

- **Four intents is the whole surface.** Adding a fifth means adding an entry to
  `INTENTS` with its own declared query. This is deliberately not a text-to-SQL
  layer, which is what would make the question set unbounded and the blast
  radius with it.
- **Completed work only.** Every intent filters to Job Done, Reviewed and
  Closed, so open jobs are invisible to it.
- **No conversation memory.** Each question is answered on its own, so "and what
  about last month?" will not resolve.
- **Free-tier quota.** Google meters quota per model, so `callGemini` tries a
  short list of models before giving up. When all of them are out, the endpoint
  routes by keyword and phrases from a template. The numbers are identical
  because they were never the model's to produce, and the response marks itself
  so a degraded answer is never passed off as a full one.
- **200 rows per query.** Beyond that the counts would under-report. At real
  volume this belongs in a Postgres aggregate.
- **No auth on the endpoint.** It answers anyone who can POST to it. A real
  deployment needs the session role checked server side.

---

## Challenges and assumptions

**Assumptions**

- One company with a roster of four technicians. Branch is a field on the order,
  but there is no per-branch access control.
- Currency is MYR and dates render in `en-MY`.
- The quoted price is agreed up front, so final amount is quote plus extras.
  There is no discount or line-item path.
- One technician per order. No crews and no job splitting.
- In the demo data, every phone number points at one handset, so a reviewer can
  tap a generated link and actually receive the message.

**Challenges**

The completion form was the hardest thing to get right, and the difficulty was
judgement rather than code. It is easy to make thorough and miserable to use
one-handed in somebody's hallway. Deciding what to derive, what to make
optional, and what to require took several passes.

The AI module was the other one. The brief warns against unrestricted database
access, and the obvious implementation, handing the model a table dump, is
exactly that. Declaring each query instead means the assistant answers less, but
what it answers can be checked.

Uploads needed care too. Partial failures are reported per file, because losing
a finished write-up over one failed photo is not acceptable.

---

## Limitations

- **No real authentication.** The role switcher is a mock login in
  `localStorage`. Anyone can become any role.
- **RLS is permissive by design.** `supabase/schema.sql` turns row level
  security on and then grants the anonymous role full access, because there are
  no real user identities to check against. Production would replace every
  `USING (true)` with a check on `auth.uid()` and the user's role.
- **Workflow rules are enforced in the client**, apart from the status `CHECK`
  constraint. A crafted request could still make an illegal transition. Real
  enforcement belongs in RLS policies or Postgres functions.
- **The storage bucket is public.** Anyone with the URL can read an uploaded
  photo. Signed URLs would fix that.
- **No optimistic concurrency.** Two people editing one order is last write
  wins.
- **Uploads are not resumable** and there is no image compression, which matters
  on a weak mobile connection.
- **Lists load up to 200 rows** with no pagination, and the dashboard sums in
  the browser.
- **No automated tests.** The data layer and the AI endpoints were checked by
  hand against the live database, including the order-number generation, the
  full status lifecycle, the schema fallback, and every supported question. The
  UI was checked by hand.

---

## What is not built

- **Real WhatsApp delivery, and therefore real delivery status.** The trigger
  generates, records and returns a `wa.me` link, and a human taps send. The app
  records that the link was opened and lets the sender confirm it went, which is
  as far as a deep link can go. Swapping in the Business API means replacing one
  function in `api/notify.js` and handling its status webhooks.
- **AI document understanding**, the third advanced challenge. Extracting fields
  from an uploaded invoice needs a vision call per document, and in this system
  the evidence already arrives as structured fields the technician typed, so it
  would re-derive what the form already collected.

---

## Self-assessment

**Which module was easiest?**

Module 1. Order intake is a form and an insert. The interesting decisions were
about what to derive rather than ask for, and about putting creation in a sheet
so the admin keeps the order list in view.

**Which module was hardest?**

The AI module, though not for the API call. The hard part was deciding what the
model is allowed to do. Letting it write queries would have supported far more
questions and made every answer untrustworthy. Restricting it to routing and
phrasing meant building the retrieval, the computation, the refusals, the
keyword fallback and the check on invented identifiers by hand. Module 2 was a
close second, for the reasons above.

**What would you improve in a real production system?**

1. Real auth with RLS policies keyed to `auth.uid()`, so the workflow rules are
   enforced by the database rather than trusted from the client.
2. Move aggregation into Postgres views or RPCs before the dashboard grows.
   Summing in the browser stops working at a few thousand orders.
3. Image compression and resumable uploads before this meets a real 4G
   connection.
4. Signed URLs for evidence files instead of a public bucket.
5. Automated tests around the state machine and the money arithmetic, which are
   the two places where a silent bug costs real money.
6. Server-side role checks on the `api/` endpoints.

**How did you use AI tools while building this project?**

I used Claude Code throughout, for the pages, the styling and the serverless
endpoints. I worked in a loop: describe what I wanted, review what came back,
run it, and correct it.

Most of my effort went into direction and review. I chose the reference design
and set the visual direction, then took several passes at the palette, the
typeface and the layout of each screen until they read the way I wanted. I also
decided what stayed and what got cut, including one panel I removed because it
suited a reviewer more than it suited an operations manager.

I found the problems by using the app rather than by reading the code. Work that
looks right in the source often falls apart on screen, so nothing was finished
until I had run it myself.
