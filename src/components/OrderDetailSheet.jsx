import { Children, isValidElement, useCallback, useEffect, useState } from 'react'
import { FileText, Paperclip, Send } from 'lucide-react'

import { Alert, Button, Pill, Select, Sheet, Textarea } from './ui.jsx'
import StatusBadge from './StatusBadge.jsx'
import WhatsAppPreview from './WhatsAppPreview.jsx'
import { useSession } from '../context/session.js'
import { allowedTransitions } from '../lib/constants.js'
import { dateTime, displayPhone, fileSize, money, relativeTime } from '../lib/format.js'
import {
  assignTechnician,
  listAudit,
  listJobFiles,
  listNotifications,
  sendAssignmentNotification,
  updateStatus,
} from '../lib/orders.js'

/**
 * The audit table stores machine keys — `order.status_changed` — because that
 * is what a log should be greppable by. The trail is read by staff, so it says
 * what happened instead.
 */
const ACTION_LABELS = {
  'order.created': 'Order created',
  'order.assigned': 'Technician assigned',
  'order.status_changed': 'Status changed',
  'order.rescheduled': 'Postponed',
  'job.completed': 'Job completed',
}

function actionLabel(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  // An unknown key still reads as a sentence rather than as a database column.
  const words = String(action ?? '').replace(/[._]/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : 'Action'
}

/**
 * The mock identities are already written as "Nurul (Admin)", so appending the
 * role produced "Nurul (Admin) (Admin)". Only add it when it is missing.
 */
function actorLabel({ actor_name: name, actor_role: role }) {
  if (!name) return role || 'Unknown'
  if (!role || name.toLowerCase().includes(role.toLowerCase())) return name
  return `${name} (${role})`
}

/**
 * The full record for one order: details, evidence, AI flags, WhatsApp history
 * and the audit trail, plus whichever workflow actions the current role is
 * allowed to take.
 *
 * Actions are derived from `allowedTransitions`, so a manager never sees a
 * "Complete job" button and an admin never sees "Mark reviewed" — the rules
 * live in one module rather than in each page's JSX.
 */
function OrderDetailSheet({ order, open, onClose, onChanged }) {
  const { session, actor, technicians, isAdmin, isManager } = useSession()
  const [tab, setTab] = useState('details')
  const [files, setFiles] = useState([])
  const [audit, setAudit] = useState([])
  const [notifications, setNotifications] = useState([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [reviewNote, setReviewNote] = useState('')

  const refresh = useCallback(async () => {
    if (!order?.id) return
    const [f, a, n] = await Promise.all([
      listJobFiles(order.id),
      listAudit(order.id),
      listNotifications({ orderId: order.id }),
    ])
    setFiles(f)
    setAudit(a)
    setNotifications(n)
  }, [order?.id])

  useEffect(() => {
    if (open) {
      setTab('details')
      setError(null)
      setReviewNote('')
      refresh()
    }
  }, [open, refresh])

  if (!order) return null

  const transitions = allowedTransitions(order, session.role, session.name)

  const runTransition = async (transition) => {
    setBusy(transition.to)
    setError(null)
    try {
      const extra =
        transition.to === 'Reviewed' && reviewNote.trim() ? { review_notes: reviewNote.trim() } : {}
      const updated = await updateStatus(order, transition.to, actor, extra)
      onChanged?.(updated)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const reassign = async (name) => {
    if (!name || name === order.assigned_technician) return
    setBusy('assign')
    setError(null)
    try {
      const updated = await assignTechnician(order, name, actor)
      onChanged?.(updated)
      await sendAssignmentNotification(updated, technicians)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const variance =
    order.final_amount != null && order.quoted_price != null
      ? Number(order.final_amount) - Number(order.quoted_price)
      : null

  const TABS = [
    { key: 'details', label: 'Details' },
    { key: 'files', label: `Files${files.length ? ` (${files.length})` : ''}` },
    { key: 'messages', label: `WhatsApp${notifications.length ? ` (${notifications.length})` : ''}` },
    { key: 'audit', label: 'Trail' },
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={order.order_no}
      subtitle={`${order.customer_name} · ${order.service_type ?? '—'}`}
      footer={
        transitions.length || (isAdmin && order.status !== 'Closed') ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {transitions.map((t) => (
              <Button
                key={t.to + t.label}
                variant={t.to === 'Closed' || t.to === 'Reviewed' ? 'success' : 'outline'}
                loading={busy === t.to}
                onClick={() => runTransition(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate">
            No actions available to {session.role} at status “{order.status}”.
          </p>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {order.branch && <Pill>{order.branch}</Pill>}
          {order.reschedule_count > 0 && (
            <Pill tone="warning">Rescheduled ×{order.reschedule_count}</Pill>
          )}
          {variance > 0 && <Pill tone="warning">Over quote +{money(variance)}</Pill>}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex gap-1 border-b border-slate-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                tab === t.key
                  ? 'border-coolant font-medium text-ink'
                  : 'border-transparent text-slate hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div className="space-y-5">
            {/* Grouped, because one flat list of eighteen label/value pairs
                reads as a data dump. Optional fields that are empty are left
                out entirely rather than printing a dash — an absent remark is
                not information. */}
            <Group title="Customer">
              <Detail label="Name" value={order.customer_name} />
              <Detail label="Phone" value={displayPhone(order.phone)} numeric />
              <Detail label="Address" value={order.address} span />
            </Group>

            <Group title="The job">
              <Detail label="Problem reported" value={order.problem_description} span />
              <Detail label="Service type" value={order.service_type} />
              <Detail label="Assigned technician" value={order.assigned_technician} />
              <Detail label="Work done" value={order.work_done} span />
              <Detail label="Technician remarks" value={order.remarks} span />
              <Detail label="Admin notes" value={order.admin_notes} span />
            </Group>

            {/* The money reads as a sum, so it is laid out as one. */}
            <Group title="Money">
              <div className="col-span-full flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-xl bg-frost/70 px-3.5 py-3">
                <Amount label="Quoted" value={order.quoted_price} />
                <Amount label="Extra charges" value={order.extra_charges} />
                <Amount label="Final" value={order.final_amount} strong />
                {order.payment_method && (
                  <span className="ml-auto text-xs text-slate">
                    Paid by{' '}
                    <span className="font-medium text-ink">{order.payment_method}</span> ·{' '}
                    <span className="tabular-nums text-ink">{money(order.payment_amount)}</span>
                  </span>
                )}
              </div>
            </Group>

            <Group title="History">
              <Detail label="Created" value={dateTime(order.created_at)} />
              <Detail label="Completed" value={order.completed_at ? dateTime(order.completed_at) : null} />
              <Detail label="Completed by" value={order.completed_by} />
              <Detail label="Reviewed by" value={order.reviewed_by} />
              <Detail label="Review notes" value={order.review_notes} span />
            </Group>

            {isAdmin && order.status !== 'Closed' && (
              <div className="rounded-xl border border-slate-line bg-frost/60 p-3">
                <p className="mb-2 text-xs font-medium text-ink">
                  Reassign technician
                  <span className="ml-1.5 font-normal text-slate">
                    (Admin only — sends a WhatsApp job brief)
                  </span>
                </p>
                <Select
                  value={order.assigned_technician ?? ''}
                  disabled={busy === 'assign'}
                  onChange={(e) => reassign(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {isManager && order.status === 'Job Done' && (
              <div className="rounded-xl border border-slate-line bg-frost/60 p-3">
                <p className="mb-2 text-xs font-medium text-ink">Review note (optional)</p>
                <Textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Saved against the order when you mark it reviewed."
                />
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-2">
            {!files.length && (
              <p className="py-6 text-center text-sm text-slate">
                No files uploaded for this job.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={file.public_url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-slate-line bg-surface transition hover:shadow-card"
                >
                  {file.mime_type?.startsWith('image/') ? (
                    <img
                      src={file.public_url}
                      alt={file.file_name}
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-frost">
                      {file.mime_type === 'application/pdf' ? (
                        <FileText size={22} className="text-slate" />
                      ) : (
                        <Paperclip size={22} className="text-slate" />
                      )}
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium text-ink">{file.file_name}</p>
                    <p className="text-[10px] text-slate">
                      {file.kind === 'receipt' ? 'Receipt · ' : ''}
                      {fileSize(file.size_bytes)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div className="space-y-2">
            {!notifications.length && (
              <p className="py-6 text-center text-sm text-slate">
                No WhatsApp notifications generated yet. They fire automatically when the job is
                assigned and when it is marked Job Done.
              </p>
            )}
            {notifications.map((n) => (
              <div key={n.id ?? n.deep_link}>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] text-slate">
                  <Send size={11} />
                  {n.template} · {relativeTime(n.created_at)}
                </p>
                <WhatsAppPreview notification={n} />
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <ol className="space-y-3">
            {!audit.length && (
              <p className="py-6 text-center text-sm text-slate">
                No audit entries. Actions taken from now on will be recorded here.
              </p>
            )}
            {audit.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="h-2 w-2 rounded-full bg-coolant" />
                  <span className="w-px flex-1 bg-slate-line" />
                </div>
                <div className="pb-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{actionLabel(entry.action)}</span>
                    {entry.from_status && entry.to_status && (
                      <span className="text-slate">
                        {' '}
                        · {entry.from_status} → {entry.to_status}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate">
                    {actorLabel(entry)} · {dateTime(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Sheet>
  )
}

/**
 * A titled block of fields. Renders nothing if every field inside it is empty,
 * so an order with no review yet doesn't show a "History" heading over four
 * dashes.
 */
function Group({ title, children }) {
  const filled = Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) return Boolean(child)
    // Non-Detail children (the money row) carry their own emptiness rules.
    return child.type !== Detail || Boolean(child.props.value)
  })
  if (!filled.length) return null

  return (
    <section>
      <h3 className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wide text-brand">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{filled}</dl>
    </section>
  )
}

/** One figure in the money row. */
function Amount({ label, value, strong = false }) {
  return (
    <span>
      <span className="block text-[11px] uppercase tracking-wide text-slate-light">{label}</span>
      <span
        className={`block tabular-nums text-ink ${strong ? 'text-lg font-semibold' : 'text-sm'}`}
      >
        {money(value)}
      </span>
    </span>
  )
}

function Detail({ label, value, numeric = false, span = false }) {
  if (!value) return null
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wide text-slate-light">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-line text-sm text-ink ${numeric ? 'tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

export default OrderDetailSheet
