import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, MapPin, Phone, PlayCircle, RotateCcw } from 'lucide-react'

import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Row,
  Section,
  Sheet,
  Spinner,
  Textarea,
} from '../components/ui.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import JobCompletionSheet from '../components/JobCompletionSheet.jsx'
import WhatsAppPreview from '../components/WhatsAppPreview.jsx'
import { useSession } from '../context/session.js'
import { dateOnly, displayPhone, money, relativeTime } from '../lib/format.js'
import { listOrders, rescheduleOrder, updateStatus } from '../lib/orders.js'

/**
 * Module 2 — the technician's day.
 *
 * Only jobs assigned to the signed-in technician are fetched: the rule "only
 * the assigned technician may complete a job" is enforced by never loading
 * anyone else's work, not just by hiding a button.
 */
function TechnicianPortal() {
  const { session, actor } = useSession()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(null)
  const [rescheduling, setRescheduling] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await listOrders({ technician: session.name }))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session.name])

  useEffect(() => {
    load()
  }, [load])

  const active = orders.filter((o) => ['New', 'Assigned', 'In Progress'].includes(o.status))
  const finished = orders.filter((o) => ['Job Done', 'Reviewed', 'Closed'].includes(o.status))

  const start = async (order) => {
    setBusy(order.id)
    try {
      const updated = await updateStatus(order, 'In Progress', actor)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const postpone = async () => {
    setBusy(rescheduling.id)
    try {
      const updated = await rescheduleOrder(rescheduling, reason, actor)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setRescheduling(null)
      setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-slate-line bg-white px-4 py-3 shadow-card">
        <div>
          <h1 className="font-display text-lg font-semibold leading-tight text-marine">
            Hi {session.name}
          </h1>
          <p className="text-xs text-slate">
            {active.length
              ? `${active.length} job${active.length === 1 ? '' : 's'} to do today`
              : 'No open jobs right now.'}
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <span className="rounded-lg bg-marine-100 px-3 py-1.5">
            <span className="block text-lg font-semibold leading-none text-marine-600">
              {active.length}
            </span>
            <span className="text-[10px] text-slate">to do</span>
          </span>
          <span className="rounded-lg bg-coolant-50 px-3 py-1.5">
            <span className="block text-lg font-semibold leading-none text-coolant-700">
              {finished.length}
            </span>
            <span className="text-[10px] text-slate">done</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Post-completion confirmation, including the generated WhatsApp messages. */}
      {result && (
        <div className="mb-5 space-y-3">
          <Alert
            tone="success"
            title={`${result.order.order_no} marked Job Done`}
            onDismiss={() => setResult(null)}
          >
            Final amount {money(result.order.final_amount)}.
          </Alert>

          {result.warning && <Alert tone="warning">{result.warning}</Alert>}

          {result.fileFailures?.length > 0 && (
            <Alert tone="warning" title="Some files did not upload">
              {result.fileFailures.join(' · ')}
            </Alert>
          )}

          {/* The messages are a task with steps, not loose cards after an
              alert — so they get one container that says how many are left. */}
          {result.notifications?.length ? (
            <Card padded={false}>
              <CardHeader
                title={`Send ${result.notifications.length} update${
                  result.notifications.length === 1 ? '' : 's'
                }`}
                subtitle="Each opens WhatsApp with the text ready. All of them are saved to the notification log either way."
              />
              <div className="space-y-3 p-3">
                {result.notifications.map((n, i) => (
                  <WhatsAppPreview key={n.id ?? n.deep_link} notification={n} step={i + 1} />
                ))}
              </div>
            </Card>
          ) : (
            <Alert tone="info">
              The job was saved, but the notification service did not respond. The office can resend
              from the order record.
            </Alert>
          )}
        </div>
      )}

      {loading ? (
        <Card padded={false}>
          <Spinner label="Loading your jobs…" />
        </Card>
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-marine-600">
              To do ({active.length})
            </h2>
            {active.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon={CheckCircle2} title="All caught up">
                  Nothing assigned to you is open right now.
                </EmptyState>
              </Card>
            ) : (
              <div className="space-y-3">
                {active.map((order) => (
                  <JobCard
                    key={order.id}
                    order={order}
                    busy={busy === order.id}
                    onStart={() => start(order)}
                    onComplete={() => setCompleting(order)}
                    onPostpone={() => setRescheduling(order)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Finished work is reference, not the task at hand — collapsed. */}
          {finished.length > 0 && (
            <Section
              title="Completed"
              icon={CheckCircle2}
              meta={`${finished.length} job${finished.length === 1 ? '' : 's'}`}
              defaultOpen={false}
            >
              <div className="-mx-4 -my-3 divide-y divide-slate-line">
                {finished.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-sm text-marine">{order.order_no}</span>
                        <StatusBadge status={order.status} size="sm" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate">
                        {order.customer_name} · {money(order.final_amount)} ·{' '}
                        {relativeTime(order.completed_at)}
                      </p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-slate-light" />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      <JobCompletionSheet
        order={completing}
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        onCompleted={(res) => {
          setCompleting(null)
          setResult(res)
          setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      <Sheet
        open={Boolean(rescheduling)}
        onClose={() => setRescheduling(null)}
        title="Postpone job"
        subtitle={rescheduling?.order_no}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRescheduling(null)}>
              Cancel
            </Button>
            <Button loading={busy === rescheduling?.id} onClick={postpone}>
              Postpone
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-slate">
          The job goes back to <span className="font-medium text-marine">Assigned</span> and the
          postpone count increases — managers track this on the KPI dashboard.
        </p>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason — e.g. customer not at home, part out of stock"
        />
      </Sheet>
    </>
  )
}

/**
 * A job card sized for thumbs: the record reads as titled blocks — details,
 * description, contact — with the address and phone one tap away and a single
 * full-width action at the bottom.
 */
function JobCard({ order, busy, onStart, onComplete, onPostpone }) {
  const started = order.status === 'In Progress'

  return (
    <div className="overflow-hidden rounded-xl border border-slate-line bg-white shadow-card">
      {/* Ticket header, in the brand green so the card reads at arm's length. */}
      <div className="flex items-center justify-between gap-3 bg-coolant px-4 py-2.5">
        <span className="tabular-nums text-sm font-semibold text-white">{order.order_no}</span>
        <div className="flex items-center gap-2">
          {order.reschedule_count > 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white">
              postponed ×{order.reschedule_count}
            </span>
          )}
          <StatusBadge status={order.status} size="sm" onDark />
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="font-display text-lg font-semibold leading-tight text-marine">
          {order.customer_name}
        </p>

        <Block title="Job details">
          <Row label="Service type">{order.service_type}</Row>
          <Row label="Scheduled">{order.scheduled_for ? dateOnly(order.scheduled_for) : '—'}</Row>
          <Row label="Quoted price">
            <span className="tabular-nums font-semibold">{money(order.quoted_price)}</span>
          </Row>
          {order.branch && <Row label="Branch">{order.branch}</Row>}
        </Block>

        {order.problem_description && (
          <Block title="Job description">
            <p className="py-1 text-sm text-marine">{order.problem_description}</p>
          </Block>
        )}

        <Block title="Contact details">
          <div className="space-y-2 py-1 text-sm">
            {order.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(order.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2.5 text-slate transition hover:text-coolant-700"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-coolant" />
                <span className="whitespace-pre-line">{order.address}</span>
              </a>
            )}
            {order.phone && (
              <a
                href={`tel:${order.phone}`}
                className="flex items-center gap-2.5 text-slate transition hover:text-coolant-700"
              >
                <Phone size={15} className="shrink-0 text-coolant" />
                <span className="tabular-nums">{displayPhone(order.phone)}</span>
              </a>
            )}
          </div>
        </Block>

        {order.admin_notes && (
          <p className="mt-3 rounded-lg border-l-[3px] border-coolant bg-coolant-50 px-3 py-2 text-xs text-slate">
            <span className="font-medium text-marine">Office note:</span> {order.admin_notes}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {!started ? (
            <Button size="lg" className="flex-1" loading={busy} onClick={onStart}>
              <PlayCircle size={17} />
              Start job
            </Button>
          ) : (
            <Button size="lg" variant="accent" className="flex-1" onClick={onComplete}>
              <CheckCircle2 size={17} />
              Complete job
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={onPostpone} aria-label="Postpone job">
            <RotateCcw size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A titled block inside the job card. */
function Block({ title, children }) {
  return (
    <div className="mt-3 border-t border-slate-line pt-2.5 first:border-0">
      <p className="mb-1 font-display text-xs font-semibold uppercase tracking-wide text-marine-600">
        {title}
      </p>
      {children}
    </div>
  )
}

export default TechnicianPortal
