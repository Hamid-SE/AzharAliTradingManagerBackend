import { calculateLineItems } from './calculations.js'

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

function extractJsonObject(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('Empty model response')
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model response')
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('No line items returned')
  return items.map((row, i) => {
    const description = String(row.description || '').trim()
    if (!description) throw new Error(`Line item ${i + 1} is missing a description`)
    const quantity = Math.max(0, Number(row.quantity) || 1)
    const unit = String(row.unit || 'job').trim() || 'job'
    const unitPrice = Math.max(0, Number(row.unitPrice) || 0)
    return { description, quantity, unit, unitPrice }
  })
}

function buildPrompt({ prompt, company, context }) {
  const legal = company?.legalName || 'AZHAR ALI TRADING SPC'
  const paymentTerms = company?.paymentTerms || company?.quoteTerms || ''

  const system = `You write professional quotations for ${legal} in the Sultanate of Oman.
The printed document uses the company letterhead (logo, CR, VATIN, address) — you only supply quotation content.

Return a single JSON object with keys:
- projectTitle (string): subject line for the quote
- jobLocation (string): site/area if known, else ""
- items (array): each object has description, quantity, unit, unitPrice
- terms (string, optional): payment/terms text; omit to use company defaults

Each item description MUST follow this print format:
Line 1: short service title (prints bold)
Next lines: scope bullets, each starting with "- " (print as disc list)

Pricing:
- unitPrice in OMR (Baisa precision OK)
- realistic Oman market rates for cleaning, shifting, maintenance, trading services
- quantity typically 1 with unit "job" unless the user specifies days/units
- if the user gives a fixed total or line price, honour it in unitPrice

Output JSON only. No markdown wrapping.`

  const user = `Brief from user:
${prompt}

Known context (use if helpful, do not invent client names):
${JSON.stringify(context)}

Default payment terms if you omit terms field:
${paymentTerms || 'Cash payment only; quotation valid 30 days.'}`

  return { system, user }
}

export async function composeQuotationWithGemini({ prompt, company, vatRate = 5, context = {} }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the API.')
  }

  const { system, user } = buildPrompt({ prompt, company, context })
  const model = DEFAULT_GEMINI_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg =
      payload?.error?.message ||
      payload?.error?.status ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      `Gemini HTTP ${response.status}`
    throw new Error(msg)
  }

  const parts = payload?.candidates?.[0]?.content?.parts || []
  const content = parts.map((p) => p.text).filter(Boolean).join('\n')
  const parsed = extractJsonObject(content)
  const items = normalizeItems(parsed.items)
  const totals = calculateLineItems(items, vatRate)

  return {
    projectTitle: String(parsed.projectTitle || context.projectTitle || '').trim(),
    jobLocation: String(parsed.jobLocation || context.jobLocation || '').trim(),
    terms: String(parsed.terms || '').trim() || undefined,
    items: totals.items,
    subtotal: totals.subtotal,
    vat: totals.vat,
    total: totals.total,
    vatRate: totals.vatRate,
  }
}