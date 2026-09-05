import mongoose from 'mongoose'

const OEEHistorySchema = new mongoose.Schema({
  machine: { type: String, required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', default: null },
  line: { type: String, default: '' },
  timestamp: { type: Date, required: true, default: Date.now },
  oee: { type: Number, default: 0 },
  availability: { type: Number, default: 0 },
  performance: { type: Number, default: 0 },
  quality: { type: Number, default: 0 },
  goodUnits: { type: Number, default: 0 },
  totalUnits: { type: Number, default: 0 },
  scrapUnits: { type: Number, default: 0 },
  status: { type: String, enum: ['running', 'breakdown', 'stopped', 'warning'], default: 'stopped' },
  shift: { type: String, default: '' },
  recordedBy: { type: String, default: '' }
}, { timestamps: true })

OEEHistorySchema.index({ machine: 1, timestamp: -1 })
OEEHistorySchema.index({ line: 1, timestamp: -1 })

export default mongoose.model('OEEHistory', OEEHistorySchema)
