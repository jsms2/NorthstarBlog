import { z } from 'zod'
import { contentMetrics, renderMarkdown } from '../../utils/content'
import { db } from '../../utils/db'
import { requireAdmin, requireCsrf } from '../../utils/security'
import { safeNavUrl } from '../../utils/validation'

const name = z.string().trim().min(1).max(255)
const slug = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const status = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PRIVATE', 'TRASH'])
const record = z.record(z.string(), z.unknown())
const envelope = z.object({ formatVersion: z.literal(1), data: z.record(z.string(), z.unknown()) })
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
function rejectPrototypeKeys(value: unknown, depth = 0): void {
  if (depth > 40) throw createError({ statusCode: 400, statusMessage: '导入数据嵌套过深' })
  if (Array.isArray(value)) return value.forEach((item) => rejectPrototypeKeys(item, depth + 1))
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key))
        throw createError({ statusCode: 400, statusMessage: '导入数据包含非法字段' })
      rejectPrototypeKeys(child, depth + 1)
    }
  }
}
function rows(data: Record<string, unknown>, key: string, max = 10000): Record<string, unknown>[] {
  const parsed = z
    .array(record)
    .max(max)
    .safeParse(data[key] ?? [])
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: `导入字段 ${key} 格式无效` })
  return parsed.data
}
function text(value: unknown, max = 1000000) {
  if (typeof value !== 'string' || value.length > max)
    throw createError({ statusCode: 400, statusMessage: '导入字段文本无效或过长' })
  return value
}
function parseMarkdown(filename: string, content: string) {
  if (
    filename !== filename.split(/[\\/]/).at(-1) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}\.md$/i.test(filename)
  )
    throw createError({ statusCode: 400, statusMessage: 'Markdown 文件名无效' })
  if (content.length > 2_000_000)
    throw createError({ statusCode: 413, statusMessage: 'Markdown 文件超过 2MB' })
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)
  if (!match)
    throw createError({ statusCode: 400, statusMessage: `${filename} 缺少 YAML Front Matter` })
  const metadata: Record<string, unknown> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/)
    if (!field) continue
    const [, key, raw] = field
    try {
      metadata[key!] = JSON.parse(raw!)
    } catch {
      metadata[key!] = raw!.replace(/^['"]|['"]$/g, '')
    }
  }
  const source = content.slice(match[0].length)
  const tags = Array.isArray(metadata.tags) ? metadata.tags : []
  if (typeof metadata.title !== 'string' || typeof metadata.slug !== 'string')
    throw createError({ statusCode: 400, statusMessage: `${filename} 缺少 title 或 slug` })
  slug.parse(metadata.slug)
  if (!['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PRIVATE'].includes(String(metadata.status || 'DRAFT')))
    throw createError({ statusCode: 400, statusMessage: `${filename} 的 status 无效` })
  return {
    title: name.parse(metadata.title),
    slug: metadata.slug,
    markdown: source,
    excerpt: typeof metadata.excerpt === 'string' ? metadata.excerpt.slice(0, 1000) : '',
    status: metadata.status || 'DRAFT',
    category: metadata.category || null,
    tags: tags.filter((x): x is string => typeof x === 'string').slice(0, 100),
    series: [],
    coverUrl: typeof metadata.cover === 'string' ? metadata.cover : null,
    publishedAt: typeof metadata.publishedAt === 'string' ? metadata.publishedAt : null,
    seoTitle:
      typeof (metadata.seo as Record<string, unknown> | undefined)?.title === 'string'
        ? (metadata.seo as Record<string, string>).title
        : null,
    seoDescription:
      typeof (metadata.seo as Record<string, unknown> | undefined)?.description === 'string'
        ? (metadata.seo as Record<string, string>).description
        : null,
  }
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  requireCsrf(event)
  const declaredSize = Number(getHeader(event, 'content-length') || 0)
  if (declaredSize > 15 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '导入文件最大 15MB' })
  const body = await readBody(event)
  if (Buffer.byteLength(JSON.stringify(body)) > 15 * 1024 * 1024)
    throw createError({ statusCode: 413, statusMessage: '导入文件最大 15MB' })
  rejectPrototypeKeys(body)
  let payload: Record<string, unknown>
  if (body && typeof body === 'object' && body.format === 'markdown') {
    const files = z
      .array(z.object({ filename: z.string(), content: z.string() }))
      .min(1)
      .max(100)
      .parse(body.files)
    const posts = files.map((file) => parseMarkdown(file.filename, file.content))
    payload = { formatVersion: 1, data: { posts } }
  } else {
    const parsed = envelope.safeParse(body)
    if (!parsed.success)
      throw createError({
        statusCode: 400,
        statusMessage: '不支持的导入格式或版本；需要 formatVersion: 1',
      })
    payload = parsed.data
  }
  const data = payload.data as Record<string, unknown>
  const categories = rows(data, 'categories')
  const tags = rows(data, 'tags')
  const series = rows(data, 'series')
  const posts = rows(data, 'posts')
  const pages = rows(data, 'pages')
  const comments = rows(data, 'comments')
  const nav = rows(data, 'navigation')
  const links = rows(data, 'links')
  const redirects = rows(data, 'redirects')
  const settings = rows(data, 'settings')
  const validatedPosts: Array<
    Record<string, unknown> & {
      title: string
      slug: string
      markdown: string
      excerpt: string | null
      status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PRIVATE' | 'TRASH'
    }
  > = posts.map((p) => ({
    ...p,
    title: name.parse(p.title),
    slug: slug.parse(p.slug),
    markdown: text(p.markdown, 2_000_000),
    excerpt: typeof p.excerpt === 'string' ? p.excerpt.slice(0, 1000) : null,
    status: status.parse(p.status || 'DRAFT'),
  }))
  const validatedPages: Array<
    Record<string, unknown> & {
      title: string
      slug: string
      markdown: string
      status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'PRIVATE' | 'TRASH'
    }
  > = pages.map((p) => ({
    ...p,
    title: name.parse(p.title),
    slug: slug.parse(p.slug),
    markdown: text(p.markdown, 2_000_000),
    status: status.parse(p.status || 'DRAFT'),
  }))
  for (const c of categories) {
    name.parse(c.name)
    slug.parse(c.slug)
  }
  for (const t of tags) {
    name.parse(t.name)
    slug.parse(t.slug)
  }
  for (const s of series) {
    name.parse(s.name)
    slug.parse(s.slug)
  }
  const result = await db.$transaction(
    async (tx) => {
      const categoryMap = new Map<string, string>()
      for (const c of categories) {
        const item = await tx.category.upsert({
          where: { slug: c.slug as string },
          update: {
            name: c.name as string,
            description: typeof c.description === 'string' ? c.description : null,
          },
          create: {
            name: c.name as string,
            slug: c.slug as string,
            description: typeof c.description === 'string' ? c.description : null,
          },
        })
        categoryMap.set(item.slug, item.id)
      }
      for (const c of categories)
        if (typeof c.parent === 'string' && categoryMap.has(c.parent))
          await tx.category.update({
            where: { id: categoryMap.get(c.slug as string)! },
            data: { parentId: categoryMap.get(c.parent)! },
          })
      const tagMap = new Map<string, string>()
      for (const t of tags) {
        const item = await tx.tag.upsert({
          where: { slug: t.slug as string },
          update: {
            name: t.name as string,
            description: typeof t.description === 'string' ? t.description : null,
            color: typeof t.color === 'string' ? t.color : null,
          },
          create: {
            name: t.name as string,
            slug: t.slug as string,
            description: typeof t.description === 'string' ? t.description : null,
            color: typeof t.color === 'string' ? t.color : null,
          },
        })
        tagMap.set(item.slug, item.id)
      }
      const seriesMap = new Map<string, string>()
      for (const s of series) {
        const item = await tx.series.upsert({
          where: { slug: s.slug as string },
          update: {
            name: s.name as string,
            description: typeof s.description === 'string' ? s.description : null,
            coverUrl: typeof s.coverUrl === 'string' ? s.coverUrl : null,
          },
          create: {
            name: s.name as string,
            slug: s.slug as string,
            description: typeof s.description === 'string' ? s.description : null,
            coverUrl: typeof s.coverUrl === 'string' ? s.coverUrl : null,
          },
        })
        seriesMap.set(item.slug, item.id)
      }
      const postMap = new Map<string, string>()
      for (const p of validatedPosts) {
        const metrics = contentMetrics(p.markdown)
        const html = await renderMarkdown(p.markdown)
        const categoryId =
          typeof p.category === 'string' ? (categoryMap.get(p.category) ?? null) : null
        const fields = {
          title: p.title,
          excerpt: p.excerpt,
          markdown: p.markdown,
          html,
          searchText: metrics.searchText,
          wordCount: metrics.wordCount,
          readingMinutes: metrics.readingMinutes,
          status: p.status,
          publishedAt:
            typeof p.publishedAt === 'string' && !Number.isNaN(Date.parse(p.publishedAt))
              ? new Date(p.publishedAt)
              : p.status === 'PUBLISHED'
                ? new Date()
                : null,
          categoryId,
          coverUrl: typeof p.coverUrl === 'string' ? p.coverUrl : null,
          seoTitle: typeof p.seoTitle === 'string' ? p.seoTitle : null,
          seoDescription: typeof p.seoDescription === 'string' ? p.seoDescription : null,
          allowComments: p.allowComments !== false,
          showToc: p.showToc !== false,
          featured: p.featured === true,
          noindex: p.noindex === true,
          nofollow: p.nofollow === true,
        }
        const item = await tx.post.upsert({
          where: { slug: p.slug },
          update: fields,
          create: { ...fields, slug: p.slug, authorId: admin.id },
        })
        postMap.set(item.slug, item.id)
        await tx.postTag.deleteMany({ where: { postId: item.id } })
        const postTags = Array.isArray(p.tags)
          ? p.tags.filter((x): x is string => typeof x === 'string' && tagMap.has(x))
          : []
        if (postTags.length)
          await tx.postTag.createMany({
            data: [...new Set(postTags)].map((tagSlug) => ({
              postId: item.id,
              tagId: tagMap.get(tagSlug)!,
            })),
            skipDuplicates: true,
          })
      }
      for (const s of series) {
        const seriesId = seriesMap.get(s.slug as string)!
        await tx.seriesPost.deleteMany({ where: { seriesId } })
        const entries = Array.isArray(s.posts) ? (s.posts as Array<Record<string, unknown>>) : []
        const unique = [
          ...new Set(
            entries
              .map((x) => x.slug)
              .filter((x): x is string => typeof x === 'string' && postMap.has(x)),
          ),
        ]
        for (let i = 0; i < unique.length; i++)
          await tx.seriesPost.create({
            data: { seriesId, postId: postMap.get(unique[i]!)!, position: i },
          })
      }
      const pageMap = new Map<string, string>()
      for (const p of validatedPages) {
        const html = await renderMarkdown(p.markdown)
        const fields = {
          title: p.title,
          markdown: p.markdown,
          html,
          status: p.status,
          excerpt: typeof p.excerpt === 'string' ? p.excerpt : null,
          seoTitle: typeof p.seoTitle === 'string' ? p.seoTitle : null,
          seoDescription: typeof p.seoDescription === 'string' ? p.seoDescription : null,
          noindex: p.noindex === true,
          nofollow: p.nofollow === true,
          allowComments: p.allowComments === true,
          template: typeof p.template === 'string' ? p.template.slice(0, 64) : 'default',
          publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
        }
        const savedPage = await tx.page.upsert({
          where: { slug: p.slug },
          update: fields,
          create: { ...fields, slug: p.slug, authorId: admin.id },
        })
        pageMap.set(savedPage.slug, savedPage.id)
      }
      for (const item of links)
        if (typeof item.name === 'string' && typeof item.url === 'string' && safeNavUrl(item.url)) {
          const existing = await tx.link.findFirst({ where: { url: item.url } })
          const fields = {
            name: item.name.slice(0, 150),
            description:
              typeof item.description === 'string' ? item.description.slice(0, 500) : null,
            group: typeof item.group === 'string' ? item.group.slice(0, 100) : null,
            visible: item.visible !== false,
            position:
              typeof item.position === 'number' ? Math.max(0, Math.floor(item.position)) : 0,
            logo: typeof item.logo === 'string' ? item.logo.slice(0, 1000) : null,
          }
          if (existing) await tx.link.update({ where: { id: existing.id }, data: fields })
          else await tx.link.create({ data: { ...fields, url: item.url.slice(0, 1000) } })
        }
      for (const r of redirects)
        if (
          typeof r.source === 'string' &&
          typeof r.destination === 'string' &&
          r.source.startsWith('/') &&
          !r.source.startsWith('//') &&
          r.source !== r.destination &&
          safeNavUrl(r.destination)
        )
          await tx.redirect.upsert({
            where: { source: r.source },
            update: {
              destination: r.destination,
              statusCode: r.statusCode === 302 ? 302 : 301,
              enabled: r.enabled !== false,
            },
            create: {
              source: r.source,
              destination: r.destination,
              statusCode: r.statusCode === 302 ? 302 : 301,
              enabled: r.enabled !== false,
            },
          })
      for (const setting of settings)
        if (
          typeof setting.key === 'string' &&
          typeof setting.group === 'string' &&
          !/(secret|token|password|credential|private.?key|api.?key|access.?key|database.?url|connection.?string|^db_|^smtp|^mail)/i.test(setting.key)
        )
          await tx.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value as object, group: setting.group },
            create: { key: setting.key, value: setting.value as object, group: setting.group },
          })
      const navMap = new Map<string, string>()
      for (const item of nav.filter((x) => !x.parent))
        if (typeof item.label === 'string' && typeof item.url === 'string') {
          const created = await tx.navigation.create({
            data: {
              location: item.location === 'footer' ? 'footer' : 'header',
              label: item.label.slice(0, 100),
              url: item.url.slice(0, 1000),
              icon: typeof item.icon === 'string' ? item.icon.slice(0, 100) : null,
              newWindow: item.newWindow === true,
              position:
                typeof item.position === 'number' ? Math.max(0, Math.floor(item.position)) : 0,
            },
          })
          if (typeof item.exportKey === 'string') navMap.set(item.exportKey, created.id)
        }
      for (const item of nav.filter((x) => x.parent))
        if (
          typeof item.label === 'string' &&
          typeof item.url === 'string' &&
          typeof item.parent === 'string' &&
          navMap.has(item.parent)
        )
          await tx.navigation.create({
            data: {
              location: item.location === 'footer' ? 'footer' : 'header',
              label: item.label.slice(0, 100),
              url: item.url.slice(0, 1000),
              icon: typeof item.icon === 'string' ? item.icon.slice(0, 100) : null,
              newWindow: item.newWindow === true,
              position:
                typeof item.position === 'number' ? Math.max(0, Math.floor(item.position)) : 0,
              parentId: navMap.get(item.parent)!,
            },
          })
      const commentMap = new Map<string, string>()
      for (const item of comments)
        if (
          ((typeof item.post === 'string' && postMap.has(item.post)) ||
            (typeof item.page === 'string' && pageMap.has(item.page))) &&
          typeof item.authorName === 'string' &&
          typeof item.email === 'string' &&
          typeof item.content === 'string'
        ) {
          const created = await tx.comment.create({
            data: {
              postId: typeof item.post === 'string' ? postMap.get(item.post) : null,
              pageId: typeof item.page === 'string' ? pageMap.get(item.page) : null,
              authorName: item.authorName.slice(0, 100),
              email: item.email.slice(0, 191),
              website: typeof item.website === 'string' ? item.website.slice(0, 500) : null,
              content: item.content.slice(0, 5000),
              status: ['PENDING', 'APPROVED', 'SPAM', 'TRASH'].includes(String(item.status))
                ? (item.status as 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASH')
                : 'PENDING',
              pinned: item.pinned === true,
              isAdmin: item.isAdmin === true,
              likes: typeof item.likes === 'number' ? Math.max(0, Math.floor(item.likes)) : 0,
            },
          })
          if (typeof item.exportKey === 'string') commentMap.set(item.exportKey, created.id)
        }
      for (const item of comments)
        if (
          typeof item.exportKey === 'string' &&
          typeof item.parent === 'string' &&
          commentMap.has(item.exportKey) &&
          commentMap.has(item.parent)
        )
          await tx.comment.update({
            where: { id: commentMap.get(item.exportKey)! },
            data: { parentId: commentMap.get(item.parent)! },
          })
      return {
        posts: validatedPosts.length,
        pages: validatedPages.length,
        categories: categories.length,
        tags: tags.length,
        series: series.length,
        comments: comments.length,
      }
    },
    { timeout: 60000 },
  )
  return { ok: true, imported: result }
})
