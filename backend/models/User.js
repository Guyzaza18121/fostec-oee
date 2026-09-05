import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    un: { type: String, required: true, unique: true, trim: true },
    pwHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['ADMIN', 'ENGINEER', 'OPERATOR', 'VIEWER'],
      default: 'OPERATOR',
      uppercase: true,
    },
    on: { type: Boolean, default: true },
    avatar: { type: String, default: null },
    lastLogin: { type: String, default: null },
  },
  { timestamps: true }
)

userSchema.methods.matchPassword = async function (pw) {
  return bcrypt.compare(pw, this.pwHash)
}

const User = mongoose.model('User', userSchema)

export default User
