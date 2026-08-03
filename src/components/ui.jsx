import { AlertTriangle, Check, ChevronDown, Info, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every desktop page opens on the same brand band, which runs edge to edge
 * behind the content column. `deep` adds room at the bottom for a KPI row to
 * sit half on the band and half on the canvas.
 */
export function PageHeader({ title, subtitle, actions, deep = false }) {
  return (
    <div
      className={`bleed relative isolate overflow-hidden bg-brand-sweep px-4 pt-6 sm:px-6 lg:px-8 ${
        deep ? 'pb-20' : 'mb-6 pb-6'
      }`}
    >
      {/* Decorative layers: two soft lights, a fine dot grid, and a pair of
          outsized rings bleeding off the right edge. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-brand-glow" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-dot-grid opacity-60 [background-size:18px_18px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full border border-white/15"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-10 -z-10 h-44 w-44 rounded-full border border-white/10"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-line bg-surface shadow-tile transition duration-200 hover:shadow-lift ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Card headings are the dashboard's signposts, so they carry the brand blue
 * at a weight you can find while scanning — the body underneath stays quiet.
 */
export function CardHeader({ title, subtitle, actions, divided = true, accent = 'brand' }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 bg-gradient-to-b from-frost/50 to-transparent px-5 py-4 ${
        divided ? 'border-b border-slate-line' : ''
      }`}
    >
      <div className="min-w-0">
        {/* A short rule above the title — the card's own signature. `warn`
            marks the cards that are asking for something rather than
            reporting, so they don't read as one more panel of numbers. */}
        <span
          aria-hidden
          className={`mb-2 block h-1 w-8 rounded-full bg-gradient-to-r ${
            accent === 'warn' ? 'from-copper to-amber-500' : 'from-coolant to-marine-500'
          }`}
        />
        <h2 className="font-display text-base font-semibold tracking-tight text-brand">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary: 'bg-marine text-white hover:bg-marine-600 disabled:bg-marine/40',
  accent: 'bg-coolant text-white hover:bg-coolant-600 disabled:bg-coolant/40',
  // Green appears on exactly one kind of button: the one that finishes a job.
  success: 'bg-success text-white hover:bg-success-600 disabled:bg-success/40',
  outline: 'border border-slate-line bg-surface text-ink hover:bg-frost disabled:text-slate-light',
  ghost: 'text-slate hover:bg-frost-deep hover:text-ink',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  whatsapp: 'bg-[#25D366] text-[#0B3B23] hover:brightness-95',
  // For use on the brand band, where a filled navy button would sink into it.
  band: 'bg-white/15 text-white ring-1 ring-inset ring-white/30 hover:bg-white/25',
  bandSolid: 'bg-surface text-brand hover:bg-frost disabled:text-slate-light',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
  }

  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${
        BUTTON_VARIANTS[variant]
      } ${sizes[size]} ${className}`}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/**
 * A labelled field.
 *
 * A short hint ("RM", "Optional") rides the label line as a suffix. A longer
 * one moves below the input: sharing the line made the label wrap, which made
 * that cell taller than its neighbour and knocked the two columns out of
 * alignment. The label always gets one line to itself.
 */
export function Field({ label, hint, error, required, children, className = '' }) {
  const inline = hint && String(hint).length <= 12

  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-copper">*</span>}
        </span>
        {inline && <span className="shrink-0 text-xs text-slate-light">{hint}</span>}
      </span>
      {children}
      {hint && !inline && <span className="mt-1 block text-xs text-slate-light">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

const CONTROL =
  'w-full rounded-lg border border-slate-line bg-surface px-3 py-2 text-ink placeholder:text-slate-light transition focus:border-marine-500 focus:outline-none disabled:bg-frost disabled:text-slate'

export function Input({ className = '', ...props }) {
  return <input {...props} className={`${CONTROL} ${className}`} />
}

export function Textarea({ className = '', rows = 3, ...props }) {
  return <textarea {...props} rows={rows} className={`${CONTROL} resize-y ${className}`} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select {...props} className={`${CONTROL} ${className}`}>
      {children}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  )
}

/** A grey block standing in for content that is on its way. */
export function Skeleton({ className = '' }) {
  return <span className={`skeleton block ${className}`} />
}

/**
 * Rows of skeletons shaped like the list they replace, so the page doesn't
 * jump when the data lands.
 */
export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="divide-y divide-slate-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-44 rounded" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="hidden h-2.5 w-24 rounded sm:block" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Info, title, children }) {
  return (
    <div className="px-5 py-12 text-center">
      {/* Halo, ring, chip — an empty list is the most-seen screen in a new
          deployment, so it gets a little ceremony. */}
      <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-to-br from-coolant/25 to-marine-500/20 blur-md"
        />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-line bg-gradient-to-br from-surface to-frost-deep text-coolant shadow-tile">
          <Icon size={21} />
        </span>
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-sm text-slate">{children}</p>}
    </div>
  )
}

const ALERT_STYLES = {
  info: {
    wrap: 'border-coolant-200 bg-coolant-50 text-ink dark:border-coolant/40',
    icon: Info,
  },
  success: {
    wrap:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-success/40 dark:bg-success/15 dark:text-[#9BE3B0]',
    icon: Check,
  },
  warning: {
    wrap:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-200',
    icon: AlertTriangle,
  },
  error: {
    wrap:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-400/15 dark:text-red-200',
    icon: AlertTriangle,
  },
}

export function Alert({ tone = 'info', title, children, onDismiss }) {
  const { wrap, icon: Icon } = ALERT_STYLES[tone] ?? ALERT_STYLES.info
  return (
    <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${wrap}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={15} />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

/**
 * Full-screen on mobile, centred dialog on desktop — the technician flows use
 * this as a bottom sheet and the desktop portals as a modal.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-marine/40 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        className={`animate-rise flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-sheet sm:rounded-2xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-line px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate hover:bg-frost">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-slate-line bg-frost/60 px-5 py-3 pb-safe sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/**
 * KPI tile. A headline count is a number, not a one-bar chart — the icon
 * carries the category and the value stays in proportional figures so it
 * doesn't read loose at display size.
 */
/**
 * Tile tones. Each is a gradient chip plus a matching glow, so the icon reads
 * as an object sitting on the card and the row of tiles carries colour.
 */
const TONES = {
  brand: { chip: 'from-marine-500 to-marine-600', glow: 'shadow-glow-blue', rail: 'bg-marine-500' },
  accent: { chip: 'from-coolant to-coolant-600', glow: 'shadow-glow-teal', rail: 'bg-coolant' },
  amber: { chip: 'from-amber-400 to-amber-600', glow: 'shadow-glow-amber', rail: 'bg-amber-500' },
  copper: { chip: 'from-[#D98B6E] to-copper', glow: 'shadow-glow-copper', rail: 'bg-copper' },
  // Green is the finished tone — kept for counts of completed work only.
  success: {
    chip: 'from-success to-success-600',
    glow: 'shadow-glow-green',
    rail: 'bg-success',
  },
  slate: { chip: 'from-slate-light to-slate', glow: 'shadow-glow-slate', rail: 'bg-slate' },
}

export function Stat({ label, value, sub, icon: Icon, loading = false, tone = 'accent' }) {
  const { chip, glow, rail } = TONES[tone] ?? TONES.accent

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-line bg-card-sheen p-4 shadow-tile transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      {/* A colour rail on the top edge, and the tone bleeding in from the corner. */}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${rail} opacity-80`} />
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${chip} opacity-[0.07] transition-opacity duration-200 group-hover:opacity-[0.14]`}
      />

      {Icon && (
        <div
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${chip} ${glow}`}
        >
          <Icon size={19} strokeWidth={2} />
        </div>
      )}

      {loading ? (
        <Skeleton className="h-7 w-14 rounded" />
      ) : (
        <p
          className={`whitespace-nowrap font-semibold leading-none tracking-tight text-ink ${
            String(value).length > 5 ? 'text-xl' : 'text-[28px]'
          }`}
        >
          {value}
        </p>
      )}

      <p className="mt-1.5 text-xs font-medium text-slate">{label}</p>
      {sub && !loading && <p className="mt-1 text-[11px] text-slate-light">{sub}</p>}
    </div>
  )
}

/**
 * A titled section that collapses — the technician's job record is a stack of
 * these, so a phone screen opens on the part that matters and the rest stays
 * one tap away.
 */
export function Section({ title, icon: Icon, children, defaultOpen = true, meta }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        {Icon && <Icon size={15} className="shrink-0 text-coolant" />}
        <span className="flex-1 font-display text-sm font-semibold text-brand">{title}</span>
        {meta && <span className="text-[11px] text-slate">{meta}</span>}
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-light transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-slate-line px-4 py-3">{children}</div>}
    </div>
  )
}

/** A label/value row, as used inside `Section`. */
export function Row({ label, children, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${className}`}>
      <span className="shrink-0 text-xs text-slate">{label}</span>
      <span className="min-w-0 text-right text-sm text-ink">{children}</span>
    </div>
  )
}

export function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-frost-deep text-slate',
    accent: 'bg-coolant-50 text-coolant-700',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-success/20 dark:text-[#7FD79A]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
