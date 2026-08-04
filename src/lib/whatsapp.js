/**
 * WhatsApp message templates and deep-link construction.
 *
 * Dependency-free on purpose: the serverless notification trigger in
 * `api/notify.js` imports this same module, so a message rendered by the
 * back-end trigger is byte-identical to one previewed in the UI.
 */

import { money, timeOnly, waPhone } from './format.js'

export const TEMPLATES = {
  /** Fires when Admin assigns an order — tells the technician what's next. */
  technician_assignment: {
    id: 'technician_assignment',
    label: 'Technician job assignment',
    audience: 'Technician',
    render: (order) =>
      [
        `Hi ${order.assigned_technician}, you have a new job.`,
        '',
        `Order: ${order.order_no}`,
        `Customer: ${order.customer_name}${order.phone ? ` (${order.phone})` : ''}`,
        `Address: ${order.address || '—'}`,
        `Service: ${order.service_type || '—'}`,
        order.problem_description ? `Issue: ${order.problem_description}` : null,
        order.quoted_price ? `Quoted: ${money(order.quoted_price)}` : null,
        order.admin_notes ? `Notes: ${order.admin_notes}` : null,
        '',
        'Please confirm and update the job in the Technician Portal.',
      ]
        .filter(Boolean)
        .join('\n'),
  },

  /**
   * The template specified in Module 3. Fires on status = Job Done.
   */
  customer_job_done: {
    id: 'customer_job_done',
    label: 'Customer job completed / feedback request',
    audience: 'Customer',
    render: (order) =>
      [
        `Hi ${order.customer_name},`,
        `Job ${order.order_no} has been completed by Technician ${
          order.completed_by || order.assigned_technician
        } at ${timeOnly(order.completed_at || new Date().toISOString())}.`,
        order.work_done ? `Work done: ${order.work_done}` : null,
        order.final_amount != null ? `Total: ${money(order.final_amount)}` : null,
        'Please check and leave feedback.',
        'Thank you!',
        '',
        '— Sejuk Sejuk Service Sdn Bhd',
      ]
        .filter(Boolean)
        .join('\n'),
  },

  /** Fires alongside the customer message so accounts can invoice. */
  manager_job_done: {
    id: 'manager_job_done',
    label: 'Manager / accounts completion notice',
    audience: 'Manager',
    render: (order) => {
      const variance =
        order.final_amount != null && order.quoted_price != null
          ? Number(order.final_amount) - Number(order.quoted_price)
          : null

      return [
        `Job completed — ready for review.`,
        '',
        `Order: ${order.order_no}`,
        `Technician: ${order.completed_by || order.assigned_technician}`,
        `Customer: ${order.customer_name}`,
        `Service: ${order.service_type || '—'}`,
        `Quoted: ${money(order.quoted_price)}`,
        `Final: ${money(order.final_amount)}`,
        variance ? `Variance: ${variance > 0 ? '+' : ''}${money(variance)}` : null,
        order.payment_method ? `Payment: ${order.payment_method} — ${money(order.payment_amount)}` : null,
        '',
        'Open the Manager Portal to review and close.',
      ]
        .filter(Boolean)
        .join('\n')
    },
  },
}

/**
 * Builds a wa.me deep link. Without a phone number WhatsApp still opens with
 * the text pre-filled and asks the sender to pick a contact, which is the
 * right fallback for orders captured without a number.
 */
export function deepLink(phone, message) {
  const target = waPhone(phone)
  const text = encodeURIComponent(message)
  return target ? `https://wa.me/${target}?text=${text}` : `https://wa.me/?text=${text}`
}

/**
 * The human name for a stored template key.
 *
 * The column holds `manager_job_done` because a log should be greppable. Staff
 * reading an order's history should see what the message was.
 */
export function templateLabel(id) {
  if (TEMPLATES[id]?.label) return TEMPLATES[id].label
  const words = String(id ?? '').replace(/[._]/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : 'Message'
}

/**
 * Renders one template into a ready-to-send notification record.
 * `recipient` supplies the phone/name that isn't on the order itself
 * (technician and manager numbers come from the roster / settings).
 */
export function buildNotification(templateId, order, recipient = {}) {
  const template = TEMPLATES[templateId]
  if (!template) throw new Error(`Unknown WhatsApp template: ${templateId}`)

  const phone =
    recipient.phone ?? (template.audience === 'Customer' ? order.phone : null) ?? null
  const message = template.render(order)

  return {
    order_id: order.id ?? null,
    order_no: order.order_no,
    channel: 'whatsapp',
    template: template.id,
    recipient_role: template.audience,
    recipient_name:
      recipient.name ??
      (template.audience === 'Customer'
        ? order.customer_name
        : template.audience === 'Technician'
          ? order.assigned_technician
          : 'Operations Manager'),
    recipient_phone: phone,
    message,
    deep_link: deepLink(phone, message),
    trigger_status: order.status ?? null,
  }
}
