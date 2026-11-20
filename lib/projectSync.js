import Project from '../models/Project.js'

/** After linking or creating a quotation on a project. */
export async function syncProjectWhenQuotationLinked(projectId) {
  if (!projectId) return
  const project = await Project.findById(projectId).lean()
  if (!project) return
  if (project.status === 'lead') {
    await Project.findByIdAndUpdate(projectId, { status: 'quoted' })
  }
}

/** When quotation status becomes accepted → project won. */
export async function syncProjectWhenQuoteAccepted(projectId) {
  if (!projectId) return
  const project = await Project.findById(projectId).lean()
  if (!project) return
  const terminal = ['completed', 'closed']
  if (terminal.includes(project.status)) return
  await Project.findByIdAndUpdate(projectId, { status: 'won' })
}