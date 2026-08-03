import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Plus, RefreshCw, Search, X } from 'lucide-react'

import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Sheet,
  Textarea,
} from '../components/ui.jsx'
import OrderList from '../components/OrderList.jsx'
import OrderDetailSheet from '../components/OrderDetailSheet.jsx'
import WhatsAppPreview from '../components/WhatsAppPreview.jsx'
import { useSession } from '../context/session.js'
import { useTheme } from '../context/theme.js'
import { statusColors } from '../lib/palette.js'
import { BRANCHES, SERVICE_TYPES, STATUSES } from '../lib/constants.js'
import { money } from '../lib/format.js'
import { createOrder, listOrders, sendAssignmentNotification } from '../lib/orders.js'

const BLANK = {
  customer_name: '',
  phone: '',
  address: '',
  problem_description: '',
  service_type: 'Cleaning',
  quoted_price: '',
  assigned_technician: '',
  admin_notes: '',
  branch: '',
  scheduled_for: '',
}

/**
 * Module 1 — order intake.
 *
 * Creation lives in a sheet rather than its own page so the admin keeps the
 * order list in view: the common task is "customer calls about an existing
 * job", not "type a brand new one".
 */
function AdminOrders() {
  const { actor, technicians, isAdmin } = useSession()
  const { theme } = useTheme()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'All', technician: 'All', search: '' })
  const [selected, setSelected] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [receipt, setReceipt] = useState(null)

  /**
   * Search still goes to the database — it has to, since it matches on fields
   * the browser may not have loaded. Status and technician are then narrowed in
   * memory, which is what lets each filter show its own count without a query
   * per chip. Fine against the 200-row cap; past that the counts belong in a
   * Postgres aggregate, like the rest of the dashboard maths.
   */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await listOrders({ search: filters.search }))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters.search])

  useEffect(() => {
    const timer = setTimeout(load, filters.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, filters.search])

  const visible = orders.filter(
    (o) =>
      (filters.status === 'All' || o.status === filters.status) &&
      (filters.technician === 'All' || o.assigned_technician === filters.technician),
  )

  const countFor = (status) =>
    status === 'All' ? orders.length : orders.filter((o) => o.status === status).length

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const created = await createOrder(form, actor)
      // Module 1 bonus: notify the technician the moment they're assigned.
      const notifications = await sendAssignmentNotification(created, technicians)
      setReceipt({ order: created, notifications })
      setForm(BLANK)
      setFormOpen(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Create service orders, assign technicians and track them through the workflow."
        actions={
          <>
            <Button variant="band" onClick={load}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            {isAdmin && (
              <Button variant="bandSolid" onClick={() => setFormOpen(true)}>
                <Plus size={15} />
                New order
              </Button>
            )}
          </>
        }
      />

      {receipt && (
        <div className="mb-5 space-y-3">
          <Alert
            tone="success"
            title={`Order ${receipt.order.order_no} created`}
            onDismiss={() => setReceipt(null)}
          >
            <div className="mt-1 space-y-0.5 text-[13px]">
              <p>
                {receipt.order.customer_name} · {receipt.order.service_type} ·{' '}
                {money(receipt.order.quoted_price)}
              </p>
              <p>
                {receipt.order.assigned_technician
                  ? `Assigned to ${receipt.order.assigned_technician}. Status is now ${receipt.order.status}.`
                  : 'No technician assigned yet, so the order sits in New until you assign one.'}
              </p>
            </div>
          </Alert>

          {receipt.order._warning && <Alert tone="warning">{receipt.order._warning}</Alert>}

          {receipt.notifications.map((n) => (
            <WhatsAppPreview key={n.id ?? n.deep_link} notification={n} />
          ))}
        </div>
      )}

      {error && !formOpen && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <Card padded={false}>
        <CardHeader
          title={
            visible.length === orders.length
              ? `${orders.length} order${orders.length === 1 ? '' : 's'}`
              : `${visible.length} of ${orders.length} orders`
          }
          subtitle="Newest first"
          actions={
            (filters.status !== 'All' || filters.technician !== 'All') && (
              <button
                onClick={() => setFilters({ ...filters, status: 'All', technician: 'All' })}
                className="flex items-center gap-1 rounded-lg border border-slate-line px-2.5 py-1 text-xs font-medium text-slate transition hover:bg-frost hover:text-ink"
              >
                <X size={12} />
                Clear filters
              </button>
            )
          }
        />

        <div className="space-y-3 border-b border-slate-line bg-frost/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-light"
              />
              <Input
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Order no, customer, phone…"
                className="py-1.5 pl-8 text-xs"
              />
            </div>
            <Select
              value={filters.technician}
              onChange={(e) => setFilters({ ...filters, technician: e.target.value })}
              className="!w-40 py-1.5 text-xs"
              aria-label="Filter by technician"
            >
              {/* Value, not label: the filter compares against "All". */}
              <option value="All">All technicians</option>
              {technicians.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </Select>
          </div>

          {/* Status as chips rather than a dropdown: the six states and how
              much work sits in each are the thing an admin is here to see, and
              a <select> hides both behind a click. */}
          <div className="flex flex-wrap gap-1.5">
            {['All', ...STATUSES].map((status) => {
              const active = filters.status === status
              const count = countFor(status)
              return (
                <button
                  key={status}
                  onClick={() => setFilters({ ...filters, status })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    active
                      ? 'border-transparent bg-marine text-white'
                      : 'border-slate-line bg-surface text-slate hover:border-coolant/60 hover:text-ink'
                  } ${!count && !active ? 'opacity-50' : ''}`}
                >
                  {status !== 'All' && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: statusColors(theme)[status] }}
                    />
                  )}
                  {status}
                  <span className={active ? 'text-white/70' : 'text-slate-light'}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <OrderList
          orders={visible}
          loading={loading}
          onSelect={setSelected}
          emptyTitle="No orders match these filters"
          emptyBody="Clear the filters, or create the first order."
        />
      </Card>

      <OrderDetailSheet
        order={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated)
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
        }}
      />

      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        title="New service order"
        subtitle="Order number is generated automatically on save."
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-slate sm:block">
              Assigning a technician here sets the order straight to Assigned.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-order" loading={submitting}>
                <CheckCircle2 size={15} />
                Create order
              </Button>
            </div>
          </div>
        }
      >
        <form id="new-order" onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" required>
              <Input value={form.customer_name} onChange={set('customer_name')} required autoFocus />
            </Field>
            <Field label="Phone" hint="For WhatsApp updates">
              <Input
                value={form.phone}
                onChange={set('phone')}
                inputMode="tel"
                placeholder="012-345 6789"
                className="tabular-nums"
              />
            </Field>
          </div>

          <Field label="Address" required>
            <Textarea value={form.address} onChange={set('address')} rows={2} required />
          </Field>

          <Field label="Problem description" hint="What the customer reported">
            <Textarea value={form.problem_description} onChange={set('problem_description')} rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service type" required>
              <Select value={form.service_type} onChange={set('service_type')}>
                {SERVICE_TYPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quoted price" hint="RM">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.quoted_price}
                onChange={set('quoted_price')}
                className="tabular-nums"
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned technician" hint="Optional. Leave blank to triage later.">
              <Select value={form.assigned_technician} onChange={set('assigned_technician')}>
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Branch">
              <Select value={form.branch} onChange={set('branch')}>
                <option value="">—</option>
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Scheduled for" hint="Optional">
            <Input type="datetime-local" value={form.scheduled_for} onChange={set('scheduled_for')} />
          </Field>

          <Field label="Admin notes" hint="Internal only, but included in the technician's brief.">
            <Textarea value={form.admin_notes} onChange={set('admin_notes')} rows={2} />
          </Field>
        </form>
      </Sheet>
    </>
  )
}

export default AdminOrders
