# Prompt สำหรับย้ายระบบ Login, Permission และ System Log

สรุปนี้อ้างอิงจาก source ปัจจุบันของโปรเจค `fostec-oee` โดยตรง และมีชุดไฟล์สำเนาอยู่ที่ `auth-transfer-kit/`

## Prompt พร้อมใช้

```text
คุณคือ senior full-stack engineer ให้ย้ายระบบ Login, ระบบจัดการสิทธิ์, User Management และ System Log จากโปรเจค FOSTEC OEE ไปยังโปรเจคปลายทางแบบคง behavior เดิมให้มากที่สุด

Stack ต้นทาง:
- Backend: Node.js, Express ESM, MongoDB/Mongoose, bcryptjs, jsonwebtoken, dotenv, cors
- Frontend: React 19, Vite, localStorage auth, custom router ใน `frontend/src/router.jsx`

ให้ใช้ไฟล์อ้างอิง/ไฟล์แนบจากชุด `auth-transfer-kit/` และทำงานตามรายละเอียดนี้

1. Backend auth
- สร้าง/ย้าย `User` model ตาม `backend/models/User.js`
- สร้าง/ย้าย `Log` model ตาม `backend/models/Log.js`
- ใช้ JWT secret จาก `process.env.JWT_SECRET` และ fallback เดิมคือ `fostec-jwt-secret-change-me`
- Token payload ต้องเป็น `{ id }` และหมดอายุใน 8 ชั่วโมง
- Middleware ต้องมี `protect`, `allow(...roles)`, `signToken(id)` ตาม `backend/middleware/auth.js`
- `protect` อ่าน header `Authorization: Bearer <token>`, verify JWT, หา user, ตัด `pwHash`, reject user ที่ไม่มีอยู่หรือ `on === false`
- ถ้า MongoDB ไม่ connected ให้ใช้ mock users เดิม: admin/admin123, engineer/eng123, operator/op123, viewer/view123

2. Login/logout API
- Mount route เป็น `app.use('/api/auth', authRoutes)`
- `POST /api/auth/login` รับ body `{ un, pw }`
- ถ้า credential ถูกต้อง ให้ update `lastLogin`, sign JWT, บันทึก log type `AUTH` action `LOGIN`, แล้ว response:
  `{ success: true, token, user: { id, un, name, role, on, avatar, lastLogin } }`
- `POST /api/auth/logout` ต้องผ่าน `protect`, บันทึก log type `AUTH` action `LOGOUT`, แล้ว response `{ success: true, message: 'Logged out' }`

3. User Management API
- Mount route เป็น `app.use('/api/users', userRoutes)`
- ทุก endpoint ใน `backend/routes/users.js` ต้องใช้ `protect` และ `allow('ADMIN')`
- `GET /api/users` คืน user ที่ `on: true`, ไม่คืน `pwHash`
- `POST /api/users` รับ `{ un, pw, name, role, avatar }`, hash password ด้วย bcrypt round 10, default role เป็น `OPERATOR`, log `CREATE_USER`
- `PUT /api/users/:id` อัปเดตข้อมูล user, ถ้ามี `pw` ให้ hash เป็น `pwHash`, log `UPDATE_USER`
- `DELETE /api/users/:id` เป็น soft delete โดย set `on = false`, log `DELETE_USER`

4. Role และ permission ต้องตรงกับต้นฉบับ
- Roles ใน DB: `ADMIN`, `ENGINEER`, `OPERATOR`, `VIEWER`
- Frontend permission map:
  - `ADMIN`: `CONTROL`, `SETTINGS`, `USER_MANAGE`, `DELETE`
  - `ENGINEER`: `CONTROL`, `SETTINGS`, `DELETE`
  - `OPERATOR`: `CONTROL`
  - `VIEWER`: ไม่มี permission, view only
- Frontend ใช้ helper `hasPerm(user, perm)` และ `hasAnyPerm(user, perms)` จาก `frontend/src/services/authApi.js`
- Backend role groups ใน OEE route:
  - `WRITE_ROLES = ['ADMIN', 'ENGINEER', 'OPERATOR']`
  - `SETTINGS_ROLES = ['ADMIN', 'ENGINEER']`
  - User management และ destructive admin-only action ใช้ `allow('ADMIN')`

5. Frontend auth state
- ใช้ localStorage key เดิม:
  - token: `fostec_token`
  - user: `fostec_user`
- `authApi.login(un, pw)` ต้องเรียก `POST /auth/login`, เก็บ token/user ลง localStorage
- `authApi.logout()` ต้องเรียก `POST /auth/logout`, แล้ว clear token/user
- ทุก API helper ที่ใช้ token ต้องใส่ `Authorization: Bearer <token>`
- ถ้า response status 401 ให้ลบ token/user และ redirect ไป `/login`
- รองรับ `VITE_API_BASE_URL` default `/api`
- รองรับ `VITE_SIMULATION_MODE=true` โดยใช้ mock users เดิมใน frontend

6. Protected route และเมนู
- ใช้ `ProtectedRoute` ใน `frontend/src/App.jsx`
- ถ้าไม่มี user ให้ redirect `/login`
- ถ้า route มี `perms` และ user ไม่มี permission ให้ redirect `/`
- Route permissions เดิม:
  - `/settings`: `['SETTINGS']`
  - `/user-management`: `['USER_MANAGE']`
  - `/logs`: `['SETTINGS']`
- Sidebar ต้องกรองเมนูด้วย `hasAnyPerm`
  - Production Plan ต้องมี `SETTINGS`
  - System Log ต้องมี `SETTINGS`
  - User Management ต้องมี `USER_MANAGE`

7. System Log
- ใช้ `Log` schema เดิม:
  - `type`: enum `AUTH`, `DATA`, `SYSTEM`, default `SYSTEM`
  - `user`: ObjectId ref `User`, default null
  - `username`: String
  - `action`: required String
  - `detail`: String
  - `ip`: String
  - timestamps enabled
- Endpoint ต้นทางอยู่ใน `backend/routes/oee.js` ภายใต้ mount `/api/oee`
- `GET /api/oee/logs?limit=100` ต้องผ่าน `protect` และ `allow(...SETTINGS_ROLES)`, sort `createdAt: -1`, limit สูงสุด 200
- `POST /api/oee/logs` ต้องผ่าน `protect` และ `allow(...WRITE_ROLES)`, รับ `{ type='DATA', action, detail='' }`, ใส่ `user` และ `username` จาก `req.user`
- Frontend ใช้ `frontend/src/services/logApi.js` มี `getLogs(limit)` และ `createLog({ type, action, detail })`
- หน้าแสดง log ใช้ `frontend/src/pages/Logs.jsx`
- Action สำคัญในหน้าอื่นควรเรียก `createLog` เหมือนต้นฉบับ เช่น create/update/delete data, stock clear, shift changes

8. Seed users
- เพิ่ม script `seed:users` ใน backend package
- ใช้ `backend/scripts/seedUsers.js`
- demo credentials:
  - admin / admin123 / ADMIN
  - engineer / eng123 / ENGINEER
  - operator / op123 / OPERATOR
  - viewer / view123 / VIEWER

9. Dependencies และ env
- Backend dependencies ต้องมี `bcryptjs`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `mongoose`
- Env ที่ต้องมี:
  - `MONGODB_URI` หรือ `MONGO_URI`
  - `JWT_SECRET`
  - `PORT` optional
  - `ENABLE_MOCK_DATA` optional
- Frontend env:
  - `VITE_API_BASE_URL`
  - `VITE_SIMULATION_MODE`

10. Acceptance checks
- Login ด้วย admin สำเร็จ ได้ token และ user role ADMIN ใน localStorage
- Login ผิดต้องได้ 401 และไม่เก็บ token
- Logout แล้ว token/user ถูกลบ และ backend มี AUTH log `LOGOUT`
- `ADMIN` เข้า `/user-management` ได้, role อื่นเข้าไม่ได้
- `ENGINEER` เข้า `/logs` และ `/settings` ได้ แต่เข้า `/user-management` ไม่ได้
- `OPERATOR` ทำ action ที่ใช้ WRITE_ROLES ได้ แต่เข้า `/logs` ไม่ได้
- `VIEWER` เข้าได้เฉพาะหน้าที่ไม่ต้องมี permission
- `GET /api/oee/logs` คืน log ล่าสุดเรียงจากใหม่ไปเก่า และ limit ไม่เกิน 200

หมายเหตุสำคัญ: ต้นฉบับมีหน้า `UserSettings.jsx` สำหรับแก้ profile แต่ backend `PUT /api/users/:id` อนุญาตเฉพาะ ADMIN เท่านั้น ถ้าต้องการให้ user แก้บัญชีตัวเองได้ในโปรเจคใหม่ ให้เพิ่ม endpoint แยก เช่น `PUT /api/auth/me` หรือปรับ rule ให้ owner แก้ข้อมูลตัวเองได้ โดยยังห้ามแก้ role เอง
```

