import { z } from 'zod'
import { renderMarkdown, sanitizeContentHtml } from '../../utils/content'
import { requireAdmin, requireCsrf } from '../../utils/security'

const schema = z.union([
  z.object({ markdown: z.string().max(2_000_000) }),
  z.object({ html: z.string().max(2_000_000) }),
])

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const body = schema.parse(await readBody(event))
  return { html: 'markdown' in body
    ? await renderMarkdown(body.markdown)
    : sanitizeContentHtml(body.html) }
})
