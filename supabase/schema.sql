-- =====================================================================
-- Sejuk Sejuk Service — Operations System schema
-- =====================================================================
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New
-- query → paste → Run). It is idempotent, so re-running is safe.
--
-- The app connects with a *publishable* key, which cannot execute DDL or
-- create storage buckets. That is why this file exists as a manual step
-- rather than something the application does at boot.
--
-- NOTE ON SECURITY: this is an assessment build using a mock login, so the
-- policies below grant the anonymous role full access. A production system
-- would replace every `USING (true)` with a check against auth.uid() and the
-- user's role. See the "Limitations" section of the README.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. orders — extend the existing table
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            text unique not null,
  customer_name       text not null,
  phone               text,
  address             text,
  problem_description text,
  service_type        text,
  quoted_price        numeric(10, 2),
  assigned_technician text,
  admin_notes         text,
  status              text not null default 'New',
  final_amount        numeric(10, 2),
  work_done           text,
  remarks             text,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

-- Columns added by this build. Split out so the migration works against the
-- original 16-row demo table without dropping anything.
alter table public.orders add column if not exists branch           text;
alter table public.orders add column if not exists extra_charges    numeric(10, 2) default 0;
alter table public.orders add column if not exists payment_amount   numeric(10, 2);
alter table public.orders add column if not exists payment_method   text;
alter table public.orders add column if not exists payment_notes    text;
alter table public.orders add column if not exists completed_by     text;
alter table public.orders add column if not exists started_at       timestamptz;
alter table public.orders add column if not exists reviewed_at      timestamptz;
alter table public.orders add column if not exists reviewed_by      text;
alter table public.orders add column if not exists review_notes     text;
alter table public.orders add column if not exists closed_at        timestamptz;
alter table public.orders add column if not exists reschedule_count integer not null default 0;
alter table public.orders add column if not exists scheduled_for    timestamptz;

-- Workflow states are constrained at the database level so an invalid status
-- can never be written, whichever client wrote it.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add  constraint orders_status_check
  check (status in ('New', 'Assigned', 'In Progress', 'Job Done', 'Reviewed', 'Closed'));

create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_technician_idx on public.orders (assigned_technician);
create index if not exists orders_created_idx    on public.orders (created_at desc);
create index if not exists orders_completed_idx  on public.orders (completed_at desc);


-- ---------------------------------------------------------------------
-- 2. technicians — the mock login roster
-- ---------------------------------------------------------------------
create table if not exists public.technicians (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null
);

alter table public.technicians add column if not exists phone  text;
alter table public.technicians add column if not exists branch text;

-- The whole roster shares one demo handset so a reviewer can tap a generated
-- wa.me link and actually receive the job brief. Real dispatch needs real
-- numbers here.
insert into public.technicians (name, phone, branch) values
  ('Ali',    '601155069631', 'Shah Alam'),
  ('John',   '601155069631', 'Petaling Jaya'),
  ('Bala',   '601155069631', 'Cheras'),
  ('Yusoff', '601155069631', 'Klang')
on conflict (name) do update
  set phone  = excluded.phone,
      branch = coalesce(public.technicians.branch, excluded.branch);


-- ---------------------------------------------------------------------
-- 3. job_files — service evidence and receipts (Supabase Storage refs)
-- ---------------------------------------------------------------------
-- Rows point at objects in the `job-files` bucket. Kept in a child table
-- rather than an array column on orders so each file carries its own
-- metadata and can be counted/queried (the AI supervisor checks for jobs
-- completed with zero evidence files).
create table if not exists public.job_files (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  kind        text not null default 'evidence' check (kind in ('evidence', 'receipt')),
  file_name   text,
  file_path   text not null,
  public_url  text,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by text,
  created_at  timestamptz not null default now()
);

create index if not exists job_files_order_idx on public.job_files (order_id);


-- ---------------------------------------------------------------------
-- 4. audit_log — "key actions should be traceable"
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references public.orders (id) on delete cascade,
  order_no    text,
  action      text not null,
  actor_role  text,
  actor_name  text,
  from_status text,
  to_status   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_order_idx   on public.audit_log (order_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);


-- ---------------------------------------------------------------------
-- 5. notifications — every WhatsApp message the system generated
-- ---------------------------------------------------------------------
-- The deep link itself is stored so the trigger is auditable even though
-- delivery is manual (see README: no WhatsApp Business API credentials).
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references public.orders (id) on delete cascade,
  order_no       text,
  channel        text not null default 'whatsapp',
  template       text not null,
  recipient_role text,
  recipient_name text,
  recipient_phone text,
  message        text not null,
  deep_link      text,
  trigger_status text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- A deep link can only tell us that WhatsApp was opened. `sent_at` is the
-- office confirming the message actually went, which is a separate act.
alter table public.notifications add column if not exists opened_at timestamptz;

create index if not exists notifications_order_idx   on public.notifications (order_id);
create index if not exists notifications_created_idx on public.notifications (created_at desc);


-- ---------------------------------------------------------------------
-- 6. Row level security
-- ---------------------------------------------------------------------
-- Demo posture: RLS is ON with permissive policies, so swapping in real
-- auth later is a policy edit rather than a schema change.
alter table public.orders        enable row level security;
alter table public.technicians   enable row level security;
alter table public.job_files     enable row level security;
alter table public.audit_log     enable row level security;
alter table public.notifications enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['orders', 'technicians', 'job_files', 'audit_log', 'notifications']
  loop
    execute format('drop policy if exists demo_all_access on public.%I', t);
    execute format(
      'create policy demo_all_access on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 7. Storage bucket for job evidence
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-files', 'job-files', true, 26214400)  -- 25 MB per object
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "job files read"   on storage.objects;
drop policy if exists "job files write"  on storage.objects;
drop policy if exists "job files update" on storage.objects;

create policy "job files read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'job-files');

create policy "job files write" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'job-files');

create policy "job files update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'job-files');


-- ---------------------------------------------------------------------
-- 8. Backfill so completed demo rows carry the new columns
-- ---------------------------------------------------------------------
-- Existing demo rows predate the columns above; give completed jobs a
-- completed_by and a final_amount consistent with their quote.
update public.orders
   set completed_by = assigned_technician
 where completed_by is null
   and status in ('Job Done', 'Reviewed', 'Closed');

update public.orders
   set final_amount = quoted_price
 where final_amount is null
   and quoted_price is not null
   and status in ('Job Done', 'Reviewed', 'Closed');

update public.orders
   set extra_charges = coalesce(final_amount, 0) - coalesce(quoted_price, 0)
 where extra_charges is null
    or (extra_charges = 0 and coalesce(final_amount, 0) > coalesce(quoted_price, 0));
