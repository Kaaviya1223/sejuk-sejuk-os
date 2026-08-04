/**
 * Single source of truth for the workflow. The API layer imports the same
 * status list, so front-end and back-end can never disagree about what a
 * legal transition is.
 */

export const STATUSES = ['New', 'Assigned', 'In Progress', 'Job Done', 'Reviewed', 'Closed']

/**
 * Which status may follow which, and who is allowed to make the move.
 *
 * This encodes the business rules from the brief:
 *   - only Admin assigns a technician
 *   - only the assigned technician may start or complete a job
 *   - only a Manager may review and close
 *
 * `self` means the actor must be the technician the order is assigned to.
 */
export const TRANSITIONS = {
  New: [{ to: 'Assigned', roles: ['Admin'], label: 'Assign technician' }],
  Assigned: [
    { to: 'In Progress', roles: ['Technician'], self: true, label: 'Start job' },
    { to: 'New', roles: ['Admin'], label: 'Unassign' },
  ],
  'In Progress': [
    { to: 'Job Done', roles: ['Technician'], self: true, label: 'Complete job' },
    { to: 'Assigned', roles: ['Admin', 'Technician'], self: true, label: 'Postpone / reschedule' },
  ],
  'Job Done': [
    { to: 'Reviewed', roles: ['Manager'], label: 'Mark reviewed' },
    // Rejecting work is part of reviewing it: the job goes back to the
    // technician who did it, who can finish and complete it again.
    { to: 'In Progress', roles: ['Manager'], label: 'Send back to technician' },
  ],
  Reviewed: [
    { to: 'Closed', roles: ['Manager'], label: 'Close order' },
    { to: 'Job Done', roles: ['Manager'], label: 'Reopen for rework' },
  ],
  Closed: [],
}

export const ROLES = ['Admin', 'Technician', 'Manager']

export const SERVICE_TYPES = [
  'Cleaning',
  'Repair',
  'Gas Refill',
  'Installation',
  'Maintenance Contract',
  'Inspection',
]

export const BRANCHES = ['Shah Alam', 'Petaling Jaya', 'Cheras', 'Klang', 'Seremban']

/**
 * Fallback roster, used when the `technicians` table is unreachable.
 *
 * The roster ships with no number. WhatsApp delivery is a manual `wa.me` tap,
 * and an unset number still opens WhatsApp with the job brief pre-filled for
 * the sender to address, so the link demonstrates itself without a real
 * handset living in a public repo. Set `VITE_DEMO_PHONE` in a local `.env` to
 * point the whole roster at one number and receive the briefs while testing.
 * Real dispatch reads per-technician numbers from the `technicians` table.
 */
export const DEMO_PHONE = import.meta.env.VITE_DEMO_PHONE || ''

export const FALLBACK_TECHNICIANS = [
  { name: 'Ali', phone: DEMO_PHONE, branch: 'Shah Alam' },
  { name: 'John', phone: DEMO_PHONE, branch: 'Petaling Jaya' },
  { name: 'Bala', phone: DEMO_PHONE, branch: 'Cheras' },
  { name: 'Yusoff', phone: DEMO_PHONE, branch: 'Klang' },
]

export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'DuitNow QR', 'Card', 'Unpaid']

/** Terminal-ish states that count as "the technician finished the work". */
export const COMPLETED_STATUSES = ['Job Done', 'Reviewed', 'Closed']

export const MAX_JOB_FILES = 6

export const ACCEPTED_UPLOAD_TYPES = 'image/*,video/*,application/pdf'

/**
 * Returns the transitions `role` may perform on `order` right now.
 * Used to render action buttons — an action that isn't returned is never
 * shown, so the UI can't offer an illegal move.
 */
export function allowedTransitions(order, role, technicianName) {
  if (!order) return []
  return (TRANSITIONS[order.status] || []).filter((t) => {
    if (!t.roles.includes(role)) return false
    if (t.self && order.assigned_technician !== technicianName) return false
    return true
  })
}
