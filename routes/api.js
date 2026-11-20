import { Router } from 'express'
import { COOKIE, authenticateLogin, createSession, sessionCookieOptions } from '../lib/auth.js'
import { requireAdmin, requireApiUser } from '../lib/apiAuth.js'
import { hashPassword } from '../lib/passwords.js'
import { ensureBootstrapAdmin, publicUser } from '../lib/systemUsers.js'
import SystemUser from '../models/SystemUser.js'
import { connectDB } from '../lib/mongodb.js'
import { calculateLineItems } from '../lib/calculations.js'
import { calculateDocumentTotals } from '../lib/documentTotals.js'
import { nextNumber } from '../lib/sequences.js'
import { documentListFilter } from '../lib/documentSearch.js'
import { getCompanySettings } from '../lib/company.js'
import { buildQuotationFields } from '../lib/quoteBody.js'
import Client from '../models/Client.js'
import Quotation from '../models/Quotation.js'
import QuotationRequest from '../models/QuotationRequest.js'
import Invoice from '../models/Invoice.js'
import Product from '../models/Product.js'
import AppUser from '../models/AppUser.js'
import CompanySettings from '../models/CompanySettings.js'
import Project from '../models/Project.js'
import Expense from '../models/Expense.js'
import { buildClientFields } from '../lib/clientPayload.js'
import { computeProjectFinancials } from '../lib/projectFinancials.js'
import { syncProjectWhenQuotationLinked, syncProjectWhenQuoteAccepted } from '../lib/projectSync.js'
import { composeQuotationWithGemini } from '../lib/geminiQuotation.js'
import { resolveAmountPaidForSave } from '../lib/invoicePayments.js'

const router = Router()

router.post('/auth/login', async (req, res) => {
  const email = (req.body.email || '').trim()
  const password = req.body.password || ''

  await ensureBootstrapAdmin()
  const user = await authenticateLogin(email, password)
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = await createSession(user)
  res.cookie(COOKIE, token, sessionCookieOptions())
  res.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } })
})

router.post('/auth/logout', (_req, res) => {
  res.cookie(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  res.json({ ok: true })
})

router.get('/users/me', requireApiUser, async (req, res) => {
  res.json({
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    id: req.user.sub,
  })
})

router.get('/users', requireApiUser, requireAdmin, async (req, res) => {
  await connectDB()
  await ensureBootstrapAdmin()
  const q = (req.query.q || '').trim()
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ],
      }
    : {}
  const list = await SystemUser.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
  res.json(list.map(publicUser))
})

router.post('/users', requireApiUser, requireAdmin, async (req, res) => {
  await connectDB()
  const body = req.body
  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim()
  const password = body.password || ''
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' })
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  const existing = await SystemUser.findOne({ email }).lean()
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const user = await SystemUser.create({
    name,
    email,
    passwordHash: hashPassword(password),
    role: body.role === 'admin' ? 'admin' : 'user',
    active: body.active !== false,
    phone: (body.phone || '').trim() || undefined,
  })
  res.status(201).json(publicUser(user.toObject()))
})

router.get('/users/:id', requireApiUser, requireAdmin, async (req, res) => {
  await connectDB()
  const user = await SystemUser.findById(req.params.id).lean()
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(publicUser(user))
})

router.patch('/users/:id', requireApiUser, requireAdmin, async (req, res) => {
  await connectDB()
  const body = req.body
  const update = {}
  if (body.name != null) update.name = String(body.name).trim()
  if (body.email != null) update.email = String(body.email).trim().toLowerCase()
  if (body.phone != null) update.phone = String(body.phone).trim() || undefined
  if (body.role != null) update.role = body.role === 'admin' ? 'admin' : 'user'
  if (body.active != null) update.active = Boolean(body.active)
  if (body.password) {
    if (body.password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    update.passwordHash = hashPassword(body.password)
  }

  try {
    const user = await SystemUser.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).lean()
    if (!user) return res.status(404).json({ error: 'Not found' })
    res.json(publicUser(user))
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'Email already in use' })
    throw err
  }
})

