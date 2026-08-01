import { useEffect, useMemo, useState } from 'react'
import { SessionContext } from './session.js'
import { listTechnicians } from '../lib/orders.js'
import { FALLBACK_TECHNICIANS } from '../lib/constants.js'

/**
 * Mock login.
 *
 * The brief allows a role switcher instead of real auth. The shape here
 * deliberately mirrors what a real session would carry — role plus identity —
 * so swapping in Supabase Auth later means replacing this provider's internals
 * and nothing else. Every write records `actor` from this context, which is
 * what makes the audit trail meaningful.
 */

const STORAGE_KEY = 'sejuk.session'

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.role) return saved
  } catch {
    /* ignore malformed storage */
  }
  return { role: 'Admin', name: 'Nurul (Admin)' }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(loadSession)
  const [technicians, setTechnicians] = useState(FALLBACK_TECHNICIANS)

  useEffect(() => {
    listTechnicians().then(setTechnicians).catch(() => setTechnicians(FALLBACK_TECHNICIANS))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const value = useMemo(() => {
    const signIn = (role, name) => {
      if (role === 'Technician') {
        const tech = technicians.find((t) => t.name === name) ?? technicians[0]
        setSession({ role, name: tech?.name ?? 'Ali', phone: tech?.phone, branch: tech?.branch })
        return
      }
      setSession({
        role,
        name: name ?? (role === 'Manager' ? 'Faizal (Manager)' : 'Nurul (Admin)'),
      })
    }

    /* There is no real auth to sign out of — this drops back to the default
       identity, which is what the power control in the sidebar means here. */
    const resetSession = () => setSession({ role: 'Admin', name: 'Nurul (Admin)' })

    return {
      session,
      technicians,
      signIn,
      resetSession,
      isAdmin: session.role === 'Admin',
      isManager: session.role === 'Manager',
      isTechnician: session.role === 'Technician',
      /** The identity stamped onto audit rows and completion records. */
      actor: { role: session.role, name: session.name },
    }
  }, [session, technicians])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
