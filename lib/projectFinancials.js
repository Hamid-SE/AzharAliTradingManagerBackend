import Expense from '../models/Expense.js'
import Invoice from '../models/Invoice.js'
import Quotation from '../models/Quotation.js'
import { effectiveAmountPaid } from './invoicePayments.js'

export async function computeProjectFinancials(projectId) {
  const [invoices, expenses, quotations] = await Promise.all([
    Invoice.find({ project: projectId }).select('total amountPaid status number issueDate').lean(),
    Expense.find({ project: projectId }).select('amount date category vendor description notes').lean(),
    Quotation.find({ project: projectId }).select('number status total issueDate').lean(),
  ])

  const revenueTotal = invoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0)
  const revenuePaid = invoices.reduce((sum, i) => sum + effectiveAmountPaid(i), 0)
  const expenseTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  return {
    revenueTotal,
    revenuePaid,
    expenseTotal,
    marginOnTotal: Math.round((revenueTotal - expenseTotal) * 1000) / 1000,
    marginOnPaid: Math.round((revenuePaid - expenseTotal) * 1000) / 1000,
    invoices,
    expenses,
    quotations,
  }
}