import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const id = getRouterParam(event, 'id')!
  const comment = await db.comment.findUnique({ where: { id }, select: { status: true } })
  if (!comment) throw createError({ statusCode: 404, statusMessage: '评论不存在' })
  if (comment.status !== 'TRASH') throw createError({ statusCode: 409, statusMessage: '请先移至回收站' })
  await db.comment.delete({ where: { id } })
  return { ok: true }
})
