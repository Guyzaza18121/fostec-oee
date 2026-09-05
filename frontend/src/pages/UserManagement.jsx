import { useEffect, useState } from 'react'
import { ShieldCheck, UserPlus, Users } from 'lucide-react'
import { authApi, PERMS } from '../services/authApi.js'

const roleColors = {
  ADMIN: { color: 'rgba(167, 139, 250, 0.145)', borderColor: 'rgba(167, 139, 250, 0.333)', textColor: 'rgb(167, 139, 250)' },
  ENGINEER: { color: 'rgba(245, 158, 11, 0.145)', borderColor: 'rgba(245, 158, 11, 0.333)', textColor: 'rgb(245, 158, 11)' },
  OPERATOR: { color: 'rgba(34, 197, 94, 0.145)', borderColor: 'rgba(34, 197, 94, 0.333)', textColor: 'rgb(34, 197, 94)' },
  VIEWER: { color: 'rgba(100, 116, 139, 0.145)', borderColor: 'rgba(100, 116, 139, 0.333)', textColor: 'rgb(100, 116, 139)' },
}

const roleLabels = {
  ADMIN: 'ผู้ดูแลระบบ',
  ENGINEER: 'วิศวกร',
  OPERATOR: 'ผู้ปฏิบัติงาน',
  VIEWER: 'ดูอย่างเดียว',
}

const initialNewUser = {
  name: '',
  avatar: null,
  un: '',
  pw: '',
  role: 'OPERATOR',
}

function safeUsers(list = []) {
  return list.filter((user) => user && user.on !== false).map((user) => ({ ...user, pw: undefined }))
}

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newUser, setNewUser] = useState(initialNewUser)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await authApi.getUsers()
      if (res.success) setUsers(safeUsers(res.data))
    } catch (err) {
      console.error('Load users failed:', err)
      alert('ไม่สามารถโหลดรายชื่อผู้ใช้ได้')
    } finally {
      setLoading(false)
    }
  }

  const updateNewUser = (field, value) => {
    setNewUser((prev) => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result
      setPreview(base64)
      updateNewUser('avatar', base64)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!newUser.name.trim() || !newUser.un.trim() || !newUser.pw.trim()) {
      alert('กรุณากรอกชื่อ Username และ Password')
      return
    }
    setSaving(true)
    try {
      const res = await authApi.createUser({
        ...newUser,
        name: newUser.name.trim(),
        un: newUser.un.trim(),
        pw: newUser.pw.trim(),
      })
      if (res.success) {
        setUsers((prev) => safeUsers([...prev, res.data]))
        handleCancel()
      }
    } catch (err) {
      console.error('Create user failed:', err)
      alert(err.message || 'สร้างผู้ใช้ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (user, role) => {
    try {
      const res = await authApi.updateUser(user.id, { role })
      const updatedUser = res.data || { ...user, role }
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...updatedUser, pw: undefined } : item)))
    } catch (err) {
      console.error('Update role failed:', err)
      alert(err.message || 'เปลี่ยนสิทธิ์ผู้ใช้ไม่สำเร็จ')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('ต้องการลบผู้ใช้นี้?')) return
    try {
      await authApi.removeUser(id)
      setUsers((prev) => prev.filter((user) => user.id !== id))
    } catch (err) {
      console.error('Delete user failed:', err)
      alert(err.message || 'ลบผู้ใช้ไม่สำเร็จ')
    }
  }

  const handleCancel = () => {
    setNewUser(initialNewUser)
    setPreview(null)
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-border bg-bg-card/90 p-4 panel">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="section-head">Users Setting</div>
            <h1 className="mt-1 text-xl font-black text-slate-100">เพิ่มผู้ใช้งาน และกำหนดสิทธิ</h1>
            <p className="mt-1 text-xs text-slate-400">สร้างบัญชีใหม่ เลือก role และปรับสิทธิ์ของผู้ใช้ที่มีอยู่</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-xs font-bold text-sky-200">
            <Users size={14} />
            {users.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[420px_1fr]">
          <div className="rounded-xl border border-border bg-bg-panel/40 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
              <ShieldCheck size={18} className="text-emerald-400" />
              รายชื่อผู้ใช้งาน
            </div>
            {loading ? (
              <div className="rounded-lg border border-border bg-bg-card/40 px-3 py-8 text-center text-sm text-slate-400">กำลังโหลด...</div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => {
                  const colors = roleColors[user.role] || roleColors.VIEWER
                  const perms = PERMS[user.role] || []
                  return (
                    <div key={user.id} className="rounded-xl border border-border bg-bg-card/50 p-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border text-sm font-black"
                          style={{ borderColor: colors.borderColor, background: colors.color, color: colors.textColor }}
                        >
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            user.name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-100">{user.name}</div>
                          <div className="truncate font-mono text-[10px] text-slate-400">@{user.un}</div>
                        </div>
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className="w-[112px] rounded-lg border bg-bg-panel/70 px-2 py-1 text-[10px] font-bold uppercase outline-none"
                          style={{ color: colors.textColor, borderColor: colors.borderColor }}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="ENGINEER">ENGINEER</option>
                          <option value="OPERATOR">OPERATOR</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                        <button onClick={() => handleDelete(user.id)} className="rounded-md px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300">
                          ลบ
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {perms.length ? perms.map((perm) => (
                          <span key={perm} className="rounded-full border border-border bg-bg-panel/60 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                            {perm}
                          </span>
                        )) : (
                          <span className="rounded-full border border-border bg-bg-panel/60 px-2 py-0.5 text-[9px] font-bold text-slate-400">VIEW ONLY</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-panel/50 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-100">
              <UserPlus size={18} className="text-sky-400" />
              เพิ่มผู้ใช้งานใหม่
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">ชื่อที่แสดง</div>
                <input
                  className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  value={newUser.name}
                  onChange={(e) => updateNewUser('name', e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">รูปโปรไฟล์</div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-card/70 text-sm font-black text-slate-300">
                    {preview ? (
                      <img src={preview} alt="preview" className="h-full w-full object-cover" />
                    ) : (
                      newUser.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-[10px] text-slate-300" />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Username</div>
                <input
                  className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                  placeholder="username"
                  value={newUser.un}
                  onChange={(e) => updateNewUser('un', e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">Password</div>
                <input
                  className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
                  placeholder="password"
                  type="text"
                  value={newUser.pw}
                  onChange={(e) => updateNewUser('pw', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">สิทธิ์ / Role</div>
                <select
                  className="w-full rounded-lg border border-border bg-bg-card/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  value={newUser.role}
                  onChange={(e) => updateNewUser('role', e.target.value)}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="ENGINEER">ENGINEER</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
                <div className="mt-2 rounded-lg border border-border bg-bg-card/50 p-3 text-xs text-slate-400">
                  <div className="font-bold text-slate-200">{roleLabels[newUser.role] || newUser.role}</div>
                  <div className="mt-1">Access: <span className="font-mono text-slate-300">{PERMS[newUser.role]?.join(', ') || 'view only'}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleCancel} className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700">
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้งาน'}
              </button>
            </div>
            <div className="mt-3 text-[10px] text-slate-400">
              - Username ต้องไม่ซ้ำกับผู้ใช้งานเดิม<br />
              - เฉพาะ ADMIN เท่านั้นที่เข้าเมนูนี้ได้
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
