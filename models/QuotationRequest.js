import mongoose from 'mongoose'

const requestItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const quotationRequestSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    requiredBefore: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'sent_to_client', 'rejected', 'created_quotation'],
      default: 'pending',
    },
    items: { type: [requestItemSchema], default: [] },
    requestedBy: { type: String, trim: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  },
  { timestamps: true },
)

export default mongoose.models.QuotationRequest || mongoose.model('QuotationRequest', quotationRequestSchema)