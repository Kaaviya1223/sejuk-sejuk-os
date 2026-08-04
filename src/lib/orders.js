/**
 * Every read and write against the operations tables lives here.
 *
 * Components never call `supabase` directly — that keeps the workflow rules
 * (who may change what, what gets audited, what triggers a notification) in
 * one reviewable place instead of scattered across pages.
 */

import { supabase, JOB_FILES_BUCKET, isMissingSchema } from './supabase.js'
import { FALLBACK_TECHNICIANS, COMPLETED_STATUSES } from './constants.js'
import { buildNotification } from './whatsapp.js'

const ORDER_COLUMNS = '*'

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function listOrders({ status, technician, search, limit = 200 } = {}) {
  let query = supabase.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false })

  if (status && status !== 'All') query = query.eq('status', status)
  if (technician && technician !== 'All') query = query.eq('assigned_technician', technician)
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `order_no.ilike.${term},customer_name.ilike.${term},phone.ilike.${term},address.ilike.${term}`,
    )
  }

  const { data, error } = await query.limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getOrder(id) {
  const { data, error } = await supabase.from('orders').select(ORDER_COLUMNS).eq('id', id).single()
  if (error) throw error
  return data
}

export async function listTechnicians() {
  const { data, error } = await supabase.from('technicians').select('*').order('name')
  if (error || !data?.length) return FALLBACK_TECHNICIANS
  return data
}

/**
 * Evidence for several orders at once, keyed by order id.
 *
 * The review queue shows what each technician attached, and asking per row
 * would be one round trip per job on a list built for scanning.
 */
export async function listJobFilesForOrders(orderIds = []) {
  if (!orderIds.length) return new Map()

  const { data, error } = await supabase
    .from('job_files')
    .select('*')
    .in('order_id', orderIds)
    .order('created_at')

  if (error) {
    if (isMissingSchema(error)) return new Map()
    throw error
  }

  const byOrder = new Map(orderIds.map((id) => [id, []]))
  for (const file of data ?? []) byOrder.get(file.order_id)?.push(file)
  return byOrder
}

export async function listJobFiles(orderId) {
  const { data, error } = await supabase
    .from('job_files')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at')
  if (error) {
    if (isMissingSchema(error)) return []
    throw error
  }
  return data ?? []
}

export async function listAudit(orderId) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingSchema(error)) return []
    throw error
  }
  return data ?? []
}

export async function listNotifications({ orderId, limit = 50 } = {}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (orderId) query = query.eq('order_id', orderId)

  const { data, error } = await query
  if (error) {
    if (isMissingSchema(error)) return []
    throw error
  }
  return data ?? []
}

/**
 * Stamps a notification as dispatched.
 *
 * Delivery is a human tapping a `wa.me` link, so "sent" is the moment someone
 * opens that link — this is the only place the app can honestly record it.
 * Best-effort: failing to log the stamp must never block the send itself.
 */
async function stampNotification(id, patch) {
  if (!id) return null
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    return error ? null : data
  } catch {
    return null
  }
}

/**
 * Records that somebody opened the WhatsApp link.
 *
 * This is all a deep link can tell us. Opening it means WhatsApp launched with
 * the text ready; whether the sender then pressed send, edited it first, or
 * closed the app, never reaches us. Real delivery receipts need the WhatsApp
 * Business API and its status webhooks.
 *
 * Falls back to stamping `sent_at` if `opened_at` does not exist yet, so the
 * feature still works before the migration is re-run.
 */
export async function markNotificationOpened(id) {
  const opened = await stampNotification(id, { opened_at: new Date().toISOString() })
  if (opened) return opened
  return stampNotification(id, { sent_at: new Date().toISOString() })
}

