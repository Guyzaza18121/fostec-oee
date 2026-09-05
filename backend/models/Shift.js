import mongoose from 'mongoose'

const ShiftSchema = new mongoose.Schema({
  // Shift metadata
  name: { type: String, required: true, trim: true },
  type: { type: String, default: '' },
  time: { type: String, default: '' },
  status: { type: String, enum: ['waiting', 'running', 'done'], default: 'waiting' },
  isCurrent: { type: Boolean, default: false },
  color: { type: String, default: '#3b82f6' },

  // Product setting data
  productionDate: { type: Date, default: null },
  product: { type: String, default: '', trim: true },
  received: { type: Number, default: 0, min: 0 },
  target: { type: Number, default: 0, min: 0 },
  bagSize: { type: Number, default: 0, min: 0 },
  cleaningTime: { type: String, default: '' },
  actualBags: { type: Number, default: 0, min: 0 },

  // Queue order for drag-drop scheduling (lower = earlier)
  order: { type: Number, default: 0, min: 0 },

  // Legacy OEE fields (kept for backward compatibility)
  availability: { type: Number, default: 0, min: 0 },
  runtime: { type: Number, default: 0, min: 0 },
  downtime: { type: Number, default: 0, min: 0 }
}, { timestamps: true })

export default mongoose.model('Shift', ShiftSchema)
