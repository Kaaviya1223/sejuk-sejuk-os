export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { question, ordersData } = req.body

  try {
    // Step 1: Classify intent
    const classifyResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Classify this manager question into one of these intents: jobs_by_technician, top_technician, jobs_completed_count, technician_workload_check, unsupported.
Extract parameters as JSON only, no explanation. Format: {"intent": "...", "technician": "...", "date_range": "..."}
If it doesn't match any intent, return {"intent": "unsupported"}.
Question: "${question}"`
            }]
          }]
        })
      }
    )
    const classifyData = await classifyResponse.json()
    const classifyText = classifyData.candidates[0].content.parts[0].text
    const cleaned = classifyText.replace(/```json|```/g, '').trim()
    const intent = JSON.parse(cleaned)

    if (intent.intent === 'unsupported') {
      return res.status(200).json({
        answer: "I can currently answer questions about jobs by technician, completion counts, or technician workload. Try rephrasing your question.",
        intent: 'unsupported'
      })
    }

    // Step 2: Format the answer using the already-fetched order data (passed in from frontend)
    const formatResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an operations assistant. Based ONLY on this order data (do not invent anything beyond it), answer the manager's question clearly and concisely.
Order data: ${JSON.stringify(ordersData)}
Question: "${question}"`
            }]
          }]
        })
      }
    )
    const formatData = await formatResponse.json()
    const answer = formatData.candidates[0].content.parts[0].text

    return res.status(200).json({ answer, intent: intent.intent })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}