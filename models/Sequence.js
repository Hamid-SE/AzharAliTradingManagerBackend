import mongoose from 'mongoose'

const sequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  prefix: String,
  value: { type: Number, default: 0 },
})

export default mongoose.models.Sequence || mongoose.model('Sequence', sequenceSchema)
