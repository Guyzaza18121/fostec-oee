import Availability from './Availability'
import Performance from './Performance'
import Quality from './Quality'

export default function OEEMetrics() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">OEE Metrics</h1>
        <p className="mt-1 text-xs text-text-muted">
          รวมข้อมูล Availability, Performance และ Quality ไว้ในหน้าเดียว
        </p>
      </div>

      <section id="availability" className="scroll-mt-4">
        <div className="mb-2 text-sm font-black text-emerald-300">Availability</div>
        <Availability />
      </section>

      <section id="performance" className="scroll-mt-4">
        <div className="mb-2 text-sm font-black text-amber-300">Performance</div>
        <Performance />
      </section>

      <section id="quality" className="scroll-mt-4">
        <div className="mb-2 text-sm font-black text-violet-300">Quality</div>
        <Quality />
      </section>
    </div>
  )
}
