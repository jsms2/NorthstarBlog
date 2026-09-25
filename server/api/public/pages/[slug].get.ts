import { db } from '../../../utils/db'
import { renderMarkdown } from '../../../utils/content'
import { commentsVisible } from '../../../../lib/comment-visibility'

export default defineEventHandler(async (event) => {
  const page = await db.page.findFirst({
    where: { slug: getRouterParam(event, 'slug'), status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
    select: {
      id: true, title: true, slug: true, markdown: true, excerpt: true, seoTitle: true,
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
  const commentsSetting = await db.setting.findUnique({ where: { key: 'commentsEnabled' }, select: { value: true } })
  const { markdown, ...publicPage } = page
  return { ...publicPage, allowComments: commentsVisible(page.allowComments, commentsSetting?.value),
    html: await renderMarkdown(markdown) }
})
