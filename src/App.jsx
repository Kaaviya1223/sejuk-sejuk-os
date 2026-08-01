import { useEffect, useState } from 'react'
import {
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Power,
  Snowflake,
  Sparkles,
  Trophy,
  Wrench,
  X,
} from 'lucide-react'

import { SessionProvider } from './context/SessionContext.jsx'
import { useSession } from './context/session.js'
import RoleSwitcher from './components/RoleSwitcher.jsx'
import SchemaBanner from './components/SchemaBanner.jsx'
import { dateOnly } from './lib/format.js'

import Overview from './pages/Overview.jsx'
import AdminOrders from './pages/AdminOrders.jsx'
import OpsAssistant from './pages/OpsAssistant.jsx'
import Performance from './pages/Performance.jsx'
import TechnicianPortal from './pages/TechnicianPortal.jsx'

const NAV = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager'] },
  { key: 'orders', label: 'Orders', icon: ClipboardList, roles: ['Admin', 'Manager'] },
  { key: 'performance', label: 'Performance', icon: Trophy, roles: ['Admin', 'Manager'] },
  { key: 'assistant', label: 'Assistant', icon: Sparkles, roles: ['Manager'] },
  { key: 'jobs', label: 'My Jobs', icon: Wrench, roles: ['Technician'] },
]

const PAGES = {
  overview: Overview,
  orders: AdminOrders,
  performance: Performance,
  assistant: OpsAssistant,
  jobs: TechnicianPortal,
}

/** The wordmark, used in the top bar on both shells. */
function Wordmark({ tone = 'dark' }) {
  const dark = tone === 'dark'
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          dark ? 'bg-brand-sweep' : 'bg-white/15'
        }`}
      >
        <Snowflake size={17} className="text-white" strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span
          className={`block font-display text-sm font-semibold tracking-tight ${
            dark ? 'text-marine' : 'text-white'
          }`}
        >
          Sejuk Sejuk <span className={dark ? 'text-coolant' : 'text-coolant-200'}>Ops</span>
        </span>
        <span className={`block text-[10px] ${dark ? 'text-slate-light' : 'text-white/60'}`}>
          Field Service Management
        </span>
      </span>
    </span>
  )
}

function Shell() {
  const { session, isTechnician, resetSession } = useSession()
  const [view, setView] = useState(() => window.location.hash.slice(1) || 'overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)

  const available = NAV.filter((item) => item.roles.includes(session.role))

  // Switching roles can strand you on a page you may no longer open.
  useEffect(() => {
    if (!available.some((item) => item.key === view)) setView(available[0]?.key ?? 'overview')
  }, [session.role, view, available])

  // Keep the URL hash in step so a refresh returns to the same page.
  useEffect(() => {
    window.location.hash = view
    setMenuOpen(false)
  }, [view])

  const Page = PAGES[view] ?? Overview

  /* The technician portal gets its own chrome: no sidebar, thumb-reachable
     navigation, full-bleed content. Field staff are on phones. */
  if (isTechnician) {
    return (
      <div className="min-h-screen bg-frost">
        <header className="sticky top-0 z-30 overflow-hidden bg-brand-sweep px-4 py-3 shadow-lift">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-brand-glow" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50 [background-size:16px_16px]"
          />
          <div className="relative mx-auto flex max-w-2xl items-center justify-between gap-3">
            <Wordmark tone="light" />
            <div className="w-44">
              <RoleSwitcher compact />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-5 pb-safe">
          <SchemaBanner />
          <TechnicianPortal />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-frost">
      {/* Top bar — spans the full width, above the sidebar column. */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-line bg-white px-4 lg:px-6">
        <div className="w-auto lg:w-52">
          <Wordmark />
        </div>

        {/* One control, two behaviours: the slide-over below `lg`, the
            collapsible rail above it. */}
        <button
          onClick={() => {
            setMenuOpen((v) => !v)
            setRailOpen((v) => !v)
          }}
          className="rounded-lg p-2 text-slate transition hover:bg-frost hover:text-marine"
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <TopIcon icon={LifeBuoy} label="Support" />
          <TopIcon icon={CalendarDays} label="Schedule" />
          <TopIcon icon={Bell} label="Notifications" dot />
        </div>

        <div className="ml-1 hidden sm:block">
          <RoleSwitcher variant="bar" />
        </div>
      </header>

      <div className="flex">
        {/* Desktop rail. The wrapper carries the gradient's closing colour so
            the column still reads as one surface on pages taller than the
            viewport, where the sticky panel itself stops at the fold. */}
        <div className={`hidden w-60 shrink-0 bg-coolant ${railOpen ? 'lg:block' : ''}`}>
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col bg-brand-column">
            <SidebarBody
              items={available}
              view={view}
              onSelect={setView}
              onReset={resetSession}
              name={session.name}
            />
          </div>
        </div>

        {/* Slide-over for small screens */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand-column transition-transform lg:hidden ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            className="absolute right-3 top-3 z-10 text-white/70"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          <SidebarBody
            items={available}
            view={view}
            onSelect={setView}
            onReset={resetSession}
            name={session.name}
          />
        </aside>

        {menuOpen && (
          <button
            className="fixed inset-0 z-30 bg-marine/40 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          />
        )}

        {/* No top padding: the page's brand band butts up against the top bar. */}
        <main className="min-w-0 flex-1 px-4 pb-8 sm:px-6 lg:px-8">
          <SchemaBanner />
          <Page onNavigate={setView} today={dateOnly(new Date())} />
        </main>
      </div>
    </div>
  )
}

/** Shared by the desktop rail and the mobile slide-over. */
function SidebarBody({ items, view, onSelect, onReset, name }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white">
          Welcome, {String(name).split(/[\s(]/)[0]}
        </p>
        <button
          onClick={onReset}
          className="shrink-0 rounded-lg p-1 text-white/70 transition hover:bg-white/15 hover:text-white"
          aria-label="Reset mock session"
          title="Reset mock session"
        >
          <Power size={16} />
        </button>
      </div>

      <nav className="relative flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? 'bg-white/20 font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-inset ring-white/25'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                />
              )}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                  active ? 'bg-white/25' : 'bg-white/10 group-hover:bg-white/20'
                }`}
              >
                <Icon size={16} strokeWidth={2} />
              </span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* A soft light pooling at the base of the column. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(20rem_10rem_at_50%_120%,rgba(255,255,255,0.22),transparent_70%)]"
      />

      <div className="relative border-t border-white/15 p-3">
        <RoleSwitcher />
      </div>
    </div>
  )
}

function TopIcon({ icon: Icon, label, dot = false }) {
  return (
    <button
      className="relative rounded-lg p-2 text-slate transition hover:bg-frost hover:text-marine"
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
      {dot && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-copper" />
      )}
    </button>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  )
}
