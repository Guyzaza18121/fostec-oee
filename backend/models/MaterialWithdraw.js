import mongoose from 'mongoose'

const MaterialWithdrawSchema = new mongoose.Schema({
  productionEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionEntry', default: null },
  date: { type: Date, required: true },
  product: { type: String, required: true, trim: true },
  weight: { type: Number, required: true, min: 0 },
  productionOrder: { type: String, default: '' },
  operator: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true })

MaterialWithdrawSchema.index({ date: -1 })
MaterialWithdrawSchema.index({ product: 1 })
MaterialWithdrawSchema.index({ productionEntryId: 1 })

export default mongoose.model('MaterialWithdraw', MaterialWithdrawSchema)
