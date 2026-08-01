import { useMemo, useRef, useState } from 'react'
import { Camera, ClipboardCheck, FileText, Receipt, Trash2, Wallet, X } from 'lucide-react'

import { Alert, Button, Field, Input, Select, Sheet, Textarea } from './ui.jsx'
import { useSession } from '../context/session.js'
import { ACCEPTED_UPLOAD_TYPES, MAX_JOB_FILES, PAYMENT_METHODS } from '../lib/constants.js'
import { fileSize, money } from '../lib/format.js'
import { calculateFinalAmount, completeJob } from '../lib/orders.js'

/**
 * Module 2 — the service completion record.
 *
 * Optimised for one-handed use at the end of a job: the fields are in the
 * order a technician actually fills them, the running total is always visible,
 * and the only required input is a description of the work done. Everything
 * that can be derived (order no, technician name, timestamp, final amount) is
 * derived rather than typed.
 */
function JobCompletionSheet({ order, open, onClose, onCompleted }) {
  const { actor } = useSession()
  const evidenceInput = useRef(null)
  const receiptInput = useRef(null)

  const [form, setForm] = useState({
    work_done: '',
    extra_charges: '',
    remarks: '',
    payment_amount: '',
    payment_method: 'Cash',
    payment_notes: '',
  })
  const [files, setFiles] = useState([])
  const [receiptFiles, setReceiptFiles] = useState([])
  const [showPayment, setShowPayment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const finalAmount = useMemo(
    () => calculateFinalAmount(order?.quoted_price, form.extra_charges),
    [order?.quoted_price, form.extra_charges],
  )

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const addFiles = (event, kind) => {
    const picked = Array.from(event.target.files ?? [])
    const setter = kind === 'receipt' ? setReceiptFiles : setFiles
    const current = kind === 'receipt' ? receiptFiles : files

    const room = MAX_JOB_FILES - current.length
    if (room <= 0) {
      setError(`Maximum ${MAX_JOB_FILES} files.`)
      return
    }
    setter([...current, ...picked.slice(0, room)])
    if (picked.length > room) setError(`Only the first ${room} file(s) were added — limit is ${MAX_JOB_FILES}.`)
    event.target.value = ''
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.work_done.trim()) {
      setError('Describe the work done before completing the job.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await completeJob(order, { ...form, files, receipt: receiptFiles }, actor)
      onCompleted?.(result)
      setForm({
        work_done: '',
        extra_charges: '',
        remarks: '',
        payment_amount: '',
        payment_method: 'Cash',
        payment_notes: '',
      })
      setFiles([])
      setReceiptFiles([])
      setShowPayment(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!order) return null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Complete job"
      subtitle="Everything the office needs to close this out"
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-slate">Final amount</p>
            <p className="tabular-nums text-lg font-semibold leading-tight text-marine">
              {money(finalAmount)}
            </p>
          </div>
          <Button type="submit" form="complete-job" size="lg" variant="accent" loading={submitting}>
            Mark job done
          </Button>
        </div>
      }
    >
      <form id="complete-job" onSubmit={submit} className="space-y-5">
        {error && <Alert tone="error" onDismiss={() => setError(null)}>{error}</Alert>}

        {/* Read-only context so the technician can confirm they're on the right job. */}
        <div className="overflow-hidden rounded-xl border border-slate-line">
          <div className="flex items-center justify-between gap-3 bg-brand-sweep px-3.5 py-2.5">
            <span className="tabular-nums text-sm font-semibold text-white">{order.order_no}</span>
            <span className="truncate text-xs text-white/80">{order.customer_name}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-frost/70 p-3.5 text-sm">
            <ReadOnly label="Technician" value={actor.name} />
            <ReadOnly label="Service" value={order.service_type} />
            <ReadOnly label="Quoted" value={money(order.quoted_price)} numeric />
            <ReadOnly label="Completed at" value="Stamped on submit" />
          </div>
        </div>

        <Step icon={ClipboardCheck} title="The work" hint="Required">
          <Field label="Work done" required hint="What you actually did">
            <Textarea
              value={form.work_done}
              onChange={set('work_done')}
              rows={3}
              required
              placeholder="e.g. Chemical wash on 2 units, replaced drainage pipe, tested cooling"
            />
          </Field>

          <Field label="Remarks" hint="Optional">
            <Textarea
              value={form.remarks}
              onChange={set('remarks')}
              rows={2}
              placeholder="Anything the office should know"
            />
          </Field>
        </Step>

        <Step icon={Wallet} title="The money">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Extra charges" hint="RM">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.extra_charges}
                onChange={set('extra_charges')}
                className="tabular-nums"
                placeholder="0.00"
              />
            </Field>
            <Field label="Final amount" hint="Auto">
              <Input value={money(finalAmount)} readOnly disabled className="tabular-nums" />
            </Field>
          </div>
        </Step>

        <Step
          icon={Camera}
          title="Evidence"
          hint={`${files.length}/${MAX_JOB_FILES}`}
        >
          <FilePicker
            files={files}
            onRemove={(i) => setFiles(files.filter((_, idx) => idx !== i))}
            onPick={() => evidenceInput.current?.click()}
            disabled={files.length >= MAX_JOB_FILES}
            label="Add photo or file"
            icon={Camera}
          />
          <input
            ref={evidenceInput}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => addFiles(e, 'evidence')}
          />
        </Step>

        {/* Payment capture — collapsed by default so the common path stays short. */}
        {!showPayment ? (
          <button
            type="button"
            onClick={() => setShowPayment(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-line py-2.5 text-sm text-slate transition hover:border-coolant hover:text-coolant-700"
          >
            <Receipt size={15} />
            Record payment received
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-line bg-frost/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-marine">Payment received</p>
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="text-slate hover:text-marine"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" hint="RM">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.payment_amount}
                  onChange={set('payment_amount')}
                  className="tabular-nums"
                  placeholder={String(finalAmount.toFixed(2))}
                />
              </Field>
              <Field label="Method">
                <Select value={form.payment_method} onChange={set('payment_method')}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-marine">Receipt photo</span>
                <span className="text-xs text-slate-light">
                  {receiptFiles.length}/{MAX_JOB_FILES}
                </span>
              </div>
              <FilePicker
                files={receiptFiles}
                onRemove={(i) => setReceiptFiles(receiptFiles.filter((_, idx) => idx !== i))}
                onPick={() => receiptInput.current?.click()}
                disabled={receiptFiles.length >= MAX_JOB_FILES}
                label="Add receipt"
                icon={Receipt}
              />
              <input
                ref={receiptInput}
                type="file"
                accept={ACCEPTED_UPLOAD_TYPES}
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => addFiles(e, 'receipt')}
              />
            </div>

            <Field label="Payment notes" hint="Optional">
              <Input value={form.payment_notes} onChange={set('payment_notes')} />
            </Field>
          </div>
        )}
      </form>
    </Sheet>
  )
}

/**
 * A titled group of fields. The form is long enough that a technician needs to
 * know where they are in it — work, money, evidence — rather than meeting one
 * undifferentiated column of inputs.
 */
function Step({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-line pb-1.5">
        <Icon size={14} className="shrink-0 text-coolant" />
        <h3 className="flex-1 font-display text-xs font-semibold uppercase tracking-wide text-marine-600">
          {title}
        </h3>
        {hint && <span className="text-[11px] tabular-nums text-slate-light">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function ReadOnly({ label, value, numeric = false }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-light">{label}</p>
      <p className={`text-sm text-marine ${numeric ? 'tabular-nums' : ''}`}>{value || '—'}</p>
    </div>
  )
}

/** Thumbnail strip with local previews — no upload happens until submit. */
function FilePicker({ files, onRemove, onPick, disabled, label, icon: Icon }) {
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative overflow-hidden rounded-lg border border-slate-line">
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-20 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 flex-col items-center justify-center bg-frost px-1">
                  <FileText size={18} className="text-slate" />
                  <span className="mt-1 w-full truncate text-center text-[10px] text-slate">
                    {file.name}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute right-1 top-1 rounded-md bg-marine/70 p-1 text-white"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 size={12} />
              </button>
              <span className="absolute bottom-0 left-0 bg-marine/70 px-1 text-[9px] text-white">
                {fileSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-line py-3 text-sm text-slate transition hover:border-coolant hover:text-coolant-700 disabled:opacity-50"
      >
        <Icon size={16} />
        {disabled ? `Limit of ${MAX_JOB_FILES} reached` : label}
      </button>
    </div>
  )
}

export default JobCompletionSheet
