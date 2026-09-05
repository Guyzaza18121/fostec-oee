import mongoose from 'mongoose'

const ProductionEntrySchema = new mongoose.Schema({
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
  date: { type: Date, required: true },
  shift: { type: String, default: '' },
  line: { type: String, default: '' },
  product: { type: String, default: '', trim: true },
  timeRange: { type: String, default: '' },
  received: { type: Number, default: 0, min: 0 },
  siloOutput: { type: Number, default: 0, min: 0 },
  target: { type: Number, default: 0, min: 0 },
  actualBags: { type: Number, default: 0, min: 0 },
  bagSize: { type: Number, default: 0, min: 0 },
  cleaningTime: { type: String, default: '' },
  startMinutes: { type: Number, default: 0, min: 0, max: 1440 },
  endMinutes: { type: Number, default: 0, min: 0, max: 1440 },
  operator: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true })

ProductionEntrySchema.index({ date: -1, line: 1 })
ProductionEntrySchema.index({ shiftId: 1 })

export default mongoose.model('ProductionEntry', ProductionEntrySchema)
