import { useEffect, useState } from 'react'
import { checkSchema } from '../lib/supabase.js'
import { Alert } from './ui.jsx'

/**
 * The app connects with a publishable key, which can read and write rows but
 * cannot create tables or storage buckets. If `supabase/schema.sql` has not
 * been run, uploads and the audit trail silently no-op — so say so out loud
 * instead of letting the reviewer wonder why nothing is logged.
 */
function SchemaBanner() {
  const [state, setState] = useState(null)

  useEffect(() => {
    checkSchema().then(setState).catch(() => setState(null))
  }, [])

  if (!state || state.ready) return null

  return (
    <div className="mb-5 pt-5">
      <Alert tone="warning" title="Database migration not applied yet">
        Missing tables: <span className="font-mono">{state.missing.join(', ')}</span>. Orders still
        work, but file uploads, the audit trail, WhatsApp logging and AI flags are disabled. Run{' '}
        <span className="font-mono">supabase/schema.sql</span> in the Supabase SQL editor, then
        reload.
      </Alert>
    </div>
  )
}

export default SchemaBanner
