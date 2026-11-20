import mongoose from 'mongoose'

const clientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    /** Full display name for quotations (auto from first + last). */
    name: { type: String, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    city: { type: String, trim: true, default: 'Muscat' },
    address: { type: String, trim: true },
    ntn: { type: String, trim: true },
    bankName: { type: String, trim: true },
    bankAccountNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
)

clientSchema.pre('validate', function syncName() {
  const first = (this.firstName || '').trim()
  const last = (this.lastName || '').trim()
  if (first || last) {
    this.name = [first, last].filter(Boolean).join(' ')
    return
  }
  const legacy = (this.name || '').trim()
  if (legacy && !first) {
    const parts = legacy.split(/\s+/)
    this.firstName = parts[0]
    this.lastName = parts.slice(1).join(' ')
  }
})

export default mongoose.models.Client || mongoose.model('Client', clientSchema)