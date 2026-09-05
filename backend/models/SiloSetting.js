import mongoose from 'mongoose'

const SiloSettingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  product: { type: String, required: true, trim: true },
  expectedWeight: { type: Number, default: 0, min: 0 },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  status: { type: String, enum: ['waiting', 'running', 'done'], default: 'waiting' },
  notes: { type: String, default: '' },
}, { timestamps: true })

SiloSettingSchema.index({ date: -1 })

export default mongoose.model('SiloSetting', SiloSettingSchema)
