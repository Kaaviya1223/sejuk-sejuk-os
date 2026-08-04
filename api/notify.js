import { createClient } from '@supabase/supabase-js'
import { buildNotification } from '../src/lib/whatsapp.js'
import { DEMO_PHONE } from '../src/lib/constants.js'

/**
 * Module 3 — the WhatsApp notification trigger.
 *
 * POST { orderId } once a job is finished. The endpoint re-reads the order and
 * checks the trigger condition itself — `status = 'Job Done'` — rather than
 * believing the caller, so a client cannot fire a "your job is complete"
 * message at a customer whose job is still open.
 *
 * Messages are rendered from `src/lib/whatsapp.js`, the same module the UI
 * previews from, so what the office reads on screen is byte-identical to what
 * this endpoint logs.
 *
 * Delivery is a `wa.me` deep link rather than a Business API send: there are no
 * WhatsApp Business credentials for this build, and the brief accepts a
 * pre-filled deep link. The endpoint therefore *generates and records* the
 * notification; a human still taps send. Swapping in a real provider means
 * replacing `deliver()` below and nothing else.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

/** The one status that fires this trigger. */
const TRIGGER_STATUS = 'Job Done'

/** Only what the templates need — this endpoint has no reason to read the rest. */
const ORDER_COLUMNS = `id, order_no, customer_name, phone, address, service_type,
  problem_description, assigned_technician, completed_by, completed_at, quoted_price,
  final_amount, work_done, payment_method, payment_amount, status`

function client() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase is not configured on the server.')
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

/**
 * Records the message and returns it with its id. Logging is best-effort: if
 * the `notifications` table is missing, the caller still gets a working deep
 * link rather than an error.
 */
async function record(db, notification) {
  try {
    const { data, error } = await db.from('notifications').insert([notification]).select().single()
    return error ? notification : data
  } catch {
    return notification
  }
}

/** Already-sent check, so a retry or a double-tap doesn't re-notify a customer. */
async function existing(db, orderId) {
  try {
    const { data, error } = await db
      .from('notifications')
      .select('id, template, message, deep_link, recipient_name, recipient_role, recipient_phone')
      .eq('order_id', orderId)
      .eq('trigger_status', TRIGGER_STATUS)
    return error ? [] : (data ?? [])
  } catch {
    return []
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const orderId = req.body?.orderId
  const force = Boolean(req.body?.force)
  if (!orderId) return res.status(400).json({ error: 'orderId is required.' })

  try {
    const db = client()

    const { data: order, error } = await db
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('id', orderId)
      .single()

    if (error || !order) return res.status(404).json({ error: 'Order not found.' })

    // The trigger condition, checked against the stored row.
    if (order.status !== TRIGGER_STATUS) {
      return res.status(409).json({
        error: `Not notifying: ${order.order_no} is "${order.status}", and this trigger only fires at "${TRIGGER_STATUS}".`,
        status: order.status,
      })
    }

    if (!force) {
      const already = await existing(db, order.id)
      if (already.length) {
        return res.status(200).json({ notifications: already, resent: false, alreadySent: true })
      }
    }

    // The manager is not a row in any table, so their number has nowhere to
    // come from but configuration. Without a fallback the link opens WhatsApp
    // with no recipient, which reads as broken rather than unconfigured, so
    // the demo handset stands in until a deployment sets the real one.
    const managerPhone = process.env.MANAGER_WHATSAPP || DEMO_PHONE
    const notifications = await Promise.all(
      [
        buildNotification('customer_job_done', order),
        buildNotification('manager_job_done', order, { phone: managerPhone }),
      ].map((n) => record(db, { ...n, trigger_status: TRIGGER_STATUS })),
    )

    return res.status(200).json({ notifications, resent: force, alreadySent: false })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
