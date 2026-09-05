import mongoose from 'mongoose'

const MachineSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  line: { type: String, required: true, trim: true },
  oee: { type: Number, required: true, min: 0, max: 100 },
  availability: { type: Number, required: true, min: 0, max: 100 },
  performance: { type: Number, required: true, min: 0, max: 100 },
  quality: { type: Number, required: true, min: 0, max: 100 },
  goodUnits: { type: Number, required: true, min: 0 },
  totalUnits: { type: Number, required: true, min: 0 },
  scrapUnits: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['running', 'breakdown', 'stopped', 'warning'], default: 'stopped' },
  runTime: { type: Number, default: 0, min: 0 },
  totalTime: { type: Number, default: 480, min: 0 },
  workingTimeMinutes: { type: Number, default: 0, min: 0 },
  stopTimeMinutes: { type: Number, default: 0, min: 0 },
  currentProductKey: { type: String, default: '', trim: true, select: false },
  currentProductStartedAt: { type: Date, default: null, select: false },
  maintenanceWorkingMinutes: { type: Number, default: 0, min: 0, select: false },
  workingHours: { type: Number, default: 0, min: 0, select: false },
  segments: { type: [Number], default: [0, 0, 0, 0] },
  borderColor: { type: String, default: 'rgba(34,197,94,0.5)' },
  bgColor: { type: String, default: 'rgba(34,197,94,0.25)' },
  shadow: { type: String, default: 'rgba(34,197,94,0.3)' },
  oeeColor: { type: String, default: '#fcd34d' }
}, { timestamps: true })

export default mongoose.model('Machine', MachineSchema)
