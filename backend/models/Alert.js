import mongoose from 'mongoose'

const AlertSchema = new mongoose.Schema({
  severity: { type: String, enum: ['CRITICAL', 'WARNING', 'INFO'], required: true },
  color: { type: String, required: true },
  bg: { type: String, required: true },
  text: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  equipment: { type: String, default: null },
  acknowledged: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true })

export default mongoose.model('Alert', AlertSchema)
