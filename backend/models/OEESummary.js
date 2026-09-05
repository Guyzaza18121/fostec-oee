import mongoose from 'mongoose'

const HourlyMetricSchema = new mongoose.Schema({
  hour: { type: String, required: true },
  oee: { type: Number, required: true },
  availability: { type: Number, required: true },
  performance: { type: Number, required: true },
  quality: { type: Number, required: true }
}, { _id: false })

const OEESummarySchema = new mongoose.Schema({
  oee: { type: Number, required: true },
  availability: { type: Number, required: true },
  performance: { type: Number, required: true },
  quality: { type: Number, required: true },
  totalProduction: { type: Number, required: true },
  downtime: { type: Number, required: true },
  targetOee: { type: Number, default: 85.0 },
  goodUnits: { type: Number, required: true },
  scrapUnits: { type: Number, required: true },
  hourly: { type: [HourlyMetricSchema], default: [] },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true })

export default mongoose.model('OEESummary', OEESummarySchema)
