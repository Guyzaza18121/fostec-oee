import mongoose from 'mongoose'

const EquipmentSchema = new mongoose.Schema({
  equipmentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['running', 'warning', 'stopped'], default: 'stopped' },
  efficiency: { type: Number, required: true },
  lastMaintenance: { type: Date, required: true },
  nextMaintenance: { type: Date, required: true }
}, { timestamps: true })

export default mongoose.model('Equipment', EquipmentSchema)
