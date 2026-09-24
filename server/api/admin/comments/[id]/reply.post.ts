import { z } from 'zod'
import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../../utils/security'

const schema = z.object({ content: z.string().trim().min(2).max(5000) })

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '回复内容无效' })
  const parent = await db.comment.findUnique({ where: { id: getRouterParam(event, 'id')! } })
  if (!parent || parent.status === 'TRASH') throw createError({ statusCode: 404, statusMessage: '评论不存在' })
  return db.comment.create({ data: { postId: parent.postId, pageId: parent.pageId, parentId: parent.id,
    authorName: admin.username, email: admin.email, content: parsed.data.content,
    status: 'APPROVED', isAdmin: true } })
})
