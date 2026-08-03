import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  PlayCircle,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'

import { Alert, Card, CardHeader, PageHeader, Stat } from '../components/ui.jsx'
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

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <CardHeader
            title="Where the work sits"
            subtitle="Every order by workflow status"
          />
          <div className="px-5 py-5">
            <StatusMix orders={orders} loading={loading} />
          </div>
        </Card>

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

        <Card padded={false}>
          <CardHeader title="Open jobs per technician" subtitle="Excludes reviewed and closed" />
          <div className="px-5 py-5">
            <TechnicianLoad orders={orders} technicians={technicians} loading={loading} />
          </div>
        </Card>

        <SupervisorCard
          onOpenOrder={(orderNo) => setSelected(orders.find((o) => o.order_no === orderNo) ?? null)}
        />

        <Card padded={false} className="lg:col-span-2">
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

export default Overview
