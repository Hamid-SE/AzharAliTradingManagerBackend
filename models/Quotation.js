import mongoose from 'mongoose'
import { lineItemSchema } from './lineItem.js'

const quotationSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
      default: 'draft',
    },
    issueDate: { type: Date, default: Date.now },
    validUntil: { type: Date },
    items: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 5 },
    vat: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    projectTitle: { type: String, trim: true },
    jobLocation: { type: String, trim: true },
    quotationRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationRequest' },
    ownerName: { type: String, trim: true },
    ownerEmail: { type: String, trim: true, lowercase: true },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxable: { type: Number, default: 0 },
    description: { type: String, trim: true },
    sendByEmail: { type: Boolean, default: false },
    declineReason: { type: String, trim: true },
  },
  { timestamps: true },
)

export default mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema)
