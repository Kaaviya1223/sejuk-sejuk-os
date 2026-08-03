import { useCallback, useEffect, useState } from 'react'
import { Bell, ExternalLink, MessageCircle } from 'lucide-react'

import { listNotifications, markNotificationSent } from '../lib/orders.js'
import { TEMPLATES } from '../lib/whatsapp.js'
import { displayPhone, relativeTime } from '../lib/format.js'

/**
 * The top bar's notification feed.
 *
 * "Unread" here means *undispatched*: the system generated a WhatsApp message
 * and nobody has opened the link yet. That is the only unread state this app
 * can honestly claim, since delivery is a human tapping `wa.me` rather than an
 * API call — so the badge counts work waiting to be done, not messages waiting
 * to be looked at.
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

  const pending = items.filter((n) => !n.sent_at).length

  const send = async (notification) => {
    // Optimistic: the link opens either way, so the stamp must not gate it.
    setItems((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, sent_at: new Date().toISOString() } : n)),
    )
    await markNotificationSent(notification.id)
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        className="relative rounded-lg p-2 text-slate transition hover:bg-frost hover:text-marine"
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
          <div className="absolute right-0 top-full z-20 mt-2 w-[21rem] overflow-hidden rounded-xl border border-slate-line bg-white shadow-lift">
            <div className="flex items-baseline justify-between border-b border-slate-line bg-frost/60 px-4 py-2.5">
              <p className="font-display text-sm font-semibold text-marine-600">Notifications</p>
              <p className="text-[11px] text-slate">
                {pending ? `${pending} not sent yet` : 'all sent'}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-xs text-slate">Loading…</p>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageCircle size={20} className="mx-auto mb-2 text-slate-light" />
                  <p className="text-sm font-medium text-marine">Nothing generated yet</p>
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
                          n.sent_at ? 'bg-slate-line' : 'bg-copper'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-marine">
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
                          {n.sent_at ? `sent ${relativeTime(n.sent_at)}` : relativeTime(n.created_at)}
                        </p>
                      </div>

                      {n.deep_link && (
                        <a
                          href={n.deep_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => send(n)}
                          className="mt-0.5 flex h-7 shrink-0 items-center gap-1 self-start rounded-lg border border-slate-line px-2 text-[11px] font-medium text-marine-600 transition hover:bg-frost"
                        >
                          <ExternalLink size={11} />
                          {n.sent_at ? 'Resend' : 'Send'}
                        </a>
                      )}
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
