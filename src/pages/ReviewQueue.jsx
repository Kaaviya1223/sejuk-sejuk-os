import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  ImageOff,
  Paperclip,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'

import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonRows, Textarea } from '../components/ui.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useSession } from '../context/session.js'
import { dateTime, fileSize, money, relativeTime } from '../lib/format.js'
import { listJobFilesForOrders, listOrders, updateStatus } from '../lib/orders.js'

/**
 * The manager's queue.
 *
 * Their job is signing work off, which the order list could technically do —
 * filter to Job Done, open each, act inside a sheet. This puts the decision
 * and everything needed to make it on one screen: what was quoted against what
 * was charged, what the technician wrote, and the photos they attached. A
 * manager should be able to approve without opening anything.
 */
function ReviewQueue({ onNavigate }) {
  const { actor } = useSession()
  const [orders, setOrders] = useState([])
  const [files, setFiles] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [notes, setNotes] = useState({})
  const [done, setDone] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const waiting = await listOrders({ status: 'Job Done' })
      setOrders(waiting)
      setFiles(await listJobFilesForOrders(waiting.map((o) => o.id)))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (order, toStatus) => {
    setBusy(order.id)
    setError(null)
    try {
      const note = notes[order.id]?.trim()
      await updateStatus(order, toStatus, actor, note ? { review_notes: note } : {})
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      setDone({ order_no: order.order_no, toStatus })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const totalWaiting = orders.reduce((sum, o) => sum + Number(o.final_amount || 0), 0)

  return (
    <>
      <PageHeader
        title="Review queue"
        subtitle="Completed jobs waiting for your sign-off."
        actions={
          <span className="rounded-lg bg-white/15 px-3 py-2 text-xs font-medium text-white ring-1 ring-inset ring-white/30">
            {orders.length} waiting · {money(totalWaiting)}
          </span>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {done && (
        <div className="mb-4">
          <Alert
            tone="success"
            title={`${done.order_no} ${done.toStatus === 'Reviewed' ? 'marked reviewed' : 'reopened'}`}
            onDismiss={() => setDone(null)}
          >
            {done.toStatus === 'Reviewed'
              ? 'It moves on to closing.'
              : 'It is back with the technician as Job Done.'}
          </Alert>
        </div>
      )}

      {loading ? (
        <Card padded={false}>
          <SkeletonRows rows={3} />
        </Card>
      ) : orders.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={ShieldCheck} title="Nothing waiting for review">
            Every completed job has been signed off. New ones appear here the moment a technician
            marks a job done.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <ReviewCard
              key={order.id}
              order={order}
              files={files.get(order.id) ?? []}
              busy={busy === order.id}
              note={notes[order.id] ?? ''}
              onNote={(v) => setNotes((prev) => ({ ...prev, [order.id]: v }))}
              onApprove={() => act(order, 'Reviewed')}
              onReopen={() => act(order, 'Job Done')}
              onOpen={() => onNavigate?.('orders')}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ReviewCard({ order, files, busy, note, onNote, onApprove, onReopen }) {
  const quoted = Number(order.quoted_price || 0)
  const final = Number(order.final_amount || 0)
  const variance = final - quoted
  const images = files.filter((f) => f.mime_type?.startsWith('image/'))
  const others = files.filter((f) => !f.mime_type?.startsWith('image/'))

  return (
    <Card padded={false}>
      <CardHeader
        title={order.order_no}
        subtitle={`${order.customer_name} · ${order.service_type ?? '—'}`}
        accent={variance > 0 || files.length === 0 ? 'warn' : 'brand'}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} size="sm" />
            <span className="hidden text-xs text-slate sm:inline">
              {relativeTime(order.completed_at)}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {/* The money, which is the thing being signed off. */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <Figure label="Quoted" value={money(order.quoted_price)} />
            <Figure label="Final" value={money(order.final_amount)} strong />
            {variance !== 0 && (
              <Figure
                label={variance > 0 ? 'Over quote' : 'Under quote'}
                value={`${variance > 0 ? '+' : ''}${money(variance)}`}
                tone={variance > 0 ? 'warn' : 'muted'}
              />
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-light">Work done</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-ink">
              {order.work_done || <span className="text-slate">Nothing was written.</span>}
            </p>
          </div>

          {order.remarks && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-light">Remarks</p>
              <p className="mt-0.5 text-sm text-slate">{order.remarks}</p>
            </div>
          )}

          <p className="text-[11px] text-slate">
            Completed by{' '}
            <span className="font-medium text-ink">
              {order.completed_by || order.assigned_technician || '—'}
            </span>{' '}
            · {dateTime(order.completed_at)}
          </p>
        </div>

        {/* Evidence, at a size you can actually judge. */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-light">
            <Paperclip size={11} />
            Evidence ({files.length})
          </p>

          {files.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-line px-3 py-4 text-xs text-slate">
              <ImageOff size={15} className="shrink-0 text-copper" />
              Nothing was attached to this job.
            </div>
          ) : (
            <div className="space-y-2">
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.slice(0, 6).map((file) => (
                    <a
                      key={file.id}
                      href={file.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative overflow-hidden rounded-lg border border-slate-line"
                      title={`${file.file_name} · ${fileSize(file.size_bytes)}`}
                    >
                      <img
                        src={file.public_url}
                        alt={file.file_name}
                        loading="lazy"
                        className="h-20 w-full object-cover transition group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              )}

              {/* A PDF is evidence too. Counting it as "+1 file" gives a
                  reviewer nothing to open, so each one is named and clickable. */}
              {others.map((file) => (
                <a
                  key={file.id}
                  href={file.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-slate-line px-2.5 py-2 text-[11px] text-slate transition hover:border-coolant/60 hover:text-ink"
                >
                  <FileText size={13} className="shrink-0 text-coolant" />
                  <span className="truncate">{file.file_name || 'Attachment'}</span>
                  <span className="ml-auto shrink-0 text-slate-light">
                    {fileSize(file.size_bytes)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-line bg-frost/50 p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-light">
            Review note (optional)
          </label>
          <Textarea
            rows={1}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Anything to record with this decision"
            className="text-sm"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onReopen} disabled={busy}>
            <RotateCcw size={15} />
            Reopen
          </Button>
          <Button variant="success" loading={busy} onClick={onApprove}>
            <CheckCircle2 size={16} />
            Approve
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Figure({ label, value, strong = false, tone = 'default' }) {
  return (
    <span>
      <span className="block text-[11px] uppercase tracking-wide text-slate-light">{label}</span>
      <span
        className={`block tabular-nums ${strong ? 'text-lg font-semibold' : 'text-sm'} ${
          tone === 'warn' ? 'text-copper' : tone === 'muted' ? 'text-slate' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </span>
  )
}

export default ReviewQueue