router.delete('/users/:id', requireApiUser, requireAdmin, async (req, res) => {
  await connectDB()
  const target = await SystemUser.findById(req.params.id).lean()
  if (!target) return res.status(404).json({ error: 'Not found' })

  if (req.user.sub && String(target._id) === String(req.user.sub)) {
    return res.status(400).json({ error: 'You cannot delete your own account while signed in' })
  }

  if (target.role === 'admin') {
    const adminCount = await SystemUser.countDocuments({ role: 'admin', active: true })
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only active admin' })
    }
  }

  await SystemUser.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/projects', requireApiUser, async (req, res) => {
  await connectDB()
  const q = (req.query.q || '').trim()
  const status = req.query.status
  const clientId = req.query.clientId
  const filter = {}
  if (status) filter.status = status
  if (clientId) filter.client = clientId
  if (q) {
    filter.$or = [
      { number: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
    ]
  }
  const list = await Project.find(filter)
    .populate('client', 'name company phone email')
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean()

  const withTotals = await Promise.all(
    list.map(async (p) => {
      const fin = await computeProjectFinancials(p._id)
      return {
        ...p,
        revenueTotal: fin.revenueTotal,
        revenuePaid: fin.revenuePaid,
        expenseTotal: fin.expenseTotal,
        marginOnTotal: fin.marginOnTotal,
        marginOnPaid: fin.marginOnPaid,
      }
    }),
  )
  res.json(withTotals)
})

router.post('/projects', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  if (!body.clientId) return res.status(400).json({ error: 'Select a client' })
  if (!body.name?.trim()) return res.status(400).json({ error: 'Project name is required' })

  const number = await nextNumber('project', 'PRJ', { yearly: false })
  const project = await Project.create({
    number,
    client: body.clientId,
    name: body.name.trim(),
    location: body.location?.trim(),
    status: body.status || 'lead',
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    notes: body.notes?.trim(),
  })
  const populated = await Project.findById(project._id).populate('client').lean()
  res.status(201).json(populated)
})

router.get('/projects/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const project = await Project.findById(req.params.id).populate('client').lean()
  if (!project) return res.status(404).json({ error: 'Not found' })
  const financials = await computeProjectFinancials(project._id)
  res.json({ ...project, financials })
})

router.patch('/projects/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  const update = {}
  if (body.name != null) update.name = String(body.name).trim()
  if (body.location != null) update.location = String(body.location).trim()
  if (body.status != null) update.status = body.status
  if (body.notes != null) update.notes = String(body.notes).trim()
  if (body.startDate != null) update.startDate = body.startDate ? new Date(body.startDate) : null
  if (body.endDate != null) update.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.clientId) update.client = body.clientId

  const project = await Project.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    .populate('client')
    .lean()
  if (!project) return res.status(404).json({ error: 'Not found' })
  res.json(project)
})

router.delete('/projects/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const linkedQuotes = await Quotation.countDocuments({ project: req.params.id })
  const linkedInvoices = await Invoice.countDocuments({ project: req.params.id })
  const linkedExpenses = await Expense.countDocuments({ project: req.params.id })
  if (linkedQuotes || linkedInvoices || linkedExpenses) {
    return res.status(400).json({
      error: 'Project has linked quotations, invoices, or expenses. Remove links first.',
    })
  }
  await Project.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/expenses', requireApiUser, async (req, res) => {
  await connectDB()
  const q = (req.query.q || '').trim()
  const projectId = req.query.projectId
  const filter = {}
  if (projectId) filter.project = projectId
  if (q) {
    filter.$or = [
      { vendor: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { notes: { $regex: q, $options: 'i' } },
    ]
  }
  const list = await Expense.find(filter)
    .populate('project', 'number name')
    .sort({ date: -1 })
    .limit(500)
    .lean()
  res.json(list)
})

router.post('/expenses', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  if (!body.projectId) return res.status(400).json({ error: 'Every expense must be linked to a project' })
  const project = await Project.findById(body.projectId).lean()
  if (!project) return res.status(400).json({ error: 'Project not found' })

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'Valid amount is required' })
  }

  const expense = await Expense.create({
    project: body.projectId,
    date: body.date ? new Date(body.date) : new Date(),
    amount,
    category: body.category || 'other',
    vendor: body.vendor?.trim(),
    description: body.description?.trim(),
    notes: body.notes?.trim(),
    recordedBy: req.user?.email || req.user?.name || '',
  })
  const populated = await Expense.findById(expense._id).populate('project', 'number name').lean()
  res.status(201).json(populated)
})

