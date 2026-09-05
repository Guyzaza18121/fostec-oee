import { useState } from 'react'
import { Camera, KeyRound, Save, Shield, User } from 'lucide-react'
import { authApi, getStoredUser, PERMS, setUser } from '../services/authApi.js'

const USER_UPDATED_EVENT = 'auth:user-updated'

function sanitizeUser(user) {
  const next = { ...user }
  delete next.pw
  delete next.password
  return next
}

export default function UserSettings() {
  const storedUser = getStoredUser() || {}
  const [profile, setProfile] = useState({
    id: storedUser.id || '',
    name: storedUser.name || '',
    un: storedUser.un || '',
    avatar: storedUser.avatar || null,
    role: storedUser.role || 'VIEWER',
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      updateField('avatar', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!profile.name.trim() || !profile.un.trim()) {
      alert('กรุณากรอกชื่อผู้ใช้งานและ Username')
      return
    }
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      alert('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    const payload = {
      name: profile.name.trim(),
      un: profile.un.trim(),
      avatar: profile.avatar,
    }
    if (profile.newPassword) payload.pw = profile.newPassword

    setSaving(true)
    try {
      let updated = { ...storedUser, ...payload }
      if (profile.id) {
        const res = await authApi.updateUser(profile.id, payload)
        updated = { ...updated, ...(res.data || {}) }
      }
      const safeUser = sanitizeUser({ ...storedUser, ...updated })
      setUser(safeUser)
      window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT, { detail: safeUser }))
      setProfile((prev) => ({ ...prev, ...safeUser, newPassword: '', confirmPassword: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Update profile failed:', err)
      alert(err.message || 'บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const rolePerms = PERMS[profile.role] || []

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-bg-card/90 p-5 panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-head">Users Setting</div>
            <h1 className="mt-1 text-xl font-black text-slate-100">ตั้งค่าผู้ใช้งาน</h1>
            <p className="mt-1 text-xs text-slate-400">เปลี่ยนรูป ชื่อ Username และรหัสผ่านของบัญชีที่กำลังใช้งาน</p>
          </div>
          <div className="rounded-full border border-border bg-bg-panel/60 px-3 py-1 text-xs font-bold text-slate-300">
            Role: <span className="font-mono text-sky-300">{profile.role}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-border bg-bg-panel/50 p-4">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-sky-500/30 bg-sky-500/10 text-4xl font-black text-sky-200">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    profile.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sky-500/40 bg-sky-600 text-white shadow-lg hover:bg-sky-500">
                  <Camera size={16} />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
                </label>
              </div>
              <div className="mt-3 text-sm font-bold text-slate-100">{profile.name || 'ไม่ระบุชื่อ'}</div>
              <div className="font-mono text-xs text-slate-500">@{profile.un || 'username'}</div>
              <button
                onClick={() => updateField('avatar', null)}
                className="mt-3 rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-xs font-bold text-slate-300 hover:border-red-500/30 hover:text-red-300"
              >
                ลบรูปโปรไฟล์
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-bg-panel/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
                <User size={18} className="text-sky-400" />
                ข้อมูลบัญชี
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">ชื่อที่แสดง</label>
                  <input
                    value={profile.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">Username</label>
                  <input
                    value={profile.un}
                    onChange={(e) => updateField('un', e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-panel/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
                <KeyRound size={18} className="text-amber-400" />
                ตั้งรหัสผ่าน
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={profile.newPassword}
                    onChange={(e) => updateField('newPassword', e.target.value)}
                    placeholder="เว้นว่างไว้ถ้าไม่เปลี่ยน"
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">ยืนยันรหัสผ่าน</label>
                  <input
                    type="password"
                    value={profile.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-panel/50 p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
                <Shield size={18} className="text-emerald-400" />
                สิทธิ์ปัจจุบัน
              </div>
              <div className="flex flex-wrap gap-2">
                {rolePerms.length ? rolePerms.map((perm) => (
                  <span key={perm} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
                    {perm}
                  </span>
                )) : (
                  <span className="rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-xs font-bold text-slate-300">VIEW ONLY</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </section>
    </div>
  )
}
