import mongoose from 'mongoose'

const DowntimeEventSchema = new mongoose.Schema({
  machine: { type: String, required: true },
  machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', default: null },
  line: { type: String, default: '' },
  startTime: { type: Date, required: true },
  endTime: { type: Date, default: null },
  durationMinutes: { type: Number, default: 0 },
  category: { type: String, enum: ['Availability', 'Performance', 'Quality', 'Planned', 'Unplanned'], default: 'Unplanned' },
  reason: { type: String, default: '' },
  reasonCode: { type: String, default: '' },
  description: { type: String, default: '' },
  reportedBy: { type: String, default: '' },
  resolved: { type: Boolean, default: false }
}, { timestamps: true })

DowntimeEventSchema.index({ machine: 1, startTime: -1 })
DowntimeEventSchema.index({ line: 1, startTime: -1 })
DowntimeEventSchema.index({ resolved: 1 })

export default mongoose.model('DowntimeEvent', DowntimeEventSchema)
