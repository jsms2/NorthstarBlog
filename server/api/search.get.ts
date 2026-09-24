import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const params = getQuery(event)
  const query = String(params.q || '').trim().slice(0, 100)
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(params.page || '1'), 10) || 1))
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(String(params.pageSize || '20'), 10) || 20))
  if (query.length < 2) return { items: [], total: 0, page, pageSize, pages: 0 }

  const publicContent = { status: 'PUBLISHED' as const, deletedAt: null, publishedAt: { lte: new Date() } }
  const [posts, pages] = await Promise.all([
    db.post.findMany({
      where: { ...publicContent, OR: [
        { title: { contains: query } }, { excerpt: { contains: query } },
        { searchText: { contains: query } }, { category: { name: { contains: query } } },
        { tags: { some: { tag: { name: { contains: query } } } } },
      ] },
      select: { title: true, slug: true, excerpt: true, publishedAt: true, searchText: true,
        category: { select: { name: true } }, tags: { select: { tag: { select: { name: true } } } } },
    }),
    db.page.findMany({
      where: { ...publicContent, OR: [
        { title: { contains: query } }, { excerpt: { contains: query } }, { markdown: { contains: query } },
      ] },
      select: { title: true, slug: true, excerpt: true, markdown: true, publishedAt: true },
    }),
  ])
  const normalized = query.toLocaleLowerCase()
  const rank = (title: string, body: string, category = '', tags: string[] = []) => {
    const name = title.toLocaleLowerCase()
    if (name === normalized) return 0
    if (name.startsWith(normalized)) return 1
    if (name.includes(normalized)) return 2
    if (category.toLocaleLowerCase().includes(normalized)) return 3
    if (tags.some(tag => tag.toLocaleLowerCase().includes(normalized))) return 4
    return body.toLocaleLowerCase().includes(normalized) ? 5 : 6
  }
  const results = [
    ...posts.map(post => ({ title: post.title, slug: post.slug, excerpt: post.excerpt,
      url: `/posts/${post.slug}`, type: 'post' as const, publishedAt: post.publishedAt,
      score: rank(post.title, post.searchText, post.category?.name || '', post.tags.map(item => item.tag.name)) })),
    ...pages.map(page => ({ title: page.title, slug: page.slug, excerpt: page.excerpt,
      url: `/${page.slug}`, type: 'page' as const, publishedAt: page.publishedAt,
      score: rank(page.title, page.markdown) })),
  ].sort((a, b) => a.score - b.score || (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
  const total = results.length
  return { items: results.slice((page - 1) * pageSize, page * pageSize).map(({ score: _score, publishedAt: _publishedAt, ...item }) => item),
    total, page, pageSize, pages: Math.ceil(total / pageSize) }
})
