/** Display helpers. Malaysian locale: RM currency, DD MMM formatting. */

export function money(value) {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return '—'
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function shortMoney(value) {
  const n = Number(value) || 0
  if (n >= 1000) return `RM ${(n / 1000).toFixed(1)}k`
  return `RM ${n.toFixed(0)}`
}

export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function dateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function timeOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function relativeTime(value) {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return dateOnly(value)
}

/**
 * Avatar initials. Bracketed role suffixes ("Nurul (Admin)") are part of the
 * mock identities, so anything that isn't a letter is skipped rather than
 * turned into a monogram like "N(".
 */
export function initials(name) {
  if (!name) return '??'
  const words = String(name).match(/\p{L}+/gu) ?? []
  return words
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '??'
}

export function fileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * The same number, formatted for a human: `01155069631` and `60115569631`
 * both render as `+60 11-5506 9631`. Whatever a record happens to store, the
 * UI shows the international form the message will actually be sent to —
 * prefixing a raw local number with "+" reads as a different number.
 */
export function displayPhone(phone) {
  const wa = waPhone(phone)
  if (!wa) return '—'
  if (!wa.startsWith('60')) return `+${wa}`

  const local = wa.slice(2)
  if (local.length === 10) return `+60 ${local.slice(0, 2)}-${local.slice(2, 6)} ${local.slice(6)}`
  if (local.length === 9) return `+60 ${local.slice(0, 2)}-${local.slice(2, 5)} ${local.slice(5)}`
  return `+60 ${local}`
}

/**
 * Normalises Malaysian numbers into the wa.me format (digits only, country
 * code, no leading zero). `012-345 6789` becomes `60123456789`.
 */
export function waPhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('60')) return digits
  if (digits.startsWith('0')) return `60${digits.slice(1)}`
  return digits
}
