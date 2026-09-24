import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const category = await db.category.findUnique({
    where: { slug: getRouterParam(event, 'slug')! },
    include: {
      parent: { select: { name: true, slug: true } },
      children: { orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true } },
      posts: {
        where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null },
        orderBy: { publishedAt: 'desc' },
        select: { id: true, title: true, slug: true, excerpt: true, coverUrl: true, publishedAt: true },
      },
    },
  })
  if (!category) throw createError({ statusCode: 404, statusMessage: '分类不存在' })
  return category
})
