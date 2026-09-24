import { setHeader } from 'h3'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const match = /^\/posts\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/.exec(getRequestURL(event).pathname)
  if (!match) return
  const post = await db.post.findFirst({
    where: { slug: match[1], status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null },
  })
  if (!post) throw createError({ statusCode: 404, statusMessage: '文章不存在' })
  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  return `---\ntitle: "${post.title.replaceAll('"', '\\"')}"\ndate: ${post.publishedAt?.toISOString()}\n---\n\n${post.markdown}`
})
