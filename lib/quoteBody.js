import { calculateDocumentTotals } from './documentTotals.js'

function defined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export function buildQuotationFields(body, existing) {
  const vatRate = Number(body.vatRate ?? existing?.vatRate ?? 5)
  const discountPercent = Number(body.discountPercent ?? existing?.discountPercent ?? 0)
  const discountAmount = Number(body.discountAmount ?? existing?.discountAmount ?? 0)

  const fields = defined({
    status: body.status,
    notes: body.notes,
    terms: body.terms,
    projectTitle: body.projectTitle,
    jobLocation: body.jobLocation,
    description: body.description,
    sendByEmail: body.sendByEmail,
    declineReason: body.declineReason,
    ownerName: body.ownerName,
    ownerEmail: body.ownerEmail,
    discountPercent,
    discountAmount,
    issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
    validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    quotationRequest: body.quotationRequestId,
    project: body.projectId,
  })

  if (body.items) {
    const calc = calculateDocumentTotals(body.items, { vatRate, discountPercent, discountAmount })
    Object.assign(fields, calc)
  }

  return fields
}