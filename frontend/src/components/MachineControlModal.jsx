import { useState } from 'react'
import PropTypes from 'prop-types'
import { getStopTimeMinutes, getWorkingTimeMinutes } from '../utils/machineTime.js'

export default function MachineControlModal({ machine, onClose, showRuntime = false }) {
  const [machineMode, setMachineMode] = useState('auto')
  const [controlState, setControlState] = useState('run')
  const [manualReason, setManualReason] = useState('')
  const [availVal, setAvailVal] = useState(92)
  const [perfVal, setPerfVal] = useState(91)
  const [qualVal, setQualVal] = useState(97)

  const isManual = machineMode === 'manual'
  const oeeCalc = Math.round((availVal * perfVal * qualVal) / 10000 * 10) / 10

  const runActive = controlState === 'run' && isManual
  const idleActive = controlState === 'idle' && isManual
  const stopActive = controlState === 'stop' && isManual
  const workingTimeMinutes = getWorkingTimeMinutes(machine)
  const stopTimeMinutes = getStopTimeMinutes(machine)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
      <div className="relative w-150 max-w-full overflow-hidden rounded-xl border border-border panel-modal">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">⚙️ Machine Control: {machine.name}</span>
          <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4 text-sm text-slate-300">
          <style>{`
            input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; position: absolute; top: 0; left: 0; height: 100%; margin: 0; }
            input[type=range]:disabled { cursor: not-allowed; opacity: 0; }
            input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 10px rgba(255,255,255,0.5); border: 2px solid #0f172a; position: relative; z-index: 50; cursor: pointer; }
            input[type=range]:disabled::-webkit-slider-thumb { display: none; }
          `}</style>
          <div className="space-y-6 p-1">
            {showRuntime && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-bg-panel/50 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Status</div>
                  <div className="mt-1 font-mono text-sm font-bold uppercase text-slate-100">{machine.status || 'waiting'}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-emerald-200/80">Working time</div>
                  <div className="mt-1 font-mono text-sm font-bold text-emerald-200">{workingTimeMinutes.toLocaleString()} min</div>
                </div>
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-rose-200/80">Stop time</div>
                  <div className="mt-1 font-mono text-sm font-bold text-rose-200">{stopTimeMinutes.toLocaleString()} min</div>
                </div>
              </div>
            )}
            <div className="flex justify-center">
              <div className="bg-slate-800/80 p-1 rounded-xl border border-white/5 flex gap-1">
                <button onClick={() => setMachineMode('auto')} className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${machineMode === 'auto' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-400'}`}>AUTO MODE</button>
                <button onClick={() => setMachineMode('manual')} className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${machineMode === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-400'}`}>MANUAL MODE</button>
              </div>
            </div>
            <div className={`bg-slate-900/40 rounded-3xl p-6 border border-white/5 shadow-inner transition-opacity ${isManual ? 'opacity-100' : 'opacity-80'}`}>
              <div className="flex justify-around items-center mb-8">
                <button onClick={() => setControlState('run')} disabled={!isManual} className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300
                  ${runActive ? 'border-emerald-500 bg-emerald-500/10 scale-110' : 'border-transparent'}
                  ${!isManual ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}>
                  <span className="text-2xl mb-1">▶️</span>
                  <span className={`text-[10px] font-black ${runActive ? 'text-emerald-400' : !isManual ? 'text-slate-600' : 'text-emerald-500/40'}`}>RUN</span>
                </button>
                <button onClick={() => setControlState('idle')} disabled={!isManual} className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300
                  ${idleActive ? 'border-amber-500 bg-amber-500/10 scale-110' : 'border-transparent'}
                  ${!isManual ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}>
                  <span className="text-2xl mb-1">⏸️</span>
                  <span className={`text-[10px] font-black ${idleActive ? 'text-amber-400' : !isManual ? 'text-slate-600' : 'text-amber-500/40'}`}>IDLE</span>
                </button>
                <button onClick={() => setControlState('stop')} disabled={!isManual} className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300
                  ${stopActive ? 'border-red-500 bg-red-500/10 scale-110' : 'border-transparent'}
                  ${!isManual ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}>
                  <span className="text-2xl mb-1">⛔</span>
                  <span className={`text-[10px] font-black ${stopActive ? 'text-red-400' : !isManual ? 'text-slate-600' : 'text-red-500/40'}`}>STOP</span>
                </button>
              </div>
              {isManual && (
                <div className="mb-6">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">เหตุผล (Manual)</div>
                  <select value={manualReason} onChange={(e) => setManualReason(e.target.value)} className="w-full rounded-xl border border-border bg-bg-panel/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500">
                    <option value="">- เลือกสาเหตุ -</option>
                    <option value="ปรับตั้งค่าเครื่อง">ปรับตั้งค่าเครื่อง</option>
                    <option value="ทดสอบ/ยืนยันการผลิต">ทดสอบ/ยืนยันการผลิต</option>
                    <option value="ปัญหาคุณภาพ">ปัญหาคุณภาพ</option>
                    <option value="ขาดวัตถุดิบ">ขาดวัตถุดิบ</option>
                    <option value="ซ่อมบำรุง">ซ่อมบำรุง</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
              )}
              <div className="space-y-5">
                <div className={`space-y-2 transition-all ${!isManual ? 'grayscale opacity-50' : ''}`}>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-orange-500"><span>Availability</span> <span>{availVal}%</span></div>
                  <div className="relative h-2 bg-slate-800 rounded-full"><div className="absolute h-full bg-orange-500 rounded-full" style={{ width: `${availVal}%` }}></div><input min="0" max="100" disabled={!isManual} type="range" value={availVal} onInput={(e) => setAvailVal(Number(e.target.value))} /></div>
                </div>
                <div className={`space-y-2 transition-all ${!isManual ? 'grayscale opacity-50' : ''}`}>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-yellow-400"><span>Performance</span> <span>{perfVal}%</span></div>
                  <div className="relative h-2 bg-slate-800/50 rounded-full"><div className="absolute h-full bg-yellow-400 rounded-full" style={{ width: `${perfVal}%` }}></div><input min="0" max="100" disabled={!isManual} type="range" value={perfVal} onInput={(e) => setPerfVal(Number(e.target.value))} /></div>
                </div>
                <div className={`space-y-2 transition-all ${!isManual ? 'grayscale opacity-50' : ''}`}>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-blue-500"><span>Quality</span> <span>{qualVal}%</span></div>
                  <div className="relative h-2 bg-slate-800/50 rounded-full"><div className="absolute h-full bg-blue-500 rounded-full" style={{ width: `${qualVal}%` }}></div><input min="0" max="100" disabled={!isManual} type="range" value={qualVal} onInput={(e) => setQualVal(Number(e.target.value))} /></div>
                </div>
                <div className={`space-y-2 transition-all ${!isManual ? 'grayscale opacity-50' : ''}`}>
                  <div className="flex justify-between text-[12px] font-black uppercase tracking-widest text-emerald-400"><span>OEE = <span className="text-[9px] text-slate-400"> ({availVal}% × {perfVal}% × {qualVal}%)/10,000</span></span> <span>{oeeCalc}%</span></div>
                  <div className="relative h-2 bg-slate-800/50 rounded-full"><div className="absolute h-full bg-emerald-500 rounded-full" style={{ width: `${oeeCalc}%` }}></div></div>
                </div>
                <div className="pt-6 border-t border-white/5 text-center">
                  <div className="text-[10px] text-slate-400 tracking-[0.3em] font-bold mb-1 uppercase">Calculated OEE Index</div>
                  <div className={`text-5xl font-black font-mono tracking-tighter italic transition-colors ${isManual ? 'text-emerald-400' : 'text-slate-600'}`}>{oeeCalc}<span className="text-xl not-italic opacity-30 ml-1">%</span></div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-800 text-slate-400 text-xs font-bold uppercase hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => { alert(`บันทึกการตั้งค่า ${machine.name} เรียบร้อย\nMode: ${machineMode.toUpperCase()}\nState: ${controlState.toUpperCase()}\nOEE: ${oeeCalc}%`); onClose() }} className="flex-2 py-4 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Confirm Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

MachineControlModal.propTypes = {
  machine: PropTypes.shape({
    name: PropTypes.string.isRequired,
    status: PropTypes.string,
    workingTimeMinutes: PropTypes.number,
    stopTimeMinutes: PropTypes.number,
    runTime: PropTypes.number,
    totalTime: PropTypes.number,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  showRuntime: PropTypes.bool,
}