/** The office confirming that the message actually went out. */
export async function markNotificationSent(id) {
  return stampNotification(id, { sent_at: new Date().toISOString() })
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

/**
 * Records a traceable action. Deliberately never throws: an audit failure
 * must not roll back or block the business action the user just took.
 */
export async function logAudit(entry) {
  try {
    const { error } = await supabase.from('audit_log').insert([entry])
    if (error && !isMissingSchema(error)) console.warn('audit write failed', error.message)
  } catch (err) {
    console.warn('audit write failed', err.message)
  }
}

/* ------------------------------------------------------------------ */
/* Order number generation                                             */
/* ------------------------------------------------------------------ */

/**
 * Sequential order numbers (ORDER1001, ORDER1002, …).
 *
 * The previous implementation picked a random 4-digit suffix, which collides
 * roughly once every 40 orders once a few thousand exist and produces numbers
 * that jump around. Reading the current maximum and incrementing keeps them
 * ordered and human-readable; the unique constraint on `order_no` plus the
 * retry in `createOrder` covers the race between two admins submitting at the
 * same moment.
 */
async function nextOrderNo() {
  const { data } = await supabase
    .from('orders')
    .select('order_no')
    .like('order_no', 'ORDER%')
    .order('order_no', { ascending: false })
    .limit(1)

  const highest = Number(String(data?.[0]?.order_no ?? '').replace(/\D/g, ''))
  const next = Number.isFinite(highest) && highest >= 1000 ? highest + 1 : 1001
  return `ORDER${next}`
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createOrder(form, actor) {
  const assigned = form.assigned_technician?.trim() || null

  const base = {
    customer_name: form.customer_name.trim(),
    phone: form.phone?.trim() || null,
    address: form.address?.trim() || null,
    problem_description: form.problem_description?.trim() || null,
    service_type: form.service_type,
    quoted_price: form.quoted_price === '' ? null : Number(form.quoted_price),
    assigned_technician: assigned,
    admin_notes: form.admin_notes?.trim() || null,
    branch: form.branch || null,
    scheduled_for: form.scheduled_for || null,
    // An order with a technician on it is already Assigned; without one it
    // sits in New until an admin assigns it.
    status: assigned ? 'Assigned' : 'New',
  }

  let lastError = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const { data, dropped } = await writeWithSchemaFallback(
        { ...base, order_no: await nextOrderNo() },
        (body) => supabase.from('orders').insert([body]).select().single(),
      )

      await logAudit({
        order_id: data.id,
        order_no: data.order_no,
        action: 'order.created',
        actor_role: actor.role,
        actor_name: actor.name,
        to_status: data.status,
        detail: { service_type: data.service_type, quoted_price: data.quoted_price },
      })

      return { ...data, _warning: droppedFieldsMessage(dropped) }
    } catch (error) {
      // 23505 = unique violation on order_no; another admin took the number.
      if (error.code !== '23505') throw error
      lastError = error
    }
  }

  throw lastError
}

/* ------------------------------------------------------------------ */
/* Writing against a partially-migrated database                       */
/* ------------------------------------------------------------------ */

// PostgREST: "Could not find the 'branch' column of 'orders' in the schema cache"
const UNKNOWN_COLUMN = /'([^']+)' column/

/**
 * Runs a write, and if the database rejects a column it doesn't have yet,
 * drops that column and retries.
 *
 * Several fields on `orders` (branch, extra_charges, completed_by, …) are
 * added by supabase/schema.sql. Without this, a reviewer who opens the app
 * before running the migration cannot create or complete a single order. With
 * it, the core workflow works immediately and the extra fields start
 * persisting the moment the migration lands — no code change needed.
 *
 * Returns the dropped column names so callers can warn instead of pretending
 * the data was saved.
 */
async function writeWithSchemaFallback(payload, run) {
  const body = { ...payload }
  const dropped = []

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    const { data, error } = await run(body)
    if (!error) return { data, dropped }
    if (error.code !== 'PGRST204') throw error

    const column = error.message?.match(UNKNOWN_COLUMN)?.[1]
    if (!column || !(column in body)) throw error

    delete body[column]
    dropped.push(column)
  }

  throw new Error('Could not write the order — too many unknown columns.')
}

