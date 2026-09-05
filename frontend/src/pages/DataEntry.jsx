import { useState } from 'react'
import { ClipboardList, Save, CheckCircle, Loader2 } from 'lucide-react'
import { api } from '../services/api.js'

export default function DataEntry() {
  const [form, setForm] = useState({
    shift: 'Shift 1',
    line: 'Line A',
    productionCount: '',
    defectCount: '',
    downtimeMinutes: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        ...form,
        productionCount: Number(form.productionCount) || 0,
        defectCount: Number(form.defectCount) || 0,
        downtimeMinutes: Number(form.downtimeMinutes) || 0,
      }
      await api.createDataEntry(payload)
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
      setForm({
        shift: 'Shift 1',
        line: 'Line A',
        productionCount: '',
        defectCount: '',
        downtimeMinutes: '',
        notes: ''
      })
    } catch (err) {
      console.error('Failed to submit:', err)
      setError(err.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Data Entry</h1>
        <p className="text-xs text-text-muted mt-1">Record production data and downtime</p>
      </div>

      {submitted && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3 text-green-400">
          <CheckCircle size={20} />
          <span className="font-medium text-sm">Data entry submitted successfully!</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-bg-card rounded-xl border border-border p-5 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Shift</label>
            <select
              name="shift"
              value={form.shift}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option>Shift 1</option>
              <option>Shift 2</option>
              <option>Shift 3</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Production Line</label>
            <select
              name="line"
              value={form.line}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option>Line A</option>
              <option>Line B</option>
              <option>Line C</option>
              <option>Line D</option>
              <option>Line E</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Production Count</label>
            <input
              type="number"
              name="productionCount"
              value={form.productionCount}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter production count"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Defect Count</label>
            <input
              type="number"
              name="defectCount"
              value={form.defectCount}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter defect count"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Downtime (minutes)</label>
            <input
              type="number"
              name="downtimeMinutes"
              value={form.downtimeMinutes}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter downtime in minutes"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-bg-panel border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {submitting ? 'Submitting...' : 'Submit Entry'}
        </button>
      </form>
    </div>
  )
}
