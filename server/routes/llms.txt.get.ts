import { db } from '../utils/db'
export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  const posts = await db.post.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    select: { title: true, slug: true, excerpt: true },
  })
  return `# Northstar\n\nA personal blog. Public writing is available as Markdown.\n\n${posts.map((p) => `- [${p.title}](/posts/${p.slug}.md): ${p.excerpt || ''}`).join('\n')}`
})