/** Human-readable warning for whatever `writeWithSchemaFallback` had to skip. */
export function droppedFieldsMessage(dropped) {
  if (!dropped?.length) return null
  return `Saved, but these fields were not stored because the database migration has not been run: ${dropped.join(
    ', ',
  )}.`
}

export async function assignTechnician(order, technicianName, actor) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      assigned_technician: technicianName,
      status: order.status === 'New' ? 'Assigned' : order.status,
    })
    .eq('id', order.id)
    .select()
    .single()

  if (error) throw error

  await logAudit({
    order_id: order.id,
    order_no: order.order_no,
    action: 'order.assigned',
    actor_role: actor.role,
    actor_name: actor.name,
    from_status: order.status,
    to_status: data.status,
    detail: { from: order.assigned_technician, to: technicianName },
  })

  return data
}

export async function updateStatus(order, toStatus, actor, extra = {}) {
  const patch = { status: toStatus, ...extra }

  if (toStatus === 'In Progress' && !order.started_at) patch.started_at = new Date().toISOString()
  if (toStatus === 'Reviewed') {
    patch.reviewed_at = new Date().toISOString()
    patch.reviewed_by = actor.name
  }
  if (toStatus === 'Closed') patch.closed_at = new Date().toISOString()

  const { data } = await writeWithSchemaFallback(patch, (body) =>
    supabase.from('orders').update(body).eq('id', order.id).select().single(),
  )

  await logAudit({
    order_id: order.id,
    order_no: order.order_no,
    action: 'order.status_changed',
    actor_role: actor.role,
    actor_name: actor.name,
    from_status: order.status,
    to_status: toStatus,
    detail: extra,
  })

  return data
}

/** Postponing keeps a counter, because "Postpone / Reschedule" is a KPI. */
export async function rescheduleOrder(order, reason, actor) {
  const { data } = await writeWithSchemaFallback(
    {
      status: 'Assigned',
      reschedule_count: (order.reschedule_count ?? 0) + 1,
      remarks: reason || order.remarks,
    },
    (body) => supabase.from('orders').update(body).eq('id', order.id).select().single(),
  )

  await logAudit({
    order_id: order.id,
    order_no: order.order_no,
    action: 'order.rescheduled',
    actor_role: actor.role,
    actor_name: actor.name,
    from_status: order.status,
    to_status: 'Assigned',
    detail: { reason },
  })

  return data
}

/* ------------------------------------------------------------------ */
/* File upload                                                         */
/* ------------------------------------------------------------------ */

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

/**
 * Uploads to Supabase Storage and records a row per file. Returns the created
 * rows; upload failures are collected rather than thrown so a technician with
 * one bad photo doesn't lose the rest of the submission.
 */