router.get('/expenses/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const doc = await Expense.findById(req.params.id).populate('project', 'number name client').lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.patch('/expenses/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  const update = {}
  if (body.projectId) {
    const project = await Project.findById(body.projectId).lean()
    if (!project) return res.status(400).json({ error: 'Project not found' })
    update.project = body.projectId
  }
  if (body.amount != null) update.amount = Number(body.amount)
  if (body.date != null) update.date = new Date(body.date)
  if (body.category != null) update.category = body.category
  if (body.vendor != null) update.vendor = String(body.vendor).trim()
  if (body.description != null) update.description = String(body.description).trim()
  if (body.notes != null) update.notes = String(body.notes).trim()

  const doc = await Expense.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    .populate('project', 'number name')
    .lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.delete('/expenses/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await Expense.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/clients', requireApiUser, async (req, res) => {
  await connectDB()
  const q = req.query.q
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { company: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { city: { $regex: q, $options: 'i' } },
          { ntn: { $regex: q, $options: 'i' } },
          { bankName: { $regex: q, $options: 'i' } },
          { bankAccountNumber: { $regex: q, $options: 'i' } },
        ],
      }
    : {}

  const clients = await Client.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
  res.json(clients)
})

router.post('/clients', requireApiUser, async (req, res) => {
  await connectDB()
  const client = await Client.create(buildClientFields(req.body))
  res.status(201).json(client)
})

router.get('/clients/:id/hub', requireApiUser, async (req, res) => {
  await connectDB()
  const client = await Client.findById(req.params.id).lean()
  if (!client) return res.status(404).json({ error: 'Not found' })
  const [projects, quotesCount, invoicesCount] = await Promise.all([
    Project.find({ client: client._id }).sort({ updatedAt: -1 }).limit(50).lean(),
    Quotation.countDocuments({ client: client._id }),
    Invoice.countDocuments({ client: client._id }),
  ])
  res.json({ client, projects, quotesCount, invoicesCount })
})

router.get('/clients/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const client = await Client.findById(req.params.id).lean()
  if (!client) return res.status(404).json({ error: 'Not found' })
  res.json(client)
})

router.patch('/clients/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const client = await Client.findByIdAndUpdate(
    req.params.id,
    { $set: buildClientFields(req.body) },
    { new: true, runValidators: true },
  )
  if (!client) return res.status(404).json({ error: 'Not found' })
  res.json(client)
})

router.delete('/clients/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await Client.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/quotations', requireApiUser, async (req, res) => {
  await connectDB()
  const filter = await documentListFilter(req.query.q)
  const status = req.query.status
  if (status === 'declined') {
    filter.status = 'rejected'
  } else if (status) {
    filter.status = status
  }
  if (req.query.view === 'analyze-decline') {
    filter.status = 'rejected'
    filter.declineReason = { $exists: true, $ne: '' }
  }
  const list = await Quotation.find(filter)
    .populate('client', 'name company phone email')
    .populate('project', 'number name status')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean()
  res.json(list)
})

router.post('/quotations/ai-compose', requireApiUser, async (req, res) => {
  try {
    const prompt = String(req.body.prompt || '').trim()
    if (!prompt || prompt.length < 10) {
      return res.status(400).json({ error: 'Describe the job in a few sentences (at least 10 characters).' })
    }
    await connectDB()
    const company = await getCompanySettings()
    const vatRate = Number(req.body.vatRate ?? 5)
    const draft = await composeQuotationWithGemini({
      prompt,
      company: company?.toObject?.() || company,
      vatRate,
      context: {
        projectTitle: req.body.projectTitle,
        jobLocation: req.body.jobLocation,
        projectId: req.body.projectId,
      },
    })
    res.json(draft)
  } catch (err) {
    console.error('POST /quotations/ai-compose', err)
    res.status(500).json({ error: err.message || 'Could not generate quotation content' })
  }
})

