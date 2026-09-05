import mongoose from 'mongoose'

const LossSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, enum: ['Availability', 'Performance', 'Quality'], required: true },
  value: { type: Number, required: true },
  color: { type: String, required: true },
  width: { type: Number, required: true }
}, { timestamps: true })

export default mongoose.model('Loss', LossSchema)