export async function uploadJobFiles(order, files, actor, kind = 'evidence') {
  const uploaded = []
  const failures = []

  for (const file of files) {
    const path = `${order.order_no}/${kind}-${Date.now()}-${safeName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(JOB_FILES_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      failures.push(`${file.name}: ${uploadError.message}`)
      continue
    }

    const { data: urlData } = supabase.storage.from(JOB_FILES_BUCKET).getPublicUrl(path)

    uploaded.push({
      order_id: order.id,
      kind,
      file_name: file.name,
      file_path: path,
      public_url: urlData?.publicUrl ?? null,
      mime_type: file.type || null,
      size_bytes: file.size ?? null,
      uploaded_by: actor.name,
    })
  }

  if (uploaded.length) {
    const { error } = await supabase.from('job_files').insert(uploaded)
    if (error && !isMissingSchema(error)) failures.push(error.message)
  }

  return { uploaded, failures }
}

/* ------------------------------------------------------------------ */
/* Job completion — the Module 2 write path                            */
/* ------------------------------------------------------------------ */

export function calculateFinalAmount(quotedPrice, extraCharges) {
  return Number(quotedPrice || 0) + Number(extraCharges || 0)
}

/**
 * Completes a job: uploads evidence, writes the service record, then renders
 * the WhatsApp messages that go out on completion.
 *
 * Message generation happens after the database write and never throws — a
 * technician standing in a customer's hallway must not lose their submission
 * because the notification history could not be written.
 */
export async function completeJob(order, form, actor) {
  const extras = Number(form.extra_charges || 0)
  const finalAmount = calculateFinalAmount(order.quoted_price, extras)

  const evidence = form.files?.length
    ? await uploadJobFiles(order, form.files, actor, 'evidence')
    : { uploaded: [], failures: [] }

  const receipt = form.receipt?.length
    ? await uploadJobFiles(order, form.receipt, actor, 'receipt')
    : { uploaded: [], failures: [] }

  const patch = {
    status: 'Job Done',
    work_done: form.work_done?.trim() || null,
    extra_charges: extras,
    final_amount: finalAmount,
    remarks: form.remarks?.trim() || null,
    completed_at: new Date().toISOString(),
    completed_by: actor.name,
  }

  if (form.payment_amount !== '' && form.payment_amount != null) {
    patch.payment_amount = Number(form.payment_amount)
    patch.payment_method = form.payment_method || null
    patch.payment_notes = form.payment_notes?.trim() || null
  }

  const { data, dropped } = await writeWithSchemaFallback(patch, (body) =>
    supabase.from('orders').update(body).eq('id', order.id).select().single(),
  )

  await logAudit({
    order_id: order.id,
    order_no: order.order_no,
    action: 'job.completed',
    actor_role: actor.role,
    actor_name: actor.name,
    from_status: order.status,
    to_status: 'Job Done',
    detail: {
      extra_charges: extras,
      final_amount: finalAmount,
      files: evidence.uploaded.length + receipt.uploaded.length,
    },
  })

  const notifications = await triggerJobDoneNotifications(data)

  return {
    order: data,
    notifications,
    fileFailures: [...evidence.failures, ...receipt.failures],
    warning: droppedFieldsMessage(dropped),
  }
}

/* ------------------------------------------------------------------ */
/* WhatsApp messages                                                   */
/* ------------------------------------------------------------------ */

/**
 * Renders a notification and records it, returning the version with an id.
 *
 * Logging is best-effort: the deep link is returned to the caller either way,
 * so a missing `notifications` table degrades to "the message still sends,
 * it just isn't in the history".
 */
async function recordNotification(notification) {
  try {
    const { data, error } = await supabase.from('notifications').insert([notification]).select().single()
    if (error) return notification
    return data
  } catch {
    return notification
  }
}

/** Job brief to the technician when they are assigned. */
export async function sendAssignmentNotification(order, technicians = []) {
  if (!order?.assigned_technician) return []
  const tech = technicians.find((t) => t.name === order.assigned_technician)
  const notification = buildNotification('technician_assignment', order, {
    name: order.assigned_technician,
    phone: tech?.phone,
  })
  return [await recordNotification(notification)]
}

/**
 * Module 3 — asks the server-side trigger to fire.
 *
 * The endpoint re-reads the order and checks `status = 'Job Done'` for itself,
 * which is the point: the condition is enforced where it can't be bypassed.
 * If it is unreachable — no serverless runtime on a static host, or the request
 * fails — the same messages are built here instead, so a technician standing in
 * a customer's hallway never loses their write-up to a missing side effect.
 */
async function triggerJobDoneNotifications(order) {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    })
    if (!res.ok) throw new Error(`trigger responded ${res.status}`)

    const { notifications } = await res.json()
    if (notifications?.length) return notifications
    throw new Error('trigger returned nothing')
  } catch {
    return buildJobDoneNotifications(order)
  }
}

/**
 * Fires when a job is marked Job Done: a feedback request to the customer and
 * a completion notice for the manager / accounts.
 */
export async function buildJobDoneNotifications(order, managerPhone = null) {
  const messages = [
    buildNotification('customer_job_done', order),
    buildNotification('manager_job_done', order, { phone: managerPhone }),
  ]
  return Promise.all(messages.map(recordNotification))
}

export function isCompleted(order) {
  return COMPLETED_STATUSES.includes(order.status)
}
