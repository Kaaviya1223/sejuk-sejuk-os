import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  PlayCircle,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'

import { Alert, Button, Card, CardHeader, PageHeader, Stat } from '../components/ui.jsx'
import { CompletionMeter, StatusMix, TechnicianLoad } from '../components/charts.jsx'
import OrderList from '../components/OrderList.jsx'
import SupervisorCard from '../components/SupervisorCard.jsx'
import OrderDetailSheet from '../components/OrderDetailSheet.jsx'
import { useSession } from '../context/session.js'
import { shortMoney } from '../lib/format.js'
import { isCompleted, listOrders } from '../lib/orders.js'

/** Landing page: where the workload sits right now. */
function Overview({ onNavigate, today }) {
  const { session, technicians } = useSession()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await listOrders())
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

  const by = (status) => orders.filter((o) => o.status === status).length
  const completed = orders.filter(isCompleted)
  const open = orders.filter((o) => !isCompleted(o))
  const busyTechs = new Set(open.map((o) => o.assigned_technician).filter(Boolean)).size
  const completedValue = completed.reduce((sum, o) => sum + Number(o.final_amount || 0), 0)

  return (
    <>
      {/* The band runs edge to edge and the tiles sit half on it, half off. */}
      <PageHeader
        deep
        title="Dashboard"
        subtitle={`Live snapshot of service operations · ${session.role}`}
        actions={
          <span className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-medium text-white ring-1 ring-inset ring-white/30">
            <CalendarDays size={14} />
            {today}
          </span>
        }
      />

      <div className="-mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <Stat
          loading={loading}
          label="Total orders"
          value={orders.length}
          icon={ClipboardList}
          tone="brand"
        />
        <Stat
          loading={loading}
          label="New"
          value={by('New')}
          icon={Inbox}
          tone="slate"
        />
        <Stat
          loading={loading}
          label="Assigned"
          value={by('Assigned')}
          icon={UserCheck}
          tone="copper"
        />
        <Stat
          loading={loading}
          label="In Progress"
          value={by('In Progress')}
          icon={PlayCircle}
          tone="amber"
        />
        <Stat
          loading={loading}
          label="Awaiting review"
          value={by('Job Done')}
          icon={Clock}
          tone="accent"
        />
        <Stat
          loading={loading}
          label="Closed"
          value={by('Closed')}
          icon={CheckCircle2}
          tone="success"
        />
        <Stat
          loading={loading}
          label="Techs on jobs"
          value={busyTechs}
          sub={`of ${technicians.length}`}
          icon={Users}
          tone="brand"
        />
        <Stat
          loading={loading}
          label="Completed value"
          value={shortMoney(completedValue)}
          sub={`${completed.length} jobs`}
          icon={Wallet}
          tone="accent"
        />
      </div>


      {/* The one difference a role should feel on landing. An admin's day
          starts with work coming in; a manager's starts with work waiting to
          be signed off. Same dashboard, different first sentence. */}
      {!loading && <NextAction role={session.role} orders={orders} onNavigate={onNavigate} />}

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* Two independent columns rather than a grid of cells: a grid row is as
          tall as its tallest card, which left holes under the short ones. Wide
          figures and the order list go left, the glanceable ones stack right,
          and each column ends where its content ends. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card padded={false}>
            <CardHeader title="Where the work sits" subtitle="Every order by workflow status" />
            <div className="px-5 py-5">
              <StatusMix orders={orders} loading={loading} />
            </div>
          </Card>

          <Card padded={false}>
            <CardHeader title="Open jobs per technician" subtitle="Excludes reviewed and closed" />
            <div className="px-5 py-5">
              <TechnicianLoad orders={orders} technicians={technicians} loading={loading} />
            </div>
          </Card>

          <Card padded={false}>
            <CardHeader
              title="Recent orders"
              subtitle="Newest first — select one to see its full record"
              actions={
                <button
                  onClick={() => onNavigate?.('orders')}
                  className="rounded-lg border border-slate-line px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-frost"
                >
                  View all
                </button>
              }
            />
            <OrderList
              orders={orders.slice(0, 6)}
              loading={loading}
              onSelect={setSelected}
              emptyTitle="No orders yet"
              emptyBody="Create the first one from the Orders page."
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card padded={false}>
            <CardHeader title="Completion rate" subtitle="Job Done and beyond" />
            <div className="px-5 py-5">
              <CompletionMeter
                done={completed.length}
                total={orders.length}
                caption="orders completed"
                loading={loading}
              />
            </div>
          </Card>

          <SupervisorCard
            onOpenOrder={(orderNo) =>
              setSelected(orders.find((o) => o.order_no === orderNo) ?? null)
            }
          />
        </div>
      </div>

      <OrderDetailSheet
        order={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated)
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
        }}
      />
    </>
  )
}


/**
 * A single line saying what this person is here to do next.
 *
 * An admin's day starts with work coming in; a manager's starts with work
 * waiting to be signed off. It renders in the clear state too — quietly — so
 * the two roles never land on an identical screen.
 */
function NextAction({ role, orders, onNavigate }) {
  const waiting = orders.filter((o) => o.status === 'Job Done').length
  const unassigned = orders.filter((o) => o.status === 'New').length

  const next =
    role === 'Manager'
      ? {
          urgent: waiting > 0,
          icon: waiting > 0 ? ClipboardCheck : ShieldCheck,
          text:
            waiting > 0
              ? `${waiting} completed job${waiting === 1 ? '' : 's'} waiting for your review`
              : 'Nothing waiting for review — every completed job is signed off',
          cta: 'Open review queue',
          go: 'review',
        }
      : {
          urgent: unassigned > 0,
          icon: unassigned > 0 ? UserCheck : ShieldCheck,
          text:
            unassigned > 0
              ? `${unassigned} order${unassigned === 1 ? '' : 's'} with no technician assigned`
              : 'Every order has a technician assigned',
          cta: 'Go to orders',
          go: 'orders',
        }

  const Icon = next.icon

  return (
    <div
      className={`mt-6 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
        next.urgent ? 'border-coolant/30 bg-coolant-50' : 'border-slate-line bg-surface'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          next.urgent
            ? 'bg-gradient-to-br from-coolant to-coolant-600 text-white shadow-glow-teal'
            : 'bg-frost-deep text-slate'
        }`}
      >
        <Icon size={17} />
      </span>
      <p
        className={`min-w-0 flex-1 text-sm ${
          next.urgent ? 'font-medium text-ink' : 'text-slate'
        }`}
      >
        {next.text}
      </p>
      <Button
        size="sm"
        variant={next.urgent ? 'primary' : 'outline'}
        onClick={() => onNavigate?.(next.go)}
      >
        {next.cta}
        <ArrowRight size={14} />
      </Button>
    </div>
  )
}

export default Overview