router.post('/quotations', requireApiUser, async (req, res) => {
  try {
    const body = req.body
    if (!body.clientId) {
      return res.status(400).json({ error: 'Select a client' })
    }
    await connectDB()

    const vatRate = Number(body.vatRate ?? 5)
    const calc = calculateDocumentTotals(body.items, {
      vatRate,
      discountPercent: body.discountPercent,
      discountAmount: body.discountAmount,
    })
    const number = await nextNumber('quote', 'QT', { yearly: false })

    const company = await getCompanySettings()
    const validity = company.quoteValidityDays || 30

    const validUntil = body.validUntil
      ? new Date(body.validUntil)
      : new Date(Date.now() + validity * 24 * 60 * 60 * 1000)

    let ownerName = body.ownerName
    let ownerEmail = body.ownerEmail
    if (body.ownerId) {
      const owner = await AppUser.findById(body.ownerId).lean()
      if (owner) {
        ownerName = owner.name
        ownerEmail = owner.email
      }
    }

    let projectDoc = null
    if (body.projectId) {
      projectDoc = await Project.findById(body.projectId).lean()
      if (!projectDoc) return res.status(400).json({ error: 'Project not found' })
      if (String(projectDoc.client) !== String(body.clientId)) {
        return res.status(400).json({ error: 'Quotation client must match the project client' })
      }
    }

    const quotation = await Quotation.create({
      number,
      client: body.clientId,
      project: body.projectId || undefined,
      status: body.status || 'draft',
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      validUntil,
      ...calc,
      notes: body.notes,
      terms: body.terms,
      projectTitle: body.projectTitle || projectDoc?.name,
      jobLocation: body.jobLocation || projectDoc?.location,
      quotationRequest: body.quotationRequestId || undefined,
      ownerName,
      ownerEmail,
      description: body.description,
      sendByEmail: Boolean(body.sendByEmail),
      declineReason: body.declineReason,
    })

    if (body.projectId) {
      await syncProjectWhenQuotationLinked(body.projectId)
      if ((body.status || 'draft') === 'accepted') {
        await syncProjectWhenQuoteAccepted(body.projectId)
      }
    }

    if (body.quotationRequestId) {
      await QuotationRequest.findByIdAndUpdate(body.quotationRequestId, {
        status: 'created_quotation',
        quotation: quotation._id,
      })
    }

    const populated = await Quotation.findById(quotation._id).populate('client').lean()
    res.status(201).json(populated)
  } catch (err) {
    console.error('POST /quotations', err)
    res.status(500).json({ error: err.message || 'Could not create quotation' })
  }
})

router.get('/quotations/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const doc = await Quotation.findById(req.params.id).populate('client').populate('project', 'number name status').lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.patch('/quotations/:id', requireApiUser, async (req, res) => {
  const body = req.body
  await connectDB()

  const existing = await Quotation.findById(req.params.id).lean()
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const update = buildQuotationFields(body, existing)
  if (body.clientId) update.client = body.clientId
  if (body.projectId !== undefined) update.project = body.projectId || null
  if (body.ownerId) {
    const owner = await AppUser.findById(body.ownerId).lean()
    if (owner) {
      update.ownerName = owner.name
      update.ownerEmail = owner.email
    }
  }

  const doc = await Quotation.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    .populate('client')
    .lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })

  const projectId = doc.project?._id || doc.project
  if (projectId) {
    if (body.projectId !== undefined) await syncProjectWhenQuotationLinked(projectId)
    if (doc.status === 'accepted') await syncProjectWhenQuoteAccepted(projectId)
  }

  res.json(doc)
})

router.delete('/quotations/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await Quotation.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.post('/quotations/:id/convert', requireApiUser, async (req, res) => {
  await connectDB()
  const quote = await Quotation.findById(req.params.id).lean()
  if (!quote) return res.status(404).json({ error: 'Quotation not found' })

  const number = await nextNumber('invoice', 'INV')
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invoice = await Invoice.create({
    number,
    client: quote.client,
    project: quote.project,
    quotation: quote._id,
    status: 'draft',
    issueDate: new Date(),
    dueDate,
    items: quote.items,
    subtotal: quote.subtotal,
    vatRate: quote.vatRate,
    vat: quote.vat,
    total: quote.total,
    notes: quote.notes,
    terms: quote.terms,
    projectTitle: quote.projectTitle,
  })

  await Quotation.findByIdAndUpdate(req.params.id, { status: 'accepted' })
  if (quote.project) {
    await syncProjectWhenQuoteAccepted(quote.project)
  }

  const populated = await Invoice.findById(invoice._id).populate('client').lean()
  res.status(201).json(populated)
})

