const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function chunkToWords(n) {
  if (n === 0) return ''
  if (n < 20) return ones[n]
  if (n < 100) {
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim()
  }
  if (n < 1000) {
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${chunkToWords(n % 100)}` : ''}`.trim()
  }
  if (n < 1_000_000) {
    return `${chunkToWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${chunkToWords(n % 1000)}` : ''}`.trim()
  }
  return `${chunkToWords(Math.floor(n / 1_000_000))} Million${n % 1_000_000 ? ` ${chunkToWords(n % 1_000_000)}` : ''}`.trim()
}

export function amountInWordsOMR(total) {
  const value = Math.round((Number(total) || 0) * 1000) / 1000
  const whole = Math.floor(value)
  const baisa = Math.round((value - whole) * 1000)

  const riyalPart = whole === 0 ? 'Zero' : chunkToWords(whole)
  const baisaPart = baisa === 0 ? '' : ` and ${chunkToWords(baisa)} Baisa`

  return `${riyalPart} OMR${baisaPart} Only`
}