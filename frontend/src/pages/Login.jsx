import { useState, useEffect } from 'react'
import { useNavigate } from '../router.jsx'
import { authApi } from '../services/authApi.js'
import { Activity, Lock, User, LogIn, Factory, Gauge, ShieldCheck } from 'lucide-react'

const COLORS = {
  navy: '#0b1120',
  surface: '#131b30',
  panel: '#1a2340',
  accent: '#38bdf8',
  accentLight: '#818cf8',
  error: '#f87171',
  text: '#f4f7ff',
  textSoft: '#c7cfe2',
  textMuted: '#8a94af',
  border: '#27334f',
  bg: '#0b1120',
}

const demoAccounts = [
  { un: 'admin', pw: 'admin123', role: 'ADMIN', color: '#a78bfa', icon: ShieldCheck },
  { un: 'engineer', pw: 'eng123', role: 'ENGINEER', color: '#f59e0b', icon: Gauge },
  { un: 'operator', pw: 'op123', role: 'OPERATOR', color: '#10b981', icon: Factory },
  { un: 'viewer', pw: 'view123', role: 'VIEWER', color: '#94a3b8', icon: User },
]

export default function Login() {
  const navigate = useNavigate()
  const [un, setUn] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.login(un, pw)
      navigate('/')
    } catch (err) {
      const msg = err?.message || ''
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่')
      } else if (msg === 'SESSION_EXPIRED' || /401/.test(msg) || !msg) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (account) => {
    setUn(account.un)
    setPw(account.pw)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: `radial-gradient(1100px 620px at 12% -8%, rgba(56,189,248,0.22), transparent 60%),
                      radial-gradient(1000px 620px at 90% 15%, rgba(129,140,248,0.18), transparent 60%),
                      radial-gradient(900px 700px at 50% 120%, rgba(16,185,129,0.12), transparent 55%),
                      ${COLORS.bg}`,
        padding: '24px',
        fontFamily: 'Poppins, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Decorative floating orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-120px', right: '-80px', width: '340px', height: '340px',
          borderRadius: '999px', background: 'radial-gradient(circle, rgba(56,189,248,0.28), transparent 70%)',
          filter: 'blur(40px)', animation: 'float-orbit 14s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-140px', left: '-100px', width: '420px', height: '420px',
          borderRadius: '999px', background: 'radial-gradient(circle, rgba(129,140,248,0.28), transparent 70%)',
          filter: 'blur(44px)', animation: 'float-orbit 18s ease-in-out infinite reverse',
        }} />
      </div>

      <div
        style={{
          width: '840px',
          maxWidth: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '0',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: 'rgba(19, 27, 48, 0.72)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(59, 74, 107, 0.55)',
            borderRadius: '22px',
            padding: '36px',
            boxShadow: '0 40px 90px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset',
            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            gap: '36px',
          }}
          className="login-card"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 48px 100px -20px rgba(0,0,0,0.66)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.boxShadow = '0 40px 90px -20px rgba(0,0,0,0.55)' }}
        >
          {/* ── Left: brand / hero ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px', display: 'grid', placeItems: 'center',
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(129,140,248,0.22))',
                  border: '1px solid rgba(129,140,248,0.35)',
                  boxShadow: '0 8px 24px -6px rgba(56,189,248,0.4)',
                }}>
                  <Activity size={26} style={{ color: COLORS.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '0.01em', color: COLORS.text }}>
                    FOSTEC OEE
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: COLORS.textMuted }}>
                    Intelligent Management 4.0
                  </div>
                </div>
              </div>

              <img
                src="/Logo-FOSTEC4.png"
                alt="FOSTEC"
                draggable={false}
                style={{ height: '64px', objectFit: 'contain', marginBottom: '18px', filter: 'drop-shadow(0 6px 18px rgba(56,189,248,0.25))' }}
              />

              <p style={{ fontSize: '13px', lineHeight: 1.6, color: COLORS.textSoft, margin: 0 }}>
                ระบบบริหารจัดการค่า OEE แบบ Realtime — ติดตามสถานะเครื่องจักร,
                ประสิทธิภาพการผลิต และอัตราคุณภาพของทุกสายการผลิตได้ในหน้าจอเดียว
              </p>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                { icon: Gauge, text: 'ติดตามค่า OEE แบบเรียลไทม์' },
                { icon: Factory, text: 'แจ้งเตือน Alarms และสถานะเครื่องจักร' },
                { icon: ShieldCheck, text: 'กำหนดสิทธิ์การเข้าถึงตามบทบาท' },
              ].map((f) => (
                <div key={f.text} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: COLORS.textSoft,
                  padding: '9px 12px', borderRadius: '10px',
                  background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.16)',
                }}>
                  <f.icon size={16} style={{ color: COLORS.accentLight, flexShrink: 0 }} />
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: form ────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text }}>เข้าสู่ระบบ</div>
              <div style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px' }}>ยินดีต้อนรับกลับสู่ FOSTEC OEE</div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }} className="login-field">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: COLORS.textSoft, marginBottom: '6px' }}>
                  ชื่อผู้ใช้
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={un}
                    onChange={(e) => setUn(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 34px',
                      borderRadius: '10px',
                      border: `1px solid ${COLORS.border}`,
                      background: 'rgba(7,13,28,0.55)',
                      color: COLORS.text,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.accent
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(56,189,248,0.18)`
                      e.currentTarget.style.background = 'rgba(7,13,28,0.75)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.border
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = 'rgba(7,13,28,0.55)'
                    }}
                    placeholder="username"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: COLORS.textSoft, marginBottom: '6px' }}>
                  รหัสผ่าน
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted, pointerEvents: 'none' }} />
                  <input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 12px 11px 34px',
                      borderRadius: '10px',
                      border: `1px solid ${COLORS.border}`,
                      background: 'rgba(7,132,28,0.55)',
                      color: COLORS.text,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.accent
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.18)'
                      e.currentTarget.style.background = 'rgba(7,13,28,0.75)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.border
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = 'rgba(7,13,28,0.55)'
                    }}
                    placeholder="password"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    color: COLORS.error,
                    fontSize: '12px',
                    textAlign: 'center',
                    marginBottom: '14px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(248,113,113,0.1)',
                    border: '1px solid rgba(248,113,113,0.25)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: loading ? 'wait' : 'pointer',
                  background: `linear-gradient(105deg, #0891b2 0%, #2563eb 55%, #7c3aed 100%)`,
                  boxShadow: '0 14px 34px -10px rgba(37,99,235,0.6)',
                  opacity: loading ? 0.7 : 1,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 18px 40px -10px rgba(37,99,235,0.7)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)'
                  e.currentTarget.style.boxShadow = '0 14px 34px -10px rgba(37,99,235,0.6)'
                }}
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : (
                  <>
                    <LogIn size={16} />
                    เข้าสู่ระบบ
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '24px' }}>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, textAlign: 'center', marginBottom: '12px' }}>
                — Demo Accounts —
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {demoAccounts.map((acc) => {
                  const Icon = acc.icon
                  return (
                    <button
                      key={acc.un}
                      type="button"
                      onClick={() => fillDemo(acc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px',
                        borderRadius: '10px',
                        border: `1px solid ${acc.color}40`,
                        background: `${acc.color}14`,
                        color: COLORS.textSoft,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${acc.color}90`
                        e.currentTarget.style.background = `${acc.color}22`
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${acc.color}40`
                        e.currentTarget.style.background = `${acc.color}14`
                        e.currentTarget.style.transform = 'translateY(0px)'
                      }}
                    >
                      <Icon size={16} style={{ color: acc.color, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>{acc.un}</div>
                        <div style={{ fontSize: '9px', color: acc.color, fontWeight: 600 }}>{acc.role} · <span style={{ fontFamily: 'monospace' }}>{acc.pw}</span></div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '11px', color: COLORS.textMuted }}>
          FOSTEC Intelligence 4.0 · OEE Monitoring System
        </div>
      </div>

      <style>{`
        @keyframes float-orbit {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.08); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @media (max-width: 700px) {
          .login-card {
            grid-template-columns: 1fr !important;
            padding: 24px !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}