## ไฟล์ที่เกี่ยวข้อง

ชุดสำเนาที่เตรียมไว้:

```text
auth-transfer-kit/
  backend/
    server.js
    config/db.js
    middleware/auth.js
    models/User.js
    models/Log.js
    models/index.js
    routes/auth.js
    routes/users.js
    routes/oee.js
    scripts/seedUsers.js
  frontend/src/
    App.jsx
    router.jsx
    services/authApi.js
    services/logApi.js
    services/api.js
    pages/Login.jsx
    pages/UserManagement.jsx
    pages/UserSettings.jsx
    pages/Logs.jsx
    components/Sidebar.jsx
    components/Layout.jsx
    components/Navbar.jsx
```

ไฟล์ต้นทางในโปรเจคจริง:

```text
backend/middleware/auth.js
backend/routes/auth.js
backend/routes/users.js
backend/routes/oee.js
backend/models/User.js
backend/models/Log.js
backend/models/index.js
backend/scripts/seedUsers.js
backend/server.js
backend/config/db.js
frontend/src/services/authApi.js
frontend/src/services/logApi.js
frontend/src/services/api.js
frontend/src/App.jsx
frontend/src/router.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/UserManagement.jsx
frontend/src/pages/UserSettings.jsx
frontend/src/pages/Logs.jsx
frontend/src/components/Sidebar.jsx
frontend/src/components/Layout.jsx
frontend/src/components/Navbar.jsx
```

## จุดโค้ดสำคัญที่ต้องคงไว้

### Permission map ฝั่ง frontend

```js
export const PERMS = {
  ADMIN: ['CONTROL', 'SETTINGS', 'USER_MANAGE', 'DELETE'],
  ENGINEER: ['CONTROL', 'SETTINGS', 'DELETE'],
  OPERATOR: ['CONTROL'],
  VIEWER: [],
}
```

### Role guard ฝั่ง backend

```js
export const allow = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' })
    }
    next()
  }
}
```

### กลุ่ม role ใน `backend/routes/oee.js`

```js
const WRITE_ROLES = ['ADMIN', 'ENGINEER', 'OPERATOR']
const SETTINGS_ROLES = ['ADMIN', 'ENGINEER']
```

### System log route ต้นฉบับ

```js
router.get('/logs', protect, allow(...SETTINGS_ROLES), asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
  const logs = await dbOrMock(
    () => Log.find().sort({ createdAt: -1 }).limit(limit).lean(),
    () => []
  )
  res.json({ success: true, data: logs })
}))

router.post('/logs', protect, allow(...WRITE_ROLES), asyncHandler(async (req, res) => {
  const { type = 'DATA', action, detail = '' } = req.body
  const log = await Log.create({
    type,
    action,
    detail,
    user: req.user?._id || null,
    username: req.user?.name || req.user?.un || null,
  })
  res.status(201).json({ success: true, data: log })
}))
```

ถ้าโปรเจคปลายทางไม่มี helper `dbOrMock` ให้ใช้ query ตรงแทนเฉพาะ GET logs:

```js
const logs = await Log.find().sort({ createdAt: -1 }).limit(limit).lean()
```

### Route permissions ใน `frontend/src/App.jsx`

```js
'/settings': { element: <Settings />, perms: ['SETTINGS'] },
'/user-management': { element: <UserManagement />, perms: ['USER_MANAGE'] },
'/logs': { element: <Logs />, perms: ['SETTINGS'] },
```

## ลำดับการย้ายที่แนะนำ

1. ติดตั้ง backend dependencies และตั้งค่า `.env`
2. ย้าย `User`, `Log`, `models/index.js`
3. ย้าย `middleware/auth.js`
4. ย้าย `routes/auth.js`, `routes/users.js`
5. เพิ่มหรือ extract log routes จาก `routes/oee.js`
6. mount route ใน `server.js`
7. run `npm --prefix backend run seed:users`
8. ย้าย frontend `authApi.js`, `logApi.js`, `router.jsx`, `Login.jsx`, `UserManagement.jsx`, `UserSettings.jsx`, `Logs.jsx`
9. ผูก `ProtectedRoute`, route perms และ sidebar menu filter
10. ทดสอบ login/logout/user management/log ตาม acceptance checks ด้านบน
