/**
 * Calls to this app's own serverless functions (`/api/*`).
 *
 * They only exist where a serverless runtime does: `npm run dev`, which serves
 * the folder through a Vite plugin, and a deployment that builds `api/`. A
 * static host answers them with an empty 404, and `res.json()` on that reads
 * "Unexpected end of JSON input" — a parser error naming the symptom instead of
 * the cause. So every call goes through here, where the body is read as text
 * and a missing endpoint gets said out loud.
 */

const MISSING_ENDPOINT =
  'This runs as a serverless function, so it needs `npm run dev` or a deployment that builds `api/`. A static preview of the built files serves the pages but not the API.'

export async function postJson(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!data) {
    throw new Error(
      res.status === 404 ? MISSING_ENDPOINT : `No readable response (HTTP ${res.status}).`,
    )
  }
  if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status}).`)

  return data
}
