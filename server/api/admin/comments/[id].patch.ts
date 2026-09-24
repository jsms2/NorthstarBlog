import { z } from 'zod'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'

const schema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'SPAM', 'TRASH']).optional(), pinned: z.boolean().optional() })
  .refine(value => value.status !== undefined || value.pinned !== undefined)

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '评论数据无效' })
  return db.comment.update({ where: { id: getRouterParam(event, 'id')! }, data: parsed.data })
})
