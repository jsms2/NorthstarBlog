import { z } from 'zod'
import { db } from '../../../../utils/db'
import { clientHash, rateLimit } from '../../../../utils/security'

const schema = z.object({
  authorName: z.string().trim().min(1).max(100),
  email: z.email().max(191),
  website: z.union([z.url().max(500), z.literal('')]).optional(),
  content: z.string().trim().min(2).max(5000),
  parentId: z.string().optional(),
  company: z.string().max(0).optional(),
})

export default defineEventHandler(async (event) => {
  rateLimit(event, 'comment', 5, 10 * 60_000)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '评论数据无效' })
  const body = parsed.data
  const setting = await db.setting.findUnique({ where: { key: 'commentsEnabled' } })
  if (setting?.value === false) throw createError({ statusCode: 403, statusMessage: '全站评论已关闭' })
  const page = await db.page.findFirst({
    where: { id: getRouterParam(event, 'id'), status: 'PUBLISHED', allowComments: true, deletedAt: null,
      publishedAt: { lte: new Date() } },
    select: { id: true },
  })
  if (!page) throw createError({ statusCode: 404, statusMessage: '页面不存在或评论已关闭' })
  if (body.parentId) {
    const parent = await db.comment.findFirst({ where: { id: body.parentId, pageId: page.id, status: 'APPROVED' }, select: { id: true } })
    if (!parent) throw createError({ statusCode: 400, statusMessage: '回复目标无效' })
  }
  await db.comment.create({
    data: {
      pageId: page.id, authorName: body.authorName, email: body.email,
      website: body.website || null, content: body.content, parentId: body.parentId,
      ipHash: clientHash(event),
    },
  })
  return { ok: true }
})
