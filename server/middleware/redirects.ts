import { db } from '../utils/db'
import { normalizeRedirectPath } from '../utils/redirect-validation'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const pathname = getRequestURL(event).pathname
  if (pathname.startsWith('/api/') || pathname.startsWith('/_nuxt/') || pathname.startsWith('/uploads/')) return
  const source = normalizeRedirectPath(pathname)
  if (!source) return
  const row = await db.redirect.findUnique({ where: { source } })
  if (row?.enabled && row.source !== row.destination) return sendRedirect(event, row.destination, row.statusCode)
})
