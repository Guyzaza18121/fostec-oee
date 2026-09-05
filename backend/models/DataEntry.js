import mongoose from 'mongoose'

const DataEntrySchema = new mongoose.Schema({
  shift: { type: String, required: true },
  line: { type: String, required: true },
  productionCount: { type: Number, default: 0 },
  defectCount: { type: Number, default: 0 },
  downtimeMinutes: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  operator: { type: String, default: '' },
  enteredAt: { type: Date, default: Date.now }
}, { timestamps: true })

DataEntrySchema.index({ enteredAt: -1, line: 1 })

export default mongoose.model('DataEntry', DataEntrySchema)
