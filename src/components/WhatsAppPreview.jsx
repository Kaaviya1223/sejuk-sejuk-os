import { AlertTriangle, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from './ui.jsx'
import { TEMPLATES } from '../lib/whatsapp.js'
import { displayPhone } from '../lib/format.js'
import { markNotificationSent } from '../lib/orders.js'

/**
 * Renders one generated notification: who it goes to, the exact message text,
 * and the deep link that opens WhatsApp with it pre-filled.
 *
 * The message is shown rather than hidden behind the button on purpose — staff
 * are about to send this to a paying customer, and a pre-filled WhatsApp draft
 * is editable, so they should read it first. It sits in a bubble because that
 * is what the recipient will see, and the reader is proof-reading a message,
 * not scanning a field.
 */
function WhatsAppPreview({ notification, compact = false, step }) {
  if (!notification) return null

  const label = TEMPLATES[notification.template]?.label

  return (
    <div className="overflow-hidden rounded-xl border border-slate-line bg-surface">
      {/* Who, and the one action — kept on a single line at the top. */}
      <div className="flex items-center gap-3 border-b border-slate-line bg-frost/60 px-3.5 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C4A]">
          {step ? (
            <span className="text-sm font-semibold">{step}</span>
          ) : (
            <MessageCircle size={17} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          {/* Wraps rather than truncates: "Operations Manager" is a name the
              reader needs in full before sending. */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-ink">
              {notification.recipient_name}
            </span>
            <span className="rounded-full bg-marine-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
              {notification.recipient_role}
            </span>
          </p>
          {notification.recipient_phone ? (
            <p className="truncate text-[11px] tabular-nums text-slate">
              {displayPhone(notification.recipient_phone)}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={11} className="shrink-0" />
              No number on file — pick a contact in WhatsApp
            </p>
          )}
        </div>

        {/* Opening the link is the only moment this app can call a message
            "sent", so stamp it here too — otherwise the bell keeps counting
            work that has already been done. */}
        <a
          href={notification.deep_link}
          target="_blank"
          rel="noreferrer"
          onClick={() => markNotificationSent(notification.id)}
          className="shrink-0"
        >
          <Button variant="whatsapp" size="sm">
            <ExternalLink size={13} />
            Send
          </Button>
        </a>
      </div>

      {!compact && (
        <div className="px-3.5 py-3">
          <p className="whitespace-pre-line rounded-xl rounded-tl-sm bg-[#E8F7EF] px-3 py-2.5 text-[13px] leading-relaxed text-ink dark:bg-coolant/15">
            {notification.message}
          </p>
          {label && <p className="mt-2 text-[11px] text-slate-light">{label}</p>}
        </div>
      )}
    </div>
  )
}

export default WhatsAppPreview
