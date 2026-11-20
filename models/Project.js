import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: ['lead', 'quoted', 'won', 'in_progress', 'completed', 'closed'],
      default: 'lead',
    },
    startDate: { type: Date },
    endDate: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
)

export default mongoose.models.Project || mongoose.model('Project', projectSchema)