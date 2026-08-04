import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, ExternalLink, MessageCircle } from 'lucide-react'

import { listNotifications, markNotificationOpened, markNotificationSent } from '../lib/orders.js'
import { TEMPLATES } from '../lib/whatsapp.js'
import { displayPhone, relativeTime } from '../lib/format.js'

/**
 * The top bar's notification feed.
 *
 * Two states, because a deep link only supports two. Opening the link is all
 * the app can observe, so that is recorded as "opened". Whether the message
 * actually went is something only the person can confirm, so they confirm it.
 * Nothing here claims delivery, which would need the WhatsApp Business API.
 *
 * The badge counts messages nobody has opened yet, which is the work still
 * waiting to be done.
 */
function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listNotifications({ limit: 8 }))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pending = items.filter((n) => !n.opened_at && !n.sent_at).length

  // Optimistic: the link opens either way, so the stamp must not gate it.
  const stamp = (id, field, fn) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: new Date().toISOString() } : n)))
    fn(id)
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        className="relative rounded-lg p-2 text-slate transition hover:bg-frost hover:text-ink"
        aria-label={pending ? `Notifications, ${pending} not yet sent` : 'Notifications'}
        title="Notifications"
      >
        <Bell size={18} />
        {pending > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-copper px-1 text-[10px] font-semibold text-white">
            {pending > 9 ? '9+' : pending}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-[21rem] overflow-hidden rounded-xl border border-slate-line bg-surface shadow-lift">
            <div className="flex items-baseline justify-between border-b border-slate-line bg-frost/60 px-4 py-2.5">
              <p className="font-display text-sm font-semibold text-brand">Notifications</p>
              <p className="text-[11px] text-slate">
                {pending ? `${pending} not opened yet` : 'all opened'}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-xs text-slate">Loading…</p>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageCircle size={20} className="mx-auto mb-2 text-slate-light" />
                  <p className="text-sm font-medium text-ink">Nothing generated yet</p>
                  <p className="mt-0.5 text-xs text-slate">
                    Messages appear here when an order is assigned or a job is completed.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-line">
                  {items.map((n) => (
                    <li
                      key={n.id ?? n.deep_link}
                      className={`flex gap-3 px-4 py-3 ${n.sent_at ? '' : 'bg-coolant-50/40'}`}
                    >
                      <span
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          n.sent_at ? 'bg-slate-line' : n.opened_at ? 'bg-coolant' : 'bg-copper'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {n.recipient_name}
                          <span className="ml-1.5 text-[11px] font-normal text-slate">
                            {n.recipient_role}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-slate">
                          {TEMPLATES[n.template]?.label ?? n.template} · {n.order_no}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-light">
                          {n.recipient_phone ? `${displayPhone(n.recipient_phone)} · ` : ''}
                          {n.sent_at
                            ? `sent ${relativeTime(n.sent_at)}`
                            : n.opened_at
                              ? `opened ${relativeTime(n.opened_at)}`
                              : relativeTime(n.created_at)}
                        </p>
                      </div>

                      {/* Opened is observed. Sent is confirmed by the person
                          who sent it, because nothing else can know. The link
                          stays available in every state: somebody who closed
                          WhatsApp by accident needs a way back to it. */}
                      <div className="mt-0.5 flex shrink-0 flex-col items-end gap-1 self-start">
                        {n.deep_link && (
                          <a
                            href={n.deep_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => stamp(n.id, 'opened_at', markNotificationOpened)}
                            className="flex h-7 items-center gap-1 rounded-lg border border-slate-line px-2 text-[11px] font-medium text-brand transition hover:bg-frost"
                          >
                            <ExternalLink size={11} />
                            {n.opened_at || n.sent_at ? 'Open again' : 'Open'}
                          </a>
                        )}
                        {n.opened_at && !n.sent_at && (
                          <button
                            onClick={() => stamp(n.id, 'sent_at', markNotificationSent)}
                            className="flex h-7 items-center gap-1 rounded-lg bg-coolant-600 px-2 text-[11px] font-medium text-white transition hover:bg-coolant-700"
                          >
                            <Check size={11} />
                            Mark as sent
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
