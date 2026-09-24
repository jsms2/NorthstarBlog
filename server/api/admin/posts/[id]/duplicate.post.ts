import { db } from '../../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const source = await db.post.findUnique({
    where: { id: getRouterParam(event, 'id')! },
    include: { tags: true },
  })
  if (!source) throw createError({ statusCode: 404, statusMessage: '文章不存在' })
  const baseSlug = `${source.slug}-copy`.slice(0, 180)
  let slug = baseSlug
  for (let suffix = 2; await db.post.findUnique({ where: { slug }, select: { id: true } }); suffix++) {
    slug = `${baseSlug}-${suffix}`
  }
  return db.post.create({
    data: {
      title: `${source.title} (copy)`.slice(0, 255),
      slug,
      excerpt: source.excerpt,
      markdown: source.markdown,
      html: source.html,
      editorJson: source.editorJson ?? undefined,
      searchText: source.searchText,
      coverUrl: source.coverUrl,
      status: 'DRAFT',
      featured: source.featured,
      pinned: false,
      allowComments: source.allowComments,
      showToc: source.showToc,
      wordCount: source.wordCount,
      readingMinutes: source.readingMinutes,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      canonicalUrl: source.canonicalUrl,
      noindex: source.noindex,
      nofollow: source.nofollow,
      ogImage: source.ogImage,
      authorId: admin.id,
      categoryId: source.categoryId,
      tags: { create: source.tags.map(({ tagId }) => ({ tagId })) },
      revisions: { create: { title: source.title, markdown: source.markdown, editorJson: source.editorJson ?? undefined, summary: '复制文章' } },
    },
  })
})