router.get('/invoices', requireApiUser, async (req, res) => {
  await connectDB()
  const filter = await documentListFilter(req.query.q)
  const list = await Invoice.find(filter)
    .populate('client', 'name company phone email')
    .populate('project', 'number name status')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean()
  res.json(list)
})

router.post('/invoices', requireApiUser, async (req, res) => {
  const body = req.body
  await connectDB()

  if (!body.clientId) return res.status(400).json({ error: 'Select a client' })
  if (!body.projectId) return res.status(400).json({ error: 'Every invoice must be linked to a project' })

  const vatRate = Number(body.vatRate ?? 5)
  const { items, subtotal, vat, total } = calculateLineItems(body.items, vatRate)
  const number = await nextNumber('invoice', 'INV')

  if (body.projectId) {
    const project = await Project.findById(body.projectId).lean()
    if (!project) return res.status(400).json({ error: 'Project not found' })
    if (String(project.client) !== String(body.clientId)) {
      return res.status(400).json({ error: 'Invoice client must match the project client' })
    }
  }

  const invoiceStatus = body.status || 'draft'
  const invoice = await Invoice.create({
    number,
    client: body.clientId,
    project: body.projectId || undefined,
    status: invoiceStatus,
    issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 86400000),
    items,
    subtotal,
    vatRate,
    vat,
    total,
    amountPaid: resolveAmountPaidForSave({
      status: invoiceStatus,
      amountPaid: body.amountPaid,
      total,
    }),
    notes: body.notes,
    terms: body.terms,
    projectTitle: body.projectTitle,
  })

  const populated = await Invoice.findById(invoice._id).populate('client').lean()
  res.status(201).json(populated)
})

router.get('/invoices/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const doc = await Invoice.findById(req.params.id)
    .populate('client')
    .populate('project', 'number name status location')
    .populate('quotation', 'number')
    .lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.patch('/invoices/:id', requireApiUser, async (req, res) => {
  const body = req.body
  await connectDB()

  const update = { ...body }
  delete update.clientId
  delete update.projectId
  if (body.clientId) update.client = body.clientId
  if (body.projectId !== undefined) update.project = body.projectId || null

  if (body.items) {
    const vatRate = Number(body.vatRate ?? update.vatRate ?? 5)
    const calc = calculateLineItems(body.items, vatRate)
    Object.assign(update, calc, { vatRate })
  }

  const existing = await Invoice.findById(req.params.id).select('total status amountPaid').lean()
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const nextStatus = update.status ?? existing.status
  const nextTotal = update.total ?? existing.total
  update.amountPaid = resolveAmountPaidForSave({
    status: nextStatus,
    amountPaid: body.amountPaid !== undefined ? body.amountPaid : update.amountPaid ?? existing.amountPaid,
    total: nextTotal,
  })

  const doc = await Invoice.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    .populate('client')
    .populate('project', 'number name status location')
    .populate('quotation', 'number')
    .lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.delete('/invoices/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await Invoice.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/products', requireApiUser, async (req, res) => {
  await connectDB()
  const q = (req.query.q || '').trim()
  const filter = q ? { name: { $regex: q, $options: 'i' } } : {}
  const list = await Product.find(filter).sort({ name: 1 }).limit(500).lean()
  res.json(list)
})

router.get('/products/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const product = await Product.findById(req.params.id).lean()
  if (!product) return res.status(404).json({ error: 'Not found' })
  res.json(product)
})

router.post('/products', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  const product = await Product.create({
    name: body.name,
    rate: Number(body.rate) || 0,
    unit: body.unit || 'job',
    availableQuantity: body.availableQuantity != null ? Number(body.availableQuantity) : undefined,
  })
  res.status(201).json(product)
})

router.patch('/products/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        name: body.name,
        rate: body.rate != null ? Number(body.rate) : undefined,
        unit: body.unit,
        availableQuantity: body.availableQuantity != null ? Number(body.availableQuantity) : undefined,
      },
    },
    { new: true, runValidators: true },
  ).lean()
  if (!product) return res.status(404).json({ error: 'Not found' })
  res.json(product)
})

