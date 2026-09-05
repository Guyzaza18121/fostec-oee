import mongoose from 'mongoose'

const DefectItemSchema = new mongoose.Schema({
  type: { type: String, required: true },
  count: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 }
}, { _id: false })

const QualityRecordSchema = new mongoose.Schema({
  shift: { type: String, default: '' },
  line: { type: String, default: '' },
  product: { type: String, default: '' },
  produced: { type: Number, default: 0 },
  good: { type: Number, default: 0 },
  defect: { type: Number, default: 0 },
  rework: { type: Number, default: 0 },
  quality: { type: Number, default: 0 },
  defectBreakdown: { type: [DefectItemSchema], default: [] },
  inspectedBy: { type: String, default: '' },
  inspectedAt: { type: Date, default: Date.now }
}, { timestamps: true })

QualityRecordSchema.index({ inspectedAt: -1, line: 1 })
QualityRecordSchema.index({ product: 1, inspectedAt: -1 })

export default mongoose.model('QualityRecord', QualityRecordSchema)
