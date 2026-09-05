import { useState, useEffect } from 'react'
import { ScrollText, RefreshCw } from 'lucide-react'
import { getLogs } from '../services/logApi.js'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getLogs(100)
      setLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <ScrollText className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">Activity Log</div>
              <div className="text-xs text-slate-400">บันทึกการทำงานของผู้ใช้ในระบบ</div>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        {error && (
          <div className="mb-3 inline-block rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-slate-400">
                <th className="py-2 pr-4 font-medium">เวลา</th>
                <th className="py-2 pr-4 font-medium">ผู้ใช้</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    ยังไม่มีบันทึกกิจกรรม
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-b border-border/50 hover:bg-bg-panel/40">
                    <td className="py-2 pr-4 text-slate-300 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-2 pr-4 text-slate-300">{log.username || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                        log.action?.includes('ลบ') || log.action?.includes('DELETE')
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                          : log.action?.includes('สร้าง') || log.action?.includes('CREATE')
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-300">{log.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
