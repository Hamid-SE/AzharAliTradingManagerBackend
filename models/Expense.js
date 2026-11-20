import mongoose from 'mongoose'

const expenseSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['materials', 'labour', 'transport', 'subcontractor', 'other'],
      default: 'other',
    },
    vendor: { type: String, trim: true },
    description: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: String, trim: true },
  },
  { timestamps: true },
)

export default mongoose.models.Expense || mongoose.model('Expense', expenseSchema)