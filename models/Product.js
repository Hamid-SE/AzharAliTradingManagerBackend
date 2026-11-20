import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, default: 'job' },
    availableQuantity: { type: Number, min: 0 },
  },
  { timestamps: true },
)

export default mongoose.models.Product || mongoose.model('Product', productSchema)