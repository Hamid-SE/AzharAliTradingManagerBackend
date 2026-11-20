import mongoose from 'mongoose'

const systemUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    active: { type: Boolean, default: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true },
)

export default mongoose.models.SystemUser || mongoose.model('SystemUser', systemUserSchema)