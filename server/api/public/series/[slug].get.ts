import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const series = await db.series.findUnique({
    where: { slug: getRouterParam(event, 'slug')! },
    include: {
      posts: {
        orderBy: { position: 'asc' },
        where: { post: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null } },
        include: { post: { select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true, readingMinutes: true } } },
      },
    },
  })
  if (!series) throw createError({ statusCode: 404, statusMessage: '系列不存在' })
  return {
    ...series,
    posts: series.posts.map((entry, index, all) => ({
      ...entry,
      progress: Math.round(((index + 1) / all.length) * 100),
      previous: index ? { slug: all[index - 1]!.post.slug, title: all[index - 1]!.post.title } : null,
      next: index + 1 < all.length ? { slug: all[index + 1]!.post.slug, title: all[index + 1]!.post.title } : null,
    })),
  }
})
