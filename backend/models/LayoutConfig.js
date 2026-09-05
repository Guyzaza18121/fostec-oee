import mongoose from 'mongoose'

const layoutProfileSchema = new mongoose.Schema(
  {
    imageOffset: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    imageScale: { type: Number, default: 1 },
    imageWidthScale: { type: Number, default: 1 },
    layoutCacheVersion: { type: Number },
    panels: { type: mongoose.Schema.Types.Mixed, default: {} },
    savedAt: { type: Date },
  },
  { _id: false }
)

const layoutConfigSchema = new mongoose.Schema(
  {
    collapsed: { type: layoutProfileSchema, default: undefined },
    expanded: { type: layoutProfileSchema, default: undefined },
    tablet: { type: layoutProfileSchema, default: undefined },
    tabletCollapsed: { type: layoutProfileSchema, default: undefined },
    tabletExpanded: { type: layoutProfileSchema, default: undefined },
  },
  { timestamps: true }
)

const LayoutConfig = mongoose.model('LayoutConfig', layoutConfigSchema)

export default LayoutConfig
