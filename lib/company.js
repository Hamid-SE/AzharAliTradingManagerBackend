import { connectDB } from './mongodb.js'
import CompanySettings from '../models/CompanySettings.js'

const LEGACY_VALUES = {
  email: 'info@azharalitrading.com',
  phone: '+968 7992 1690',
  address: 'Muscat, Sultanate of Oman',
}

const OFFICIAL_PATCH = {
  legalName: 'AZHAR ALI TRADING SPC',
  crNumber: '1441587',
  vatNumber: 'OM110055678X',
  address: 'P.O. Box 1099, P.C. 130, Sultanate of Oman',
  phone: '+968 7764 6161',
  email: 'azharalitrading@gmail.com',
  documentFooter: 'AZHAR ALI TRADING SPC  |  azharalitrading@gmail.com  |  +968 7764 6161',
}

export async function getCompanySettings() {
  await connectDB()
  let doc = await CompanySettings.findById('company')
  if (!doc) {
    doc = await CompanySettings.create({ _id: 'company' })
    return doc
  }

  const patch = {}
  const empty = (v) => v === undefined || v === null || String(v).trim() === '' || v === '—'
  for (const [key, official] of Object.entries(OFFICIAL_PATCH)) {
    const current = doc[key]
    if (empty(current) || (LEGACY_VALUES[key] && current === LEGACY_VALUES[key])) {
      patch[key] = official
    }
  }
  if (empty(doc.crNumber)) patch.crNumber = OFFICIAL_PATCH.crNumber
  if (empty(doc.vatNumber)) patch.vatNumber = OFFICIAL_PATCH.vatNumber

  if (Object.keys(patch).length) {
    doc = await CompanySettings.findByIdAndUpdate('company', { $set: patch }, { new: true })
  }

  return doc
}
