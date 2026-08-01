# Sejuk Sejuk Ops — Service Operations System

An internal operations tool for an air-conditioner service company: an admin
creates a service order, a technician completes the job in the field, and the
record — evidence photos, final amount, payment, audit trail — comes back to
the office.

**Scope of this submission: Module 1 (Admin Portal) and Module 2 (Technician
Portal), including both of their WhatsApp bonuses.** Modules 3, the KPI
dashboard and the AI modules are not built — see
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

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Front-end | React 19 + Vite |
| Styling | Tailwind CSS 3 |
| Database | Supabase (Postgres + PostgREST) |
| File storage | Supabase Storage |
| Icons | lucide-react |
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
               OrderList · OrderDetailSheet · JobCompletionSheet
               WhatsAppPreview · StatusBadge · StatusTrack
  pages/       Overview.jsx · AdminOrders.jsx · TechnicianPortal.jsx
supabase/
  schema.sql   the one-paste migration
```

---

## WhatsApp notifications

Implemented as the Module 1 and Module 2 **bonuses** — a technician job brief
on assignment, and a customer feedback request plus manager/accounts notice on
completion. Messages are rendered from templates in `src/lib/whatsapp.js` and
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

Stopped at Module 2 as scoped. Not implemented:

- **Module 3** — the server-side WhatsApp trigger. The *messages* are built and
  logged (Modules 1 and 2 bonuses), but generation is client-side; there is no
  serverless endpoint firing on a status change, and no WhatsApp Business API
  delivery.
- **KPI dashboard** — technician leaderboard, jobs completed, total amount,
  reschedule counts. The data it needs is captured (`reschedule_count`,
  `final_amount`, `completed_by`, `completed_at`).
- **AI modules** — the operations query assistant, workflow supervisor,
  document understanding and operational insight.

`api/query.js` and `src/components/ManagerPortal.jsx` are an earlier
exploration of the AI module. They are left untouched and are **not wired into
the app**. `vite.config.js` includes a dev-server plugin that serves `/api/*`
handlers locally the same way Vercel does in production, so that work can be
picked up without re-plumbing.

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
