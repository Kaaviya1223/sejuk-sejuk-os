import { ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge.jsx'
import StatusTrack from './StatusTrack.jsx'
import { EmptyState, Spinner } from './ui.jsx'
import { money, relativeTime } from '../lib/format.js'

/**
 * One list component for every desktop portal.
 *
 * Renders as a table on wide screens and as stacked cards below `md` — the
 * same records, not a truncated mobile variant, because an admin checking a
 * job from their phone needs the same information.
 */
function OrderList({ orders, loading, onSelect, emptyTitle = 'No orders', emptyBody }) {
  if (loading) return <Spinner label="Loading orders…" />
  if (!orders.length) return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[1.5fr_1fr_1.3fr_0.9fr_0.7fr] gap-4 border-b border-slate-line bg-frost/70 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-slate">
          <span>Order</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Technician</span>
          <span className="text-right">Value</span>
        </div>
        <div className="divide-y divide-slate-line">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => onSelect?.(order)}
              className="grid w-full grid-cols-[1.5fr_1fr_1.3fr_0.9fr_0.7fr] items-center gap-4 px-5 py-3.5 text-left transition hover:bg-frost/60"
            >
              <div className="min-w-0">
                <p className="tabular-nums text-sm text-marine">{order.order_no}</p>
                <p className="truncate text-xs text-slate">
                  {order.customer_name} · {order.service_type}
                </p>
              </div>
              <span className="justify-self-start">
                <StatusBadge status={order.status} size="sm" />
              </span>
              <StatusTrack status={order.status} />
              <p className="truncate text-xs font-medium text-marine">
                {order.assigned_technician || <span className="text-slate-light">Unassigned</span>}
              </p>
              <p className="text-right tabular-nums text-xs text-marine">
                {money(order.final_amount ?? order.quoted_price)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-slate-line md:hidden">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => onSelect?.(order)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-frost"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-sm text-marine">{order.order_no}</span>
                <StatusBadge status={order.status} size="sm" />
              </div>
              <p className="mt-0.5 truncate text-xs text-slate">
                {order.customer_name} · {order.service_type}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-light">
                {order.assigned_technician || 'Unassigned'} · {relativeTime(order.created_at)} ·{' '}
                {money(order.final_amount ?? order.quoted_price)}
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-light" />
          </button>
        ))}
      </div>
    </>
  )
}

export default OrderList
