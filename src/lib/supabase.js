import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')

export const JOB_FILES_BUCKET = 'job-files'

/**
 * PostgREST reports a missing table as PGRST205 and a missing column as
 * PGRST204. Both mean "supabase/schema.sql has not been run yet" rather than
 * a genuine failure, so callers can degrade instead of showing an error.
 */
export function isMissingSchema(error) {
  return error?.code === 'PGRST205' || error?.code === 'PGRST204'
}

let schemaProbe = null

/**
 * Checks once per session whether the migration has been applied, so the UI
 * can show a setup banner rather than a wall of failed writes.
 */
export function checkSchema() {
  if (!schemaProbe) {
    schemaProbe = (async () => {
      const results = await Promise.all(
        ['audit_log', 'job_files', 'notifications'].map(async (table) => {
          const { error } = await supabase.from(table).select('id').limit(1)
          return { table, ok: !isMissingSchema(error) }
        }),
      )
      const missing = results.filter((r) => !r.ok).map((r) => r.table)
      return { ready: missing.length === 0, missing }
    })()
  }
  return schemaProbe
}
