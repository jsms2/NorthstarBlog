import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  requireCsrf(event)
  const id = getRouterParam(event, 'id')!
  const permanent = getQuery(event).permanent === 'true'
  const post = await db.post.findUnique({ where: { id }, select: { status: true } })
  if (!post) throw createError({ statusCode: 404, statusMessage: '文章不存在' })
  if (permanent) {
    if (post.status !== 'TRASH') throw createError({ statusCode: 409, statusMessage: '请先移入回收站' })
    await db.post.delete({ where: { id } })
    return { deleted: true }
  }
  return db.post.update({ where: { id }, data: { status: 'TRASH', deletedAt: new Date() } })
})
