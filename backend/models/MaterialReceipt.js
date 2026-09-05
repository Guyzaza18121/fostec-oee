import mongoose from 'mongoose'

const MaterialReceiptSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  product: { type: String, required: true, trim: true },
  lot: { type: String, default: '' },
  weight: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' },
  operator: { type: String, default: '' },
}, { timestamps: true })

MaterialReceiptSchema.index({ date: -1 })
MaterialReceiptSchema.index({ product: 1 })

export default mongoose.model('MaterialReceipt', MaterialReceiptSchema)
