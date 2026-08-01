import { createContext, useContext } from 'react'

/**
 * Split out from `SessionContext.jsx` so that file exports only a component —
 * mixing component and non-component exports breaks React Fast Refresh.
 */
export const SessionContext = createContext(null)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
