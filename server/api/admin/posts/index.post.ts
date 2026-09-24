import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '../../../utils/db'
import { requireAdmin, requireCsrf } from '../../../utils/security'
import { contentMetrics, renderMarkdown, sanitizeContentHtml } from '../../../utils/content'

const schema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(191).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().max(1000).nullable().optional(),
  markdown: z.string().default(''),
  html: z.string().max(2_000_000).optional(),
  editorJson: z.unknown().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PRIVATE']).default('DRAFT'),
  scheduledAt: z.iso.datetime().nullable().optional(),
  featured: z.boolean().optional(),
  pinned: z.boolean().optional(),
  coverUrl: z.string().max(1000).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  allowComments: z.boolean().optional(),
  showToc: z.boolean().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  ogTitle: z.string().max(255).nullable().optional(),
  ogDescription: z.string().max(500).nullable().optional(),
  canonicalUrl: z.string().max(1000).nullable().optional(),
  noindex: z.boolean().optional(),
  nofollow: z.boolean().optional(),
  ogImage: z.string().max(1000).nullable().optional(),
}).superRefine((post, context) => {
  if (post.status === 'SCHEDULED' && !post.scheduledAt)
    context.addIssue({ code: 'custom', path: ['scheduledAt'], message: '定时文章必须设置发布时间' })
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: '文章数据无效' })
  const body = parsed.data
  const metrics = contentMetrics(body.markdown)
  const html = body.html ? sanitizeContentHtml(body.html) : await renderMarkdown(body.markdown)
  const searchText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return db.post.create({
    data: {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      markdown: body.markdown,
      html,
      editorJson: body.editorJson as Prisma.InputJsonValue | undefined,
      searchText,
      status: body.status,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      featured: body.featured,
      pinned: body.pinned,
      coverUrl: body.coverUrl,
      categoryId: body.categoryId,
      allowComments: body.allowComments,
      showToc: body.showToc,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      ogTitle: body.ogTitle,
      ogDescription: body.ogDescription,
      canonicalUrl: body.canonicalUrl,
      noindex: body.noindex,
      nofollow: body.nofollow,
      ogImage: body.ogImage,
      wordCount: metrics.wordCount,
      readingMinutes: metrics.readingMinutes,
      authorId: admin.id,
      tags: { create: [...new Set(body.tagIds || [])].map(tagId => ({ tagId })) },
      revisions: { create: { title: body.title, markdown: body.markdown, editorJson: body.editorJson as Prisma.InputJsonValue | undefined, summary: '创建文章' } },
    },
  })
})
