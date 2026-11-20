import mongoose from 'mongoose'
import { lineItemSchema } from './lineItem.js'

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
      default: 'draft',
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    items: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 5 },
    vat: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    terms: { type: String, trim: true },
    projectTitle: { type: String, trim: true },
  },
  { timestamps: true },
)

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema)
