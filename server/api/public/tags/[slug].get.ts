import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const tag = await db.tag.findUnique({
    where: { slug: getRouterParam(event, 'slug')! },
    include: {
      posts: {
        where: { post: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null } },
        orderBy: { post: { publishedAt: 'desc' } },
        include: { post: { select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true } } },
      },
    },
  })
  if (!tag) throw createError({ statusCode: 404, statusMessage: '标签不存在' })
  return { ...tag, posts: tag.posts.map(entry => entry.post) }
})
