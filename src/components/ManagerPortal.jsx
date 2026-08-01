import { useState } from 'react'
import { supabase } from '../lib/supabase'

function ManagerPortal() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setError(null)
    setAnswer(null)

    try {
      // Fetch relevant order data (kept broad here; backend/AI narrows the focus)
      const { data: ordersData, error: fetchError } = await supabase
        .from('orders')
        .select('order_no, customer_name, service_type, assigned_technician, status, quoted_price, final_amount, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, ordersData }),
      })

      if (!response.ok) {
        throw new Error('Failed to get a response from the assistant')
      }

      const result = await response.json()
      setAnswer(result.answer)
      setHistory([{ question, answer: result.answer }, ...history])
      setQuestion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-4">Operations Assistant</h2>

      <form onSubmit={handleAsk} className="bg-white p-4 rounded-lg shadow-sm border flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What jobs did Ali complete last week?"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-4 whitespace-pre-line">
          {answer}
        </div>
      )}

      {history.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Previous questions</h3>
          <div className="space-y-2">
            {history.slice(1).map((h, i) => (
              <div key={i} className="bg-gray-50 border rounded p-3 text-sm">
                <p className="font-medium text-gray-700">{h.question}</p>
                <p className="text-gray-600 mt-1">{h.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400">
        Try: "What jobs did Ali complete?", "Which technician has the most jobs?", "How many jobs are completed?"
      </div>
    </div>
  )
}

export default ManagerPortal