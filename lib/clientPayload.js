export function buildClientFields(body) {
  const firstName = (body.firstName ?? '').trim()
  const lastName = (body.lastName ?? '').trim()
  let name = [firstName, lastName].filter(Boolean).join(' ')

  if (!name && body.name) {
    const legacy = String(body.name).trim()
    const parts = legacy.split(/\s+/)
    return {
      firstName: parts[0] || legacy,
      lastName: parts.slice(1).join(' '),
      name: legacy,
      company: body.company,
      phone: body.phone,
      email: body.email,
      city: body.city,
      address: body.address,
      ntn: body.ntn,
      bankName: body.bankName,
      bankAccountNumber: body.bankAccountNumber,
      notes: body.notes,
    }
  }

  return {
    firstName: firstName || name,
    lastName,
    name,
    company: body.company,
    phone: body.phone,
    email: body.email,
    city: body.city,
    address: body.address,
    ntn: body.ntn,
    bankName: body.bankName,
    bankAccountNumber: body.bankAccountNumber,
    notes: body.notes,
  }
}