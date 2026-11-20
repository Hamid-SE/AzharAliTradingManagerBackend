/**
 * Side-effect imports register every Mongoose model before populate() runs.
 * Import this once from connectDB (or any API route that uses refs).
 */
import './Client.js'
import './Quotation.js'
import './Invoice.js'
import './CompanySettings.js'
import './Sequence.js'