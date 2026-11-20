import mongoose from 'mongoose'

const companySettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'company' },
    legalName: { type: String, default: 'AZHAR ALI TRADING SPC' },
    phone: { type: String, default: '+968 7764 6161' },
    email: { type: String, default: 'azharalitrading@gmail.com' },
    address: { type: String, default: 'P.O. Box 1099, P.C. 130, Sultanate of Oman' },
    vatNumber: { type: String, default: 'OM110055678X' },
    crNumber: { type: String, default: '1441587' },
    defaultVatRate: { type: Number, default: 5 },
    quoteValidityDays: { type: Number, default: 30 },
    quoteTerms: {
      type: String,
      default: 'Quotation valid for 30 days. Prices in OMR unless stated otherwise.',
    },
    paymentTerms: {
      type: String,
      default:
        'Cash payment only\nElectricity will be provided by the client company\nQuotation valid for 30 days',
    },
    invoiceTerms: {
      type: String,
      default: 'Payment due within 7 days of invoice date unless agreed otherwise.',
    },
    bankAccountName: { type: String, default: 'Azhar Ali Trading SPC' },
    bankAccountNumber: { type: String, default: '0435063111240012' },
    bankDetails: { type: String, default: '' },
    documentFooter: {
      type: String,
      default: 'AZHAR ALI TRADING SPC  |  azharalitrading@gmail.com  |  +968 7764 6161',
    },
    logoUrl: { type: String, default: '/company-logo.png' },
    stampUrl: { type: String, default: '/pdf-asset-0.png' },
    signatureName: { type: String, default: 'Authorized Signatory' },
  },
  { timestamps: true },
)

export default mongoose.models.CompanySettings || mongoose.model('CompanySettings', companySettingsSchema)
