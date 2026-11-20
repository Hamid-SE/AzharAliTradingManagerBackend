import { calculateDocumentTotals } from './documentTotals.js'

export function calculateLineItems(items, vatRate = 5, options = {}) {
  return calculateDocumentTotals(items, { vatRate, ...options })
}

export function formatOMR(value) {
  return new Intl.NumberFormat('en-OM', {
    style: 'currency',
    currency: 'OMR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value || 0)
}