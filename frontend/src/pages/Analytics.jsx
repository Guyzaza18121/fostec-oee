// Analytics page from container - shows Live OEE Trend, OEE Heat Map, Hourly Output vs Target
const heatmapData = {
  day: [97.4, 97.4, 97.4, 97.4, 97.4, 96.3, 97.4],
  aft: [97.4, 97.4, 97.4, 97.4, 97.4, 92.3, 97.4],
  night: [97.4, 95.3, 89.3, 97.4, 97.4, 88.3, 96.3]
}

const hourlyOutput = [
  { hour: '14', output: 515, target: 530, aboveTarget: false },
  { hour: '14', output: 420, target: 530, aboveTarget: false },
  { hour: '14', output: 530, target: 530, aboveTarget: true },
  { hour: '14', output: 500, target: 530, aboveTarget: false },
  { hour: '14', output: 443, target: 530, aboveTarget: false },
  { hour: '14', output: 536, target: 530, aboveTarget: true },
  { hour: '14', output: 482, target: 530, aboveTarget: false },
  { hour: '14', output: 465, target: 530, aboveTarget: false }
]

export default function Analytics() {
  return (
    <div className="space-y-3 max-w-360 mx-auto">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* Live OEE Trend */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">📈 Live OEE Trend (24 samples)</div>
          </div>
          <svg width="100%" viewBox="0 0 400 105" style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            <line x1="26" x2="393" y1="76.7" y2="76.7" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="26" x2="393" y1="60.1" y2="60.1" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="26" x2="393" y1="43.5" y2="43.5" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="26" x2="393" y1="26.9" y2="26.9" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
            <line x1="26" x2="393" y1="10.3" y2="10.3" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" />
            {/* Y-axis labels */}
            <text x="23" y="79.7" textAnchor="end" fill="rgba(148,163,184,0.8)" fontSize="7">60</text>
            <text x="23" y="46.5" textAnchor="end" fill="rgba(148,163,184,0.8)" fontSize="7">80</text>
            <text x="23" y="13.3" textAnchor="end" fill="rgba(148,163,184,0.8)" fontSize="7">100</text>
            {/* OEE line (cyan) */}
            <polyline points="26,68.9 42,68.9 58,68.9 74,68.9 90,68.9 106,68.9 122,68.9 138,68.9 154,68.9 170,68.9 186,68.9 202,68.9 218,68.9 234,68.9 250,68.9 266,68.9 282,68.9 298,68.9 314,68.9 330,68.9 346,68.9 362,68.9 378,68.9 394,68.9" fill="none" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Availability line (green) */}
            <polyline points="26,34.1 42,34.1 58,34.1 74,34.1 90,34.1 106,34.1 122,34.1 138,34.1 154,34.1 170,34.1 186,34.1 202,34.1 218,34.1 234,34.1 250,34.1 266,34.1 282,34.1 298,34.1 314,34.1 330,34.1 346,34.1 362,34.1 378,34.1 394,34.1" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Performance line (amber) */}
            <polyline points="26,49.2 42,49.2 58,49.2 74,49.2 90,49.2 106,49.2 122,49.2 138,49.2 154,49.2 170,49.2 186,49.2 202,49.2 218,49.2 234,49.2 250,49.2 266,49.2 282,49.2 298,49.2 314,49.2 330,49.2 346,49.2 362,49.2 378,49.2 394,49.2" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* Quality line (violet) */}
            <polyline points="26,12.8 42,12.8 58,12.8 74,12.8 90,12.8 106,12.8 122,12.8 138,12.8 154,12.8 170,12.8 186,12.8 202,12.8 218,12.8 234,12.8 250,12.8 266,12.8 282,12.8 298,12.8 314,12.8 330,12.8 346,12.8 362,12.8 378,12.8 394,12.8" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {/* X-axis labels */}
            <text x="26" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:34</text>
            <text x="42" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:34</text>
            <text x="58" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:34</text>
            <text x="74" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:35</text>
            <text x="90" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:35</text>
            <text x="106" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:35</text>
            <text x="122" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:35</text>
            <text x="138" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:35</text>
            <text x="154" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:36</text>
            <text x="170" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:36</text>
            <text x="186" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:36</text>
            <text x="202" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:36</text>
            <text x="218" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:36</text>
            <text x="234" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:37</text>
            <text x="250" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:37</text>
            <text x="266" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:37</text>
            <text x="282" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:38</text>
            <text x="298" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:38</text>
            <text x="314" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:38</text>
            <text x="330" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:38</text>
            <text x="346" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:38</text>
            <text x="362" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:39</text>
            <text x="378" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:39</text>
            <text x="394" y="102" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="7">11:39</text>
          </svg>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded" style={{ background: '#22d3ee' }} />
              <span className="text-slate-400">OEE</span>
              <span className="font-mono font-bold" style={{ color: '#22d3ee' }}>64.7%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded" style={{ background: '#22c55e' }} />
              <span className="text-slate-400">Avail</span>
              <span className="font-mono font-bold" style={{ color: '#22c55e' }}>85.7%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded" style={{ background: '#f59e0b' }} />
              <span className="text-slate-400">Perf</span>
              <span className="font-mono font-bold" style={{ color: '#f59e0b' }}>76.6%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded" style={{ background: '#a78bfa' }} />
              <span className="text-slate-400">Qual</span>
              <span className="font-mono font-bold" style={{ color: '#a78bfa' }}>98.5%</span>
            </div>
          </div>
        </section>

        {/* OEE Heat Map */}
        <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
          <div className="mb-3 flex items-center gap-2">
            <div className="section-head">🌡 OEE Heat Map</div>
          </div>
          <div>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[520px]">
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '54px repeat(7, 1fr)', gap: '2px', marginBottom: '3px' }}>
                  <div></div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Mon</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Tue</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Wed</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Thu</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Fri</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Sat</div>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)' }}>Sun</div>
                </div>
                {/* Day shift */}
                <div style={{ display: 'grid', gridTemplateColumns: '54px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)', display: 'flex', alignItems: 'center' }}>Day</div>
                  {heatmapData.day.map((val, i) => (
                    <div key={`day-${i}`} style={{ background: '#165134', borderRadius: '2px', padding: '3px 1px', textAlign: 'center', fontSize: '8px', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>{val}</div>
                  ))}
                </div>
                {/* Afternoon shift */}
                <div style={{ display: 'grid', gridTemplateColumns: '54px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)', display: 'flex', alignItems: 'center' }}>Aft</div>
                  {heatmapData.aft.map((val, i) => (
                    <div key={`aft-${i}`} style={{ background: '#165134', borderRadius: '2px', padding: '3px 1px', textAlign: 'center', fontSize: '8px', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>{val}</div>
                  ))}
                </div>
                {/* Night shift */}
                <div style={{ display: 'grid', gridTemplateColumns: '54px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(148, 163, 184, 0.85)', display: 'flex', alignItems: 'center' }}>Night</div>
                  {heatmapData.night.map((val, i) => (
                    <div key={`night-${i}`} style={{ background: '#165134', borderRadius: '2px', padding: '3px 1px', textAlign: 'center', fontSize: '8px', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>{val}</div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '1px', background: '#165134' }} />
                <span style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.75)' }}>≥85%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '1px', background: '#15803d' }} />
                <span style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.75)' }}>75-84%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '1px', background: '#ca8a04' }} />
                <span style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.75)' }}>65-74%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '1px', background: '#dc2626' }} />
                <span style={{ fontSize: '8px', color: 'rgba(148, 163, 184, 0.75)' }}>&lt;65%</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Hourly Output vs Target */}
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="mb-3 flex items-center gap-2">
          <div className="section-head">📦 Hourly Output vs Target</div>
        </div>
        <svg width="100%" viewBox="0 0 400 82">
          {hourlyOutput.map((item, i) => {
            const x = 63 + i * 37
            const height = (item.output / 530) * 55.6
            const y = 65 - height
            return (
              <g key={i}>
                <rect x={x} y={y} width="26" height={height} rx="2" fill={item.aboveTarget ? '#22c55e' : '#ef4444'} opacity="0.85" />
                <line x1={x - 2} x2={x + 28} y1="9.2" y2="9.2" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
                <text x={x + 13} y="80" textAnchor="middle" fill="rgba(148,163,184,0.85)" fontSize="7">{item.hour}</text>
                <text x={x + 13} y={y - 2} textAnchor="middle" fill={item.aboveTarget ? '#22c55e' : '#ef4444'} fontSize="7">{item.output}</text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-4 rounded h-2" style={{ background: '#22c55e' }} />
            ≥Target
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 rounded h-2" style={{ background: '#ef4444' }} />
            &lt;Target
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 rounded h-[2px]" style={{ background: '#f59e0b' }} />
            Target
          </div>
        </div>
      </section>
    </div>
  )
}
