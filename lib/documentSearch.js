import Client from '../models/Client.js'

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function documentListFilter(queryText) {
  const q = (queryText || '').trim()
  if (!q) return {}

  const regex = new RegExp(escapeRegex(q), 'i')
  const clientIds = await Client.find({
    $or: [
      { name: regex },
      { firstName: regex },
      { lastName: regex },
      { company: regex },
      { email: regex },
      { phone: regex },
    ],
  }).distinct('_id')

  const or = [{ number: regex }, { status: regex }, { projectTitle: regex }, { jobLocation: regex }]
  if (clientIds.length) or.push({ client: { $in: clientIds } })

  return { $or: or }
}