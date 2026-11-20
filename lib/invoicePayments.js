/**
 * Cash received on an invoice. Status "paid" with blank amountPaid still counts as fully collected.
 */
export function effectiveAmountPaid(invoice) {
  const total = Number(invoice?.total) || 0
  const recorded = Number(invoice?.amountPaid) || 0
  const status = (invoice?.status || 'draft').toLowerCase()

  if (status === 'paid') {
    return recorded > 0 ? Math.min(recorded, total) : total
  }
  if (status === 'partial') {
    return Math.min(recorded, total)
  }
  return Math.min(recorded, total)
}

/** When saving: paid status should persist a payment amount for lists and reports. */
export function resolveAmountPaidForSave({ status, amountPaid, total }) {
  const invoiceTotal = Number(total) || 0
  const recorded = Number(amountPaid) || 0
  const s = (status || 'draft').toLowerCase()

  if (s === 'paid') {
    return recorded > 0 ? Math.min(recorded, invoiceTotal) : invoiceTotal
  }
  if (s === 'partial') {
    return Math.min(recorded, invoiceTotal)
  }
  if (s === 'draft' || s === 'cancelled') {
    return 0
  }
  return Math.min(recorded, invoiceTotal)
}