import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import type { Archiver, ArchiverOptions } from 'archiver'
import { db } from '../../utils/db'
import { requireAdmin } from '../../utils/security'

const { ZipArchive } = createRequire(import.meta.url)('archiver') as {
  ZipArchive: new (options?: ArchiverOptions) => Archiver
}

async function exportData() {
  const [posts, pages, categories, tags, series, comments, navigation, links, redirects, settings] =
    await Promise.all([
      db.post.findMany({
        include: {
          category: { select: { slug: true } },
          tags: { include: { tag: { select: { slug: true } } } },
          seriesLinks: {
            include: { series: { select: { slug: true } } },
            orderBy: { position: 'asc' },
          },
          revisions: { orderBy: { createdAt: 'asc' } },
        },
      }),
      db.page.findMany(),
      db.category.findMany({ include: { parent: { select: { slug: true } } } }),
      db.tag.findMany(),
      db.series.findMany({
        include: {
          posts: { include: { post: { select: { slug: true } } }, orderBy: { position: 'asc' } },
        },
      }),
      db.comment.findMany({
        include: { post: { select: { slug: true } }, page: { select: { slug: true } }, parent: { select: { id: true } } },
      }),
      db.navigation.findMany({ orderBy: [{ location: 'asc' }, { position: 'asc' }] }),
      db.link.findMany({ orderBy: [{ group: 'asc' }, { position: 'asc' }] }),
      db.redirect.findMany(),
      db.setting.findMany(),
    ])
  const sensitiveSetting =
    /(secret|token|password|credential|private.?key|api.?key|access.?key|database.?url|connection.?string|^db_|^smtp|^mail)/i
  const sanitizeSetting = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sanitizeSetting)
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, child]) =>
          sensitiveSetting.test(key) ? [] : [[key, sanitizeSetting(child)]],
        ),
      )
    if (typeof value === 'string' && /^(?:mysql|mariadb|postgres(?:ql)?|mongodb|redis|smtp):\/\//i.test(value))
      return '[REDACTED]'
    return value
  }
  const safeSettings = settings.filter((s) => !sensitiveSetting.test(s.key))
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    applicationVersion: '1.0.0',
    data: {
      posts: posts.map(
        ({ id, authorId, categoryId, category, tags, seriesLinks, revisions, ...post }) => ({
          ...post,
          category: category?.slug ?? null,
          tags: tags.map((x) => x.tag.slug),
          series: seriesLinks.map((x) => ({ slug: x.series.slug, position: x.position })),
          revisions: revisions.map(({ id: _id, postId: _postId, ...revision }) => revision),
        }),
      ),
      pages: pages.map(({ id: _id, authorId: _authorId, ...page }) => page),
      categories: categories.map(({ id: _id, parentId: _parentId, parent, ...category }) => ({
        ...category,
        parent: parent?.slug ?? null,
      })),
      tags,
      series: series.map(({ id, posts: entries, ...item }) => ({
        ...item,
        posts: entries.map(({ post, position }) => ({ slug: post.slug, position })),
      })),
      comments: comments.map(
        ({
          id,
          post,
          page,
          parent,
          postId: _postId,
          pageId: _pageId,
          parentId: _parentId,
          ipHash: _ipHash,
          ...comment
        }) => ({
          ...comment,
          exportKey: id,
          post: post?.slug ?? null,
          page: page?.slug ?? null,
          parent: parent?.id ?? null,
        }),
      ),
      navigation: navigation.map(({ id, ...item }) => ({
        ...item,
        exportKey: id,
        parent: item.parentId ?? null,
      })),
      links,
      redirects: redirects.map(({ id: _id, postId: _postId, ...redirect }) => redirect),
      settings: safeSettings.map(({ key, value, group }) => ({ key, value: sanitizeSetting(value), group })),
    },
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const archiveMarkdown = getQuery(event).format === 'markdown'
  const bundle = await exportData()
  if (!archiveMarkdown) {
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    setHeader(event, 'Content-Disposition', 'attachment; filename="northstar-export.json"')
    return bundle
  }
  const output = new PassThrough()
  const chunks: Buffer[] = []
  output.on('data', (chunk: Buffer) => chunks.push(chunk))
  const complete = new Promise<void>((resolve, reject) => {
    output.on('end', resolve)
    output.on('error', reject)
  })
  const zip = new ZipArchive({ zlib: { level: 6 } })
  zip.pipe(output)
  for (const post of bundle.data.posts) {
    const safeSlug = post.slug.replace(/[^a-zA-Z0-9_-]/g, '-')
    const frontMatter = [
      `title: ${JSON.stringify(post.title)}`,
      `slug: ${JSON.stringify(post.slug)}`,
      `excerpt: ${JSON.stringify(post.excerpt ?? '')}`,
      `status: ${post.status}`,
      `publishedAt: ${JSON.stringify(post.publishedAt?.toISOString() ?? '')}`,
      `category: ${JSON.stringify(post.category ?? '')}`,
      `tags: ${JSON.stringify(post.tags)}`,
      `series: ${JSON.stringify(post.series)}`,
      `cover: ${JSON.stringify(post.coverUrl ?? '')}`,
      `seo: ${JSON.stringify({ title: post.seoTitle, description: post.seoDescription, canonical: post.canonicalUrl })}`,
    ].join('\n')
    zip.append(`---\n${frontMatter}\n---\n\n${post.markdown}`, { name: `posts/${safeSlug}.md` })
  }
  zip.append(JSON.stringify(bundle, null, 2), { name: 'data.json' })
  await zip.finalize()
  await complete
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', 'attachment; filename="northstar-posts-markdown.zip"')
  return Buffer.concat(chunks)
})
