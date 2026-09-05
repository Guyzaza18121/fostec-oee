import mongoose from 'mongoose'

const MachineStatusLogSchema = new mongoose.Schema({
  machine: { type: String, required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', default: null },
  line: { type: String, default: '' },
  oldStatus: { type: String, enum: ['running', 'breakdown', 'stopped', 'warning'], default: 'stopped' },
  newStatus: { type: String, enum: ['running', 'breakdown', 'stopped', 'warning'], required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: String, default: '' },
  reason: { type: String, default: '' }
}, { timestamps: true })

MachineStatusLogSchema.index({ machine: 1, changedAt: -1 })

export default mongoose.model('MachineStatusLog', MachineStatusLogSchema)
