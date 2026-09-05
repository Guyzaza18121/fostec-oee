import mongoose from 'mongoose'

const MaintenanceRecordSchema = new mongoose.Schema({
  equipment: { type: String, required: true },
  equipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },
  type: { type: String, enum: ['Preventive', 'Corrective', 'Inspection', 'Calibration', 'Other'], default: 'Preventive' },
  date: { type: Date, required: true, default: Date.now },
  durationHours: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  parts: { type: [String], default: [] },
  technician: { type: String, default: '' },
  description: { type: String, default: '' },
  nextSchedule: { type: Date, default: null },
  completed: { type: Boolean, default: true }
}, { timestamps: true })

MaintenanceRecordSchema.index({ equipment: 1, date: -1 })
MaintenanceRecordSchema.index({ nextSchedule: 1 })

export default mongoose.model('MaintenanceRecord', MaintenanceRecordSchema)
