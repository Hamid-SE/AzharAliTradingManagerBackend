export function calculateDocumentTotals(items, { vatRate = 5, discountPercent = 0, discountAmount = 0 } = {}) {
  const normalized = (items || []).map((item) => {
    const qty = Number(item.quantity) || 0
    const unit = Number(item.unitPrice) || 0
    const amount = Math.round(qty * unit * 1000) / 1000
    return { ...item, quantity: qty, unitPrice: unit, amount }
  })

  const subtotal = Math.round(normalized.reduce((sum, i) => sum + i.amount, 0) * 1000) / 1000

  let discount = Number(discountAmount) || 0
  const pct = Number(discountPercent) || 0
  if (pct > 0) {
    discount = Math.round(subtotal * (pct / 100) * 1000) / 1000
  }
  discount = Math.min(discount, subtotal)

  const taxable = Math.round((subtotal - discount) * 1000) / 1000
  const vat = Math.round(taxable * (Number(vatRate) / 100) * 1000) / 1000
  const total = Math.round((taxable + vat) * 1000) / 1000

  return {
    items: normalized,
    subtotal,
    discountPercent: pct,
    discountAmount: discount,
    taxable,
    vat,
    vatRate: Number(vatRate),
    total,
  }
}