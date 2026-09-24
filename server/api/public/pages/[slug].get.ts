import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const page = await db.page.findFirst({
    where: { slug: getRouterParam(event, 'slug'), status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
    select: {
      id: true, title: true, slug: true, html: true, excerpt: true, seoTitle: true,
      seoDescription: true, canonicalUrl: true, ogTitle: true, ogDescription: true, ogImage: true, customCss: true, customJs: true,
      noindex: true, nofollow: true, allowComments: true,
      comments: {
        where: { status: 'APPROVED' },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, authorName: true, content: true, createdAt: true, parentId: true, isAdmin: true, likes: true },
      },
    },
  })
  if (!page) throw createError({ statusCode: 404, statusMessage: '页面不存在' })
  return page
})
