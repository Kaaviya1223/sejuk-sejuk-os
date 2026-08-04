# Sejuk Sejuk OS

An internal operations system for an air-conditioner service company.

An admin raises a service order. A technician does the job in the field and
records what happened. The office gets back the evidence, the final amount and a
traceable history.

**Repo:** https://github.com/Kaaviya1223/sejuk-sejuk-os
**Live demo:** https://sejuk-sejuk-os.vercel.app

**What is covered:** all three modules, plus the KPI dashboard, the AI Operations
Query Window and the AI Workflow Supervisor. AI document understanding is not
built, and the reason is in [What is not built](#what-is-not-built).

### Contents

1. [Quick start](#quick-start)
2. [What I built](#what-i-built)
3. [Tech stack](#tech-stack)
4. [Architecture decisions](#architecture-decisions)
5. [WhatsApp notifications](#whatsapp-notifications)
6. [AI integration](#ai-integration)
7. [Demo data and privacy](#demo-data-and-privacy)
8. [Limitations](#limitations)
9. [What is not built](#what-is-not-built)
10. [Self-assessment](#self-assessment)

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in Supabase URL + key, and a Gemini key
npm run dev               # http://localhost:5173
```

Use `npm run dev`, not `npm run preview`. The `api/` folder holds serverless
functions. `preview` only serves the built static files, so the assistant and
the supervisor will report that their endpoint is missing.

### Run the database migration once

The app connects with a Supabase publishable key. That key can read and write
rows but cannot create tables or storage buckets, so the schema is a manual
step.

Open the Supabase dashboard, go to SQL Editor, paste
[`supabase/schema.sql`](supabase/schema.sql) and run it. It is safe to run more
than once. It creates the `job_files`, `audit_log`, `notifications` and
`technicians` tables, adds the newer columns to `orders`, creates the
`job-files` storage bucket, and adds a `CHECK` constraint so an invalid status
can never be stored.

The app still works before you run it. Writes retry without any column the
database does not have yet, and a banner names what is missing.

### Deploying

Import the repo on Vercel. It detects Vite, builds to `dist`, and turns each
file in `api/` into a serverless function with no extra config.

Set three environment variables before the first deploy:

| Variable | Value | Used by |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | your project URL | browser and functions |
| `VITE_SUPABASE_ANON_KEY` | the publishable key | browser and functions |
| `GEMINI_API_KEY` | Google AI Studio key | functions only |

Three more are optional:

| Variable | What it does |
| --- | --- |
| `GEMINI_MODEL` | Tried first, ahead of the built-in model list. It sets the preference and keeps the fallback. |
| `MANAGER_WHATSAPP` | Addresses the completion notice. Left unset here, see [Demo data and privacy](#demo-data-and-privacy). |
| `VITE_DEMO_PHONE` | Points the technician roster at one handset for local testing. Local `.env` only. |

The Gemini key has no `VITE_` prefix on purpose. Anything prefixed that way is
inlined into the JavaScript bundle and readable by every visitor.

---

## What I built

### Module 1: Admin Portal

#### Creating an order

The form captures customer name, phone, address, problem description, service
type, quoted price, assigned technician and admin notes, plus a branch and a
scheduled date. The order number is generated automatically.

After saving, a confirmation panel shows the new order number, customer, price
and resulting status. If a technician was assigned, the app also builds a
WhatsApp job brief and renders it as a `wa.me` link.

#### Finding an order

Search covers order number, customer, phone and address. Filter chips for each
status carry their own count. The list is a table on desktop and cards on
mobile.

Opening an order shows the full record, its files, its WhatsApp history and its
audit trail.

#### Correcting an order

An admin can edit an order after it has been created. **Edit details** covers
customer name, phone, address, problem reported, service type, quoted price,
branch and admin notes. Admins only, and it stops once the order reaches Closed.

This exists because mistakes at intake are ordinary, and a wrong quoted price is
the expensive kind: 350 typed where 3500 was agreed. Before this, the only way
to fix one was to delete the order and enter it again, which lost its files, its
messages and its audit trail.

Two rules keep an edit honest:

- **Only fields that actually changed are written**, and each one is recorded in
  the audit trail with the value it replaced.
- **Messages already sent keep the details they were sent with.** They record
  what the customer received, not what the order says now.

The quoted price needs the most care. It drives the variance a manager reviews
and the totals on the Performance page, so editing it after a job is complete
changes figures that have already been reported. The form warns before the edit,
and the trail shows what moved.

### Module 2: Technician Portal

#### Designed for use on a phone

Technicians work standing in a customer's home, one-handed, so the technician
role uses a different layout from the rest of the app: no sidebar, large tap
targets, and an action bar fixed to the bottom of the screen with padding for
the phone's home indicator.

Two affordances exist specifically for field use:

- The address on a job card opens Google Maps with it already searched, and the
  phone number opens the dialler.
- The camera opens directly from the upload button, so evidence does not have to
  be captured first and located afterwards.

#### Recording a job

**Start job** moves the order to In Progress.

**Complete job** opens a form with three parts.

**1. What was done.** The technician enters:

| Field | Required |
| --- | --- |
| Work done | Yes |
| Extra charges | No |
| Remarks | No |
| Photos, videos or PDFs (up to six) | No |

**2. What the app fills in.** Four values are never typed, because the system
already knows them: order number, technician name, timestamp and final amount.

The final amount recalculates as extra charges are entered and stays visible in
the footer, so the technician sees the total before saving rather than after.

**3. Payment, if any was taken.** This is a record of a payment that already
happened. The app does not process one, and there is no payment gateway.

A **Record payment received** button opens four more fields:

| Field | Notes |
| --- | --- |
| Amount | What the customer actually handed over |
| Method | Cash, Bank Transfer, DuitNow QR, Card or Unpaid |
| Receipt photo | Stored with the job's files, tagged as a receipt |
| Payment notes | Optional |

That section starts collapsed, because not every job is paid on site. Some are
invoiced to the office, some sit under a maintenance contract, and some the
customer settles later. Leaving the fields open would put four empty inputs in
front of every technician finishing an unpaid job, on a phone screen where
scrolling costs the most.

Once saved, the amount and method appear on the order for the reviewing manager
and feed the value collected figure on the Performance page.

Completing a job also produces a customer feedback message and a manager notice.

#### Access is scoped by the query, not the interface

Only jobs assigned to the signed-in technician are fetched from the database at
all.

The rule "only the assigned technician may complete a job" could have been
implemented as a hidden button. Scoping the query instead means another
technician's work never reaches the browser, so there is nothing to reveal.

### Module 3: WhatsApp notification trigger

When a job is marked Job Done, the app calls
[`api/notify.js`](api/notify.js), a serverless endpoint that generates the
customer and manager messages.

#### The endpoint verifies the status itself

Given an order id, it re-reads that order from the database and checks
`status = 'Job Done'` for itself, rather than accepting the status from the
caller.

This is the reason the check belongs on the server. A client cannot fire "your
job is complete" at a customer whose job is still open. If the status does not
match, the endpoint refuses with a 409 naming the actual status.

Two further safeguards:

- **Calling twice does not notify twice.** A repeat call returns what was
  already sent, unless `force` is passed.
- **An unreachable endpoint does not lose the messages.** Job completion falls
  back to building them in the browser.

Messages come from the same template file the UI previews from, so what staff
read on screen is exactly what the endpoint records.

#### Why delivery is a deep link

A `wa.me` link is the method the brief names, and it is the extent of what this
build can support. The WhatsApp Business API requires a Meta Business account, a
registered number and approved message templates, all of which require a
verified business entity behind them.

Swapping one in later means replacing a single function in
[`api/notify.js`](api/notify.js) and handling its status webhooks. The deep link
sits behind that boundary rather than spread through the app.

### KPI dashboard

A Performance page for admins and managers, answering how much work got done and
who did it.

It shows jobs completed, value collected and postponements, with a leaderboard
ranked by jobs and value as the tie-break. Two technicians on the same job count
are separated by what they brought in.

Periods are this week, last week, this month and all time. Weeks start on
Monday.

### Manager: review queue

Managers own the last three steps of the workflow, so they get a page built
around one question: should this job be signed off?

Every job at Job Done sits in one list, with the decision and its evidence side
by side:

- Quoted against final, with the variance called out.
- The technician's write-up of the work.
- The files they attached.

A manager approves or sends the job back without leaving the list, and can add a
review note.

The dashboard also opens on a different line for each role. An admin sees
unassigned work. A manager sees work waiting for sign-off.

### AI: Operations Query Window

A manager-only side panel, opened with **Ask** in the top bar. Details are in
[AI integration](#ai-integration).

### AI: Workflow Supervisor

A "Needs attention" card on the dashboard, backed by
[`api/supervise.js`](api/supervise.js). It reads completed jobs and points a
manager at the ones worth a second look.

Four rules, each with its threshold written in code:

| Rule | Fires when |
| --- | --- |
| Over quote | final is at least 30% and RM 50 above the quote |
| No evidence | completed with no file attached |
| Postponed repeatedly | rescheduled twice or more |
| Waiting on review | Job Done for three days or more |

**The rules decide what is flagged, not the model.** The model writes only the
one-line summary at the top of the card. If it is unavailable, the flags are
unchanged and the card states that the summary was written without it.

The split is deliberate. A flag is a claim about a specific job, so it comes
from code that can be inspected and tested. The model is given the part where an
error costs wording rather than accuracy.

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

### All data access sits in one file

Components never touch the Supabase client. Workflow rules, audit writes and
notification building stay in `src/lib/orders.js`, so "what happens when a job
is completed" is answered by reading one function.

### The workflow is a declared state machine

`src/lib/constants.js` lists every legal transition, the roles allowed to make
it, and whether the actor must be the assigned technician.

```
New -> Assigned -> In Progress -> Job Done -> Reviewed -> Closed
```

Work also moves backwards, because real work does. An admin can unassign or
postpone. A manager can send a job back to the technician, or reopen one already
reviewed.

`allowedTransitions()` is the only thing that decides which buttons render, so a
page cannot offer an illegal move.

I got this wrong once. The review queue had its own hardcoded Reopen button that
set a Job Done order to Job Done and quietly did nothing. Both pages now render
their buttons from the state machine.

### The mock session carries an identity, not just a role

Choosing Technician also chooses which technician, because "only the assigned
technician may complete this job" means nothing without one. Every write stamps
that actor onto the audit trail.

### Order numbers are sequential

The starting code generated `ORDER` plus four random digits, which collides
about once every 40 orders once a few thousand exist.

The highest existing number is now read and incremented, with a unique
constraint and a retry for two admins saving at the same moment.

### Writes degrade instead of failing

`writeWithSchemaFallback` retries a write without any column PostgREST reports
as unknown, and returns what it dropped so the UI can say "saved, but these
fields were not stored".

### Job completion never fails on a side effect

Upload failures are reported per file rather than losing the whole submission,
and notification logging is best effort. A technician standing in a customer's
hallway should not lose their write-up because something timed out.

### Two shells, one codebase

Admins and managers get a sidebar layout. The technician role renders completely
different chrome, because the brief says office staff are on desktops and
technicians are on phones.

### One set of class names for light and dark

The semantic colour tokens are CSS variables read through Tailwind, so around
330 colour usages across 19 files switch theme without a single `dark:` variant.
The dark palette was chosen against a dark surface rather than inverted,
including the chart colours.

### The palette follows the brand spec

| Usage | Colour | Hex |
| --- | --- | --- |
| Primary navigation and buttons | Deep Blue | `#1565C0` |
| Secondary actions | Teal | `#00897B` |
| Page background | Light Grey | `#F4F7F9` |
| Cards and forms | White | `#FFFFFF` |
| Main text | Dark Navy | `#263238` |

Two working notes:

- White text on the teal measures 4.32:1, just under AA for body size. Filled
  teal buttons use a slightly darker step at 5.32:1, and the spec value stays
  for accents, icons and rules where nothing sits on top of it.
- Green is reserved for one meaning: a job that is finished. It is not part of
  the brand palette, and nothing decorative wears it.

### Status colours come from one file

`src/lib/palette.js` is read by both the badges and the charts, so a status
never means one colour in a table and another in a chart.

The six were checked for colour-blind separation against the card background.
Three of them sit below 3:1 contrast, which is why every chart prints the count
next to the swatch.

### Project layout

```
src/
  lib/         constants.js (workflow rules), orders.js (all data access),
               whatsapp.js (message templates), gemini.js, palette.js,
               api.js, format.js, supabase.js
  context/     SessionContext.jsx (mock login), ThemeContext.jsx
  components/  ui.jsx (design primitives), charts.jsx, OrderList,
               OrderDetailSheet, JobCompletionSheet, WhatsAppPreview,
               AssistantPanel, SupervisorCard, NotificationBell,
               StatusBadge, StatusTrack, RoleSwitcher, SchemaBanner,
               ThemeToggle
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

Three messages:

1. A job brief to the technician on assignment.
2. A feedback request to the customer on completion.
3. A notice to the manager on completion.

Templates live in `src/lib/whatsapp.js` and are delivered as `wa.me` links with
the text pre-filled.

### The message is shown before it is sent

The full text sits next to the send button rather than behind it.

Staff are about to send this to a paying customer, and a pre-filled WhatsApp
draft stays editable after it opens. They should read it first.

Every generated message is written to the `notifications` table, so the history
is auditable even though sending is a manual tap.

### Why a message has only two states

The top bar carries a feed of everything the app has generated. Each message has
two states, because a deep link can only support two.

- **Opened.** The app can see that the link was opened, so it records that.
- **Marked as sent.** The app cannot see whether the message actually went. The
  sender may edit it, or close WhatsApp without sending. So the sender confirms
  it themselves.

**Nothing in the app claims delivery.** Recording "sent" when all that happened
was a link opening would put a false statement in the audit trail.

The link stays available in every state, because somebody who closed WhatsApp by
accident needs a way back to it.

Real sent, delivered and read receipts need the WhatsApp Business Cloud API,
where messages go out over HTTP from the server and Meta posts status webhooks
back. That needs a Meta Business account, a registered number and approved
templates, which this build does not have.

### Phone number handling

Numbers are normalised for `wa.me`, so `012-345 6789` becomes `60123456789`.
They are displayed as `+60 12-345 6789`, whatever format the record happens to
store.

---

## AI integration

Two endpoints use a model, at three points in total. Everything else in the app
is ordinary code.

### The assistant: `api/query.js`

A manager types a question and gets an answer back. Between those two moments
there are four steps, and the model is only trusted with two of them.

```
question -> 1. classify (model)   -> intent + parameters
         -> 2. retrieve (server)  -> one declared query, fixed columns, bounded window
         -> 3. compute (server)   -> counts and totals, in JavaScript
         -> 4. phrase (model)     -> a sentence around those numbers
```

In plain terms: the model interprets the question, the server retrieves the data
and performs the arithmetic, and the model then writes the sentence.

#### The model never queries the database or produces a figure

It converts a question into an intent, and later converts finished numbers into
prose. Every number in an answer is calculated in JavaScript from rows the
server retrieved.

A hallucination can therefore change the wording of an answer, but not the
figure inside it.

#### Retrieval is declared per intent

Each intent names its table, its exact column list, its date window and a row
cap. Nothing selects `*`.

A customer's phone number therefore cannot reach the model because somebody
asked about job counts, since the columns declared for that question do not
include it.

A technician name returned by the classifier is used only after it matches a row
in `technicians`, so the model cannot invent a filter value.

#### Invented identifiers are validated, not just forbidden

Asked for a count, where the facts it was given contained no order numbers at
all, the model once appended "ORD-88902" to its answer. The prompt already
forbade exactly that.

An instruction the model is told to follow is not a guarantee. Every
order-number-shaped token in a phrased answer is therefore checked against the
facts the model was given, and an answer that fails the check is discarded in
favour of the computed one.

### What types of AI queries are supported

| Intent | Example |
| --- | --- |
| `jobs_by_technician` | What jobs did Ali complete last week? |
| `top_technician` | Which technician completed the most jobs this week? |
| `jobs_completed_count` | How many jobs were completed today? |
| `technician_workload` | Which technician might be overloaded this week? |

Periods understood: today, yesterday, this week, last week, this month, all
time. Weeks start on Monday, and "today" means today in UTC+8.

**Conversation** is answered by the model in its own words, with no data in the
prompt and an instruction never to state a number, name, order or date. So "nice
to meet you" gets a reply rather than a capability list, and it still cannot
make a claim about the company's work.

**Anything else is refused** before a query runs. That covers off-topic
questions, a name that is not on the roster, an instruction to ignore its
instructions, and questions about subjects the system does not model.

"How many customers do we have?" is refused rather than answered with a job
count, because a confident answer to a different question is worse than a
decline.

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

### Assumptions

- One company with a roster of four technicians. Branch is a field on the order,
  but there is no per-branch access control.
- Currency is MYR and dates render in `en-MY`.
- The quoted price is agreed up front, so final amount is quote plus extras.
  There is no discount or line-item path.
- One technician per order. No crews and no job splitting.
- The demo data carries no working phone numbers, so a generated link opens
  WhatsApp with the message pre-filled and asks the sender who to send it to.
  See [Demo data and privacy](#demo-data-and-privacy).

### Challenges

**The completion form was the hardest thing to get right**, and the difficulty
was judgement rather than code. It is easy to make thorough and miserable to use
one-handed in somebody's hallway. Deciding what to derive, what to make
optional, and what to require took several passes.

**The AI module was the other one.** The brief warns against unrestricted
database access, and the obvious implementation, handing the model a table dump,
is exactly that. Declaring each query instead means the assistant answers less,
but what it answers can be checked.

**Uploads needed care too.** Partial failures are reported per file, because
losing a finished write-up over one failed photo is not acceptable.

---

## Demo data and privacy

No real personal data ships in this repository or in the live demo. That is a
deliberate choice, because the repo is public and the demo database is open to
anyone holding the URL.

- **Technician numbers are empty.** The roster seeds with `null`. A `wa.me` link
  without a recipient still opens WhatsApp with the brief pre-filled and asks
  who to send it to, so the feature demonstrates itself without publishing a
  handset. Set `VITE_DEMO_PHONE` in a local `.env` to point the whole roster at
  your own number while testing.
- **Customer numbers are placeholders** in the `012-345 67xx` range. They are
  display data only, so a customer `wa.me` link will not resolve to a real
  WhatsApp account. That is the trade for not publishing somebody's number.
  Clear an order's `phone` to demo the working link on that order.
- **`MANAGER_WHATSAPP` is unset.** The completion notice still renders and is
  written to `notifications`. Its link asks the sender to choose a contact.
- **Do not enter real customer details into the live demo.** RLS grants the
  anonymous role full read and write (see [Limitations](#limitations)) and the
  anon key ships in the bundle by design, so every row is readable by anyone
  with the URL. Uploaded evidence is the same, because the storage bucket is
  public.
- **Only the publishable Supabase key reaches the browser.** `GEMINI_API_KEY`
  carries no `VITE_` prefix and is read solely by the functions in `api/`.
  Anything prefixed `VITE_` is inlined into the JavaScript bundle, which is why
  `VITE_DEMO_PHONE` belongs in a local `.env` and never in deployment settings.

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
- **Corrections stop at the intake fields.** Work done, technician remarks and
  the payment record cannot be edited after completion, so fixing a mistyped
  payment amount still means sending the job back to the technician. Those
  fields are the technician's account of what happened on site, and an admin
  quietly rewriting them is a different feature with different rules.
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

- **AI document understanding.** Extracting fields from an uploaded invoice
  needs a vision call per document, and in this system the evidence already
  arrives as structured fields the technician typed, so it would re-derive what
  the form already collected.

---

## Self-assessment

**Which module was easiest?**

Module 1. Order intake is a form and an insert. The interesting decisions were
about what to derive rather than ask for, and about putting creation in a sheet
so the admin keeps the order list in view.

**Which module was hardest?**

The AI module, though not for the API call. The hard part was deciding what the
model is allowed to do.

Letting it write queries would have supported far more questions and made every
answer untrustworthy. Restricting it to routing and phrasing meant building the
retrieval, the computation, the refusals, the keyword fallback and the check on
invented identifiers by hand.

Module 2 was a close second, for the reasons above.

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
