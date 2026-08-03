/**
 * One way in to the model, shared by both AI endpoints.
 *
 * Google's free tier meters per model, so a busy afternoon exhausts the
 * default while lighter models still answer. Rather than dropping the whole
 * feature to its templates on the first 429, this walks a short list and only
 * gives up when every one of them is out — at which point the caller's
 * fallback takes over, as before.
 */

const CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
].filter(Boolean)

const KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

/** Statuses worth trying the next model for: out of quota, gone, or upstream. */
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504])

export async function callGemini(prompt, { json = false } = {}) {
  if (!KEY) throw new Error('no-key')

  let lastError = new Error('gemini-unavailable')

  for (const model of [...new Set(CANDIDATES)]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: json ? 0 : 0.4,
              ...(json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        },
      )

      if (!res.ok) {
        lastError = new Error(`gemini-${res.status}`)
        if (RETRYABLE.has(res.status)) continue
        throw lastError
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        lastError = new Error('gemini-empty')
        continue
      }
      return text.replace(/```json|```/g, '').trim()
    } catch (err) {
      lastError = err
    }
  }

  throw lastError
}
