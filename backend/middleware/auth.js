import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { User } from '../models/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'fostec-jwt-secret-change-me'

const isDBConnected = () => mongoose.connection.readyState === 1

const mockUsers = [
  { _id: 'm1', un: 'admin', name: 'Admin', role: 'ADMIN', on: true, avatar: null, lastLogin: null },
  { _id: 'm2', un: 'engineer', name: 'Engineer', role: 'ENGINEER', on: true, avatar: null, lastLogin: null },
  { _id: 'm3', un: 'operator', name: 'Operator', role: 'OPERATOR', on: true, avatar: null, lastLogin: null },
  { _id: 'm4', un: 'viewer', name: 'Viewer', role: 'VIEWER', on: true, avatar: null, lastLogin: null },
]

export const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]
      const decoded = jwt.verify(token, JWT_SECRET)

      if (!isDBConnected()) {
        const mockUser = mockUsers.find((u) => u._id === decoded.id)
        if (!mockUser || !mockUser.on) {
          return res.status(401).json({ success: false, message: 'Not authorized' })
        }
        req.user = mockUser
        return next()
      }

      const user = await User.findById(decoded.id).select('-pwHash')
      if (!user || !user.on) {
        return res.status(401).json({ success: false, message: 'Not authorized' })
      }
      req.user = user
      next()
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Not authorized' })
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' })
  }
}

export const allow = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' })
    }
    next()
  }
}

export const signToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '8h' })
}