router.delete('/products/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await Product.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/app-users', requireApiUser, async (_req, res) => {
  await connectDB()
  let users = await AppUser.find({ active: true }).sort({ name: 1 }).lean()
  if (!users.length && process.env.ADMIN_EMAIL) {
    const admin = await AppUser.create({
      name: process.env.ADMIN_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL,
    })
    users = [admin.toObject()]
  }
  res.json(users)
})

router.post('/app-users', requireApiUser, async (req, res) => {
  await connectDB()
  const user = await AppUser.create({
    name: req.body.name,
    email: req.body.email,
    active: req.body.active !== false,
  })
  res.status(201).json(user)
})

router.patch('/app-users/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const user = await AppUser.findByIdAndUpdate(
    req.params.id,
    { $set: { name: req.body.name, email: req.body.email, active: req.body.active } },
    { new: true },
  ).lean()
  if (!user) return res.status(404).json({ error: 'Not found' })
  res.json(user)
})

router.delete('/app-users/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await AppUser.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/quotation-requests', requireApiUser, async (req, res) => {
  await connectDB()
  const filter = {}
  const status = req.query.status
  if (status) filter.status = status
  if (req.query.view === 'overdue') {
    filter.requiredBefore = { $lt: new Date() }
    filter.status = { $in: ['pending', 'sent_to_client'] }
  }
  if (req.query.view === 'mine' && req.user?.email) {
    filter.requestedBy = req.user.email
  }
  const q = (req.query.q || '').trim()
  if (q) {
    const clients = await Client.find({
      $or: [{ name: { $regex: q, $options: 'i' } }, { company: { $regex: q, $options: 'i' } }],
    })
      .select('_id')
      .lean()
    filter.$or = [{ number: { $regex: q, $options: 'i' } }, { client: { $in: clients.map((c) => c._id) } }]
  }
  const list = await QuotationRequest.find(filter)
    .populate('client', 'name company phone email')
    .populate('quotation', 'number status')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean()
  res.json(list)
})

router.post('/quotation-requests', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  if (!body.clientId) return res.status(400).json({ error: 'Select a client' })
  const number = await nextNumber('quote_request', 'QR', { yearly: false })
  const doc = await QuotationRequest.create({
    number,
    client: body.clientId,
    requiredBefore: body.requiredBefore ? new Date(body.requiredBefore) : undefined,
    status: body.status || 'pending',
    items: body.items || [],
    requestedBy: req.user?.email || '',
  })
  const populated = await QuotationRequest.findById(doc._id).populate('client').lean()
  res.status(201).json(populated)
})

