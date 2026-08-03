import { useState } from 'react'
import { ChevronDown, ShieldCheck, UserCog, Wrench } from 'lucide-react'
import { useSession } from '../context/session.js'
import { initials } from '../lib/format.js'

const ROLE_META = {
  Admin: { icon: UserCog, blurb: 'Creates orders, assigns technicians' },
  Technician: { icon: Wrench, blurb: 'Completes assigned field jobs' },
  Manager: { icon: ShieldCheck, blurb: 'Reviews jobs, sees KPIs and AI tools' },
}

/**
 * Mock login. Picking "Technician" also picks *which* technician, because the
 * rule "only the assigned technician may complete a job" is meaningless
 * without an identity to check against.
 *
 * Three placements: the sidebar's user card (default), the white top bar
 * (`variant="bar"`), and the technician's green header (`compact`).
 */
function RoleSwitcher({ compact = false, variant = 'panel' }) {
  const { session, technicians, signIn } = useSession()
  const [open, setOpen] = useState(false)
  const Icon = ROLE_META[session.role]?.icon ?? UserCog
  const onBar = variant === 'bar'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
          onBar ? 'hover:bg-frost' : 'bg-white/10 hover:bg-white/20'
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            onBar ? 'bg-marine-100 text-ink' : 'bg-white/20 text-white'
          }`}
        >
          {initials(session.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-medium ${onBar ? 'text-ink' : 'text-white'}`}
          >
            {session.name}
          </span>
          {!compact && (
            <span
              className={`flex items-center gap-1 text-[11px] ${
                onBar ? 'text-slate' : 'text-white/65'
              }`}
            >
              <Icon size={11} />
              {session.role}
              {session.branch ? ` · ${session.branch}` : ''}
            </span>
          )}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition ${onBar ? 'text-slate-light' : 'text-white/60'} ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close role menu"
          />
          <div
            className={`absolute z-20 w-full min-w-[240px] overflow-hidden rounded-xl border border-slate-line bg-surface shadow-lift ${
              onBar || compact ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2'
            }`}
          >
            <p className="border-b border-slate-line bg-frost px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate">
              Switch role (mock login)
            </p>

            {['Admin', 'Manager'].map((role) => {
              const RoleIcon = ROLE_META[role].icon
              return (
                <button
                  key={role}
                  onClick={() => {
                    signIn(role)
                    setOpen(false)
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-frost ${
                    session.role === role ? 'bg-coolant-50' : ''
                  }`}
                >
                  <RoleIcon size={15} className="mt-0.5 text-coolant" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{role}</span>
                    <span className="block text-[11px] text-slate">{ROLE_META[role].blurb}</span>
                  </span>
                </button>
              )
            })}

            <p className="border-y border-slate-line bg-frost px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate">
              Technician
            </p>
            {technicians.map((tech) => (
              <button
                key={tech.name}
                onClick={() => {
                  signIn('Technician', tech.name)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-frost ${
                  session.role === 'Technician' && session.name === tech.name ? 'bg-coolant-50' : ''
                }`}
              >
                <Wrench size={14} className="text-slate" />
                <span className="text-sm text-ink">{tech.name}</span>
                {tech.branch && <span className="ml-auto text-[11px] text-slate">{tech.branch}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default RoleSwitcher
