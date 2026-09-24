import { db } from '../../../../utils/db'
import { rateLimit } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  rateLimit(event, `comment-like-${id}`, 1, 24 * 60 * 60_000)
  const comment = await db.comment.findFirst({ where: { id, status: 'APPROVED', OR: [
    { post: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } } },
    { page: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } } },
  ] }, select: { id: true } })
  if (!comment) throw createError({ statusCode: 404, statusMessage: '评论不存在' })
  const updated = await db.comment.update({ where: { id }, data: { likes: { increment: 1 } }, select: { likes: true } })
  return updated
})