router.get('/quotation-requests/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const doc = await QuotationRequest.findById(req.params.id).populate('client').populate('quotation').lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.patch('/quotation-requests/:id', requireApiUser, async (req, res) => {
  await connectDB()
  const body = req.body
  const update = {
    status: body.status,
    requiredBefore: body.requiredBefore ? new Date(body.requiredBefore) : undefined,
    items: body.items,
  }
  if (body.clientId) update.client = body.clientId
  const doc = await QuotationRequest.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    .populate('client')
    .lean()
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.delete('/quotation-requests/:id', requireApiUser, async (req, res) => {
  await connectDB()
  await QuotationRequest.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

router.get('/dashboard', requireApiUser, async (_req, res) => {
  try {
    await connectDB()
  } catch (err) {
    console.error('[dashboard] database:', err)
    const hint =
      err?.message === 'Missing MONGODB_URI environment variable'
        ? 'Add MONGODB_URI to backend/.env (Atlas connection string), then restart the backend.'
        : 'Could not connect to MongoDB. Check MONGODB_URI, Atlas IP access, and database user password.'
    return res.status(503).json({
      error: hint,
      detail: process.env.NODE_ENV === 'development' ? err?.message : undefined,
    })
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [clients, quotes, invoices, products, requests, overdueRequests, projects, activeProjects, expensesThisMonth] =
    await Promise.all([
      Client.countDocuments(),
      Quotation.countDocuments(),
      Invoice.countDocuments(),
      Product.countDocuments(),
      QuotationRequest.countDocuments(),
      QuotationRequest.countDocuments({
        requiredBefore: { $lt: new Date() },
        status: { $in: ['pending', 'sent_to_client'] },
      }),
      Project.countDocuments(),
      Project.countDocuments({ status: { $in: ['quoted', 'won', 'in_progress'] } }),
      Expense.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).then((r) => r[0]?.total ?? 0),
    ])

  const openQuotes = await Quotation.countDocuments({ status: { $in: ['draft', 'sent'] } })
  const unpaidInvoices = await Invoice.countDocuments({ status: { $in: ['sent', 'partial', 'overdue'] } })

  const recentQuotes = await Quotation.find()
    .populate('client', 'name')
    .populate('project', 'number name')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean()

  const recentInvoices = await Invoice.find()
    .populate('client', 'name')
    .populate('project', 'number name')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean()

  const spotlightProjects = await Project.find({ status: { $in: ['quoted', 'won', 'in_progress', 'lead'] } })
    .populate('client', 'name')
    .sort({ updatedAt: -1 })
    .limit(6)
    .lean()

  const spotlight = await Promise.all(
    spotlightProjects.map(async (p) => {
      const fin = await computeProjectFinancials(p._id)
      return {
        _id: p._id,
        number: p.number,
        name: p.name,
        status: p.status,
        client: p.client,
        revenueTotal: fin.revenueTotal,
        revenuePaid: fin.revenuePaid,
        expenseTotal: fin.expenseTotal,
        marginOnPaid: fin.marginOnPaid,
        marginOnTotal: fin.marginOnTotal,
      }
    }),
  )

  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  const revenueThisMonth = await Invoice.aggregate([
    { $match: { issueDate: { $gte: monthStart, $lt: monthEnd } } },
    { $group: { _id: null, revenue: { $sum: '$total' } } },
  ]).then((r) => Math.round((r[0]?.revenue ?? 0) * 1000) / 1000)

  const [revenueByProject, expenseByProject, projectRows] = await Promise.all([
    Invoice.aggregate([
      { $match: { project: { $ne: null } } },
      { $group: { _id: '$project', revenue: { $sum: '$total' } } },
    ]),
    Expense.aggregate([
      { $match: { project: { $ne: null } } },
      { $group: { _id: '$project', expenses: { $sum: '$amount' } } },
    ]),
    Project.find().select('number name').sort({ updatedAt: -1 }).lean(),
  ])

  const revenueMap = new Map(revenueByProject.map((r) => [String(r._id), r.revenue || 0]))
  const expenseMap = new Map(expenseByProject.map((r) => [String(r._id), r.expenses || 0]))

  const projectRevenueSeries = projectRows
    .map((p) => {
      const id = String(p._id)
      const revenue = Math.round((revenueMap.get(id) ?? 0) * 1000) / 1000
      const expenses = Math.round((expenseMap.get(id) ?? 0) * 1000) / 1000
      return {
        key: id,
        label: p.number,
        name: p.name || '',
        revenue,
        expenses,
      }
    })
    .filter((row) => row.revenue > 0 || row.expenses > 0)
    .sort((a, b) => b.revenue + b.expenses - (a.revenue + a.expenses))

  const [quotesByStatus, invoicesByStatus, projectsByStatus] = await Promise.all([
    Quotation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).then((rows) =>
      rows.map((r) => ({ status: r._id || 'draft', count: r.count })),
    ),
    Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).then((rows) =>
      rows.map((r) => ({ status: r._id || 'draft', count: r.count })),
    ),
    Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).then((rows) =>
      rows.map((r) => ({ status: r._id || 'lead', count: r.count })),
    ),
  ])

  res.json({
    clients,
    quotes,
    invoices,
    products,
    requests,
    overdueRequests,
    projects,
    activeProjects,
    expensesThisMonth,
    revenueThisMonth,
    openQuotes,
    unpaidInvoices,
    recentQuotes,
    recentInvoices,
    spotlightProjects: spotlight,
    projectRevenueSeries,
    quotesByStatus,
    invoicesByStatus,
    projectsByStatus,
  })
})

router.get('/settings/company', requireApiUser, async (_req, res) => {
  const settings = await getCompanySettings()
  res.json(settings)
})

router.patch('/settings/company', requireApiUser, async (req, res) => {
  await connectDB()
  const settings = await CompanySettings.findByIdAndUpdate(
    'company',
    { $set: req.body },
    { new: true, upsert: true },
  ).lean()
  res.json(settings)
})

export default router