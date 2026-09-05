import mongoose from 'mongoose'

const logSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['AUTH', 'DATA', 'SYSTEM'], default: 'SYSTEM' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: null },
    action: { type: String, required: true },
    detail: { type: String, default: '' },
    ip: { type: String, default: null },
  },
  { timestamps: true }
)

const Log = mongoose.model('Log', logSchema)

export default Log
