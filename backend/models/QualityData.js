import mongoose from 'mongoose'

const DefectBreakdownSchema = new mongoose.Schema({
  type: { type: String, required: true },
  count: { type: Number, required: true },
  percentage: { type: Number, required: true }
}, { _id: false })

const QualityTrendSchema = new mongoose.Schema({
  date: { type: String, required: true },
  quality: { type: Number, required: true }
}, { _id: false })

const QualityDataSchema = new mongoose.Schema({
  current: { type: Number, required: true },
  totalProduced: { type: Number, required: true },
  defectCount: { type: Number, required: true },
  reworkCount: { type: Number, required: true },
  defectBreakdown: { type: [DefectBreakdownSchema], default: [] },
  trend: { type: [QualityTrendSchema], default: [] }
}, { timestamps: true })

export default mongoose.model('QualityData', QualityDataSchema)
