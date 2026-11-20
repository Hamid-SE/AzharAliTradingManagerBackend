import mongoose from 'mongoose'

const appUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default mongoose.models.AppUser || mongoose.model('AppUser', appUserSchema)