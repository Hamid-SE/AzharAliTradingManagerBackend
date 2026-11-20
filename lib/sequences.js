import Sequence from '../models/Sequence.js'

export async function nextNumber(key, prefix, { yearly = true } = {}) {
  const id = yearly ? `${key}-${new Date().getFullYear()}` : key

  const seq = await Sequence.findOneAndUpdate(
    { _id: id },
    { $inc: { value: 1 }, $set: { prefix } },
    { upsert: true, new: true },
  )

  const padded = String(seq.value).padStart(4, '0')
  if (yearly) return `${prefix}-${new Date().getFullYear()}-${padded}`
  return `${prefix}-${padded}`
}
