import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User, Log } from '../models/index.js'
import { protect, allow } from '../middleware/auth.js'

const router = Router()

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

const isDBConnected = () => mongoose.connection.readyState === 1

const mockUsersResponse = [
  { id: 'm1', un: 'admin', name: 'Admin', role: 'ADMIN', on: true, avatar: null, lastLogin: null },
  { id: 'm2', un: 'engineer', name: 'Engineer', role: 'ENGINEER', on: true, avatar: null, lastLogin: null },
  { id: 'm3', un: 'operator', name: 'Operator', role: 'OPERATOR', on: true, avatar: null, lastLogin: null },
  { id: 'm4', un: 'viewer', name: 'Viewer', role: 'VIEWER', on: true, avatar: null, lastLogin: null },
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

const toUserResponse = (user) => ({
  id: user._id,
  un: user.un,
  name: user.name,
  role: user.role,
  on: user.on,
  avatar: user.avatar,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

// GET /api/users
router.get(
  '/',
  protect,
  allow('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isDBConnected()) {
      return res.json({ success: true, data: mockUsersResponse })
    }
    const users = await User.find({ on: true }).select('-pwHash').sort({ createdAt: -1 })
    res.json({ success: true, data: users.map(toUserResponse) })
  })
)

// POST /api/users
router.post(
  '/',
  protect,
  allow('ADMIN'),
  asyncHandler(async (req, res) => {
    const { un, pw, name, role, avatar } = req.body
    if (!un || !pw || !name) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' })
    }

    if (!isDBConnected()) {
      return res.status(503).json({ success: false, message: 'Database unavailable — cannot create user in mock mode' })
    }

    const exists = await User.findOne({ un })
    if (exists) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' })
    }

    const pwHash = await bcrypt.hash(pw, 10)
    const user = await User.create({
      un,
      pwHash,
      name,
      role: role || 'OPERATOR',
      avatar: avatar || null,
    })

    await logAuth(req.user, 'CREATE_USER', `Admin created user ${user.un}`, req)
    res.status(201).json({ success: true, data: toUserResponse(user) })
  })
)

// PUT /api/users/:id
router.put(
  '/:id',
  protect,
  allow('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isDBConnected()) {
      return res.status(503).json({ success: false, message: 'Database unavailable' })
    }

    const { pw, ...rest } = req.body
    const updates = { ...rest }

    if (pw) {
      updates.pwHash = await bcrypt.hash(pw, 10)
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    await logAuth(req.user, 'UPDATE_USER', `Admin updated user ${user.un}`, req)
    res.json({ success: true, data: toUserResponse(user) })
  })
)

// DELETE /api/users/:id (soft delete)
router.delete(
  '/:id',
  protect,
  allow('ADMIN'),
  asyncHandler(async (req, res) => {
    if (!isDBConnected()) {
      return res.status(503).json({ success: false, message: 'Database unavailable' })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    user.on = false
    await user.save()

    await logAuth(req.user, 'DELETE_USER', `Admin soft-deleted user ${user.un}`, req)
    res.json({ success: true, message: 'User deleted' })
  })
)

export default router
