export function formatDecimalOMR(value) {
  return (Number(value) || 0).toFixed(2)
}

export function formatDocDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export function validityDays(issueDate, validUntil, fallback = 30) {
  if (!issueDate || !validUntil) return fallback
  const start = new Date(issueDate)
  const end = new Date(validUntil)
  const days = Math.round((end - start) / (24 * 60 * 60 * 1000))
  return days > 0 ? days : fallback
}