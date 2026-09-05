import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User, Log } from '../models/index.js'
import { protect, signToken } from '../middleware/auth.js'

const router = Router()

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

const isDBConnected = () => mongoose.connection.readyState === 1

const mockUsers = [
  { _id: 'm1', un: 'admin', name: 'Admin', role: 'ADMIN', on: true, avatar: null, lastLogin: null, pw: 'admin123' },
  { _id: 'm2', un: 'engineer', name: 'Engineer', role: 'ENGINEER', on: true, avatar: null, lastLogin: null, pw: 'eng123' },
  { _id: 'm3', un: 'operator', name: 'Operator', role: 'OPERATOR', on: true, avatar: null, lastLogin: null, pw: 'op123' },
  { _id: 'm4', un: 'viewer', name: 'Viewer', role: 'VIEWER', on: true, avatar: null, lastLogin: null, pw: 'view123' },
]

const logAuth = async (user, action, detail, req) => {
  try {
    await Log.create({
      type: 'AUTH',
      user: user?._id || null,
      username: user?.un || null,
      action,
      detail,
      ip: req.ip || null,
    })
  } catch (err) {
    console.error('Auth log failed:', err)
  }
}

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { un, pw } = req.body
    if (!un || !pw) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' })
    }

    if (!isDBConnected()) {
      const mockUser = mockUsers.find((u) => u.un === un && u.pw === pw)
      if (!mockUser) {
        return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
      }
      const token = signToken(mockUser._id)
      return res.json({
        success: true,
        token,
        user: {
          id: mockUser._id,
          un: mockUser.un,
          name: mockUser.name,
          role: mockUser.role,
          on: mockUser.on,
          avatar: mockUser.avatar,
          lastLogin: new Date().toISOString(),
        },
      })
    }

    const user = await User.findOne({ un })
    if (!user || !user.on) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }

    const isMatch = await user.matchPassword(pw)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }

    user.lastLogin = new Date().toISOString()
    await user.save()

    const token = signToken(user._id)
    await logAuth(user, 'LOGIN', `User ${user.un} logged in`, req)

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        un: user.un,
        name: user.name,
        role: user.role,
        on: user.on,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
      },
    })
  })
)

// POST /api/auth/logout
router.post(
  '/logout',
  protect,
  asyncHandler(async (req, res) => {
    await logAuth(req.user, 'LOGOUT', `User ${req.user.un} logged out`, req)
    res.json({ success: true, message: 'Logged out' })
  })
)

export default router
